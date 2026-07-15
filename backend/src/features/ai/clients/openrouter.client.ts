/**
 * @file features/ai/clients/openrouter.client.ts
 *
 * FIXES
 * ─────
 * 1. CRASH FIX: `raw.choices[0]` → `raw.choices?.[0]`
 *    When OpenRouter returns an error body that passes the `res.ok` check (rare
 *    but observed), or the model returns an empty choices array, accessing
 *    `raw.choices[0]` throws "Cannot read properties of undefined (reading '0')".
 *    The optional chaining `raw.choices?.[0]` prevents the crash.
 *
 * 2. THINKING CHAIN STRIPPING: `stripThinkingChain()`
 *    Some free models (e.g. Nemotron, DeepSeek-R1) output their internal
 *    reasoning before the actual reply:
 *      <think>Okay, the user is greeting me...</think>
 *      Bonjour ! Je suis là pour vous aider.
 *    Without stripping, this reasoning gets sent verbatim to customers.
 *    The function removes all known thinking-chain formats.
 *
 * 3. EMPTY RESPONSE GUARD: throws a descriptive error if the model returns
 *    nothing useful after stripping, allowing the worker to retry.
 *
 * 4. STREAMING (realtime upgrade — inbox AI suggestion button):
 *    `completeStream()` mirrors `complete()` but streams tokens via SSE and
 *    calls `onChunk()` as they arrive, for the inbox reply-suggestion feature.
 *    Thinking chains are just as real a risk in streaming mode — a naive
 *    implementation would flash the model's raw reasoning to the agent
 *    character by character before the closing tag ever arrives.stripThinkingChain()
 *    only works on a complete string, so streaming needs its own incremental
 *    filter: createThinkingChainStreamFilter() holds back text that could be
 *    the start of a <think>/<thinking>/<reasoning>/[THINKING] block until
 *    it's confirmed safe to show, and drops confirmed-hidden spans entirely.
 */

import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// ─── Request / Response shapes ────────────────────────────────────────────────

export interface ChatMessage {
  role:    'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  model:        string;
  messages:     ChatMessage[];
  maxTokens:    number;
  temperature?: number;
  topP?:        number;
}

export interface ChatCompletionResult {
  content:      string;
  promptTokens: number;
  replyTokens:  number;
  totalTokens:  number;
  model:        string;
  latencyMs:    number;
}

export class OpenRouterError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly raw?: unknown,
  ) {
    super(message);
    this.name = 'OpenRouterError';
  }
}

// ─── Thinking chain stripper (non-streaming — final string) ───────────────────

/**
 * Removes internal reasoning chains from model output before sending to customers.
 *
 * Models that include thinking chains typically wrap them in XML-like tags.
 * After stripping, leading/trailing whitespace is removed.
 *
 * Patterns handled:
 *   <think>...</think>                — DeepSeek-R1, Qwen-thinking, etc.
 *   <thinking>...</thinking>          — Some OpenAI-compat models
 *   <reasoning>...</reasoning>        — Less common
 *   [THINKING]...[/THINKING]          — Bracket variants
 *
 * NOTE: Models that emit RAW thinking text (like Nemotron) without any tags
 * cannot be reliably stripped. Switch to a different model instead.
 * See REPLY_AI_FALLBACK_MODELS in ai-models.config.ts.
 */
function stripThinkingChain(raw: string): string {
  let result = raw;

  // XML-style tags (most common)
  result = result.replace(/<think>[\s\S]*?<\/think>/gi, '');
  result = result.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
  result = result.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '');

  // Bracket-style tags
  result = result.replace(/\[THINKING\][\s\S]*?\[\/THINKING\]/gi, '');
  result = result.replace(/\[THINK\][\s\S]*?\[\/THINK\]/gi, '');

  // Some models use "Step X:" reasoning steps before the actual answer.
  // Only strip if there's a clear separator (---) between reasoning and answer.
  const separatorMatch = result.match(/\n[-=*]{3,}\n/);
  if (separatorMatch?.index !== undefined) {
    const afterSeparator = result.slice(separatorMatch.index + separatorMatch[0].length).trim();
    // Only use the post-separator content if it's non-trivial
    if (afterSeparator.length > 10) {
      result = afterSeparator;
    }
  }

  return result.trim();
}

// ─── Thinking chain stripper (streaming — incremental) ─────────────────────────

const THINK_OPEN_TAGS = ['<think>', '<thinking>', '<reasoning>', '[THINKING]', '[THINK]'] as const;
const THINK_CLOSE_TAGS: Record<string, string> = {
  '<think>':     '</think>',
  '<thinking>':  '</thinking>',
  '<reasoning>': '</reasoning>',
  '[THINKING]':  '[/THINKING]',
  '[THINK]':     '[/THINK]',
};
/** Longest opening tag ("<thinking>") — how far back we may need to hold text. */
const MAX_TAG_LEN = Math.max(...THINK_OPEN_TAGS.map((t) => t.length));

/**
 * Incrementally filters <think>/<thinking>/<reasoning>/[THINKING] blocks out
 * of a token stream so the UI never flashes the model's raw reasoning before
 * it's fully suppressed.
 *
 * push(delta) returns the portion of `delta` (plus any previously held-back
 * text now confirmed safe) that should be shown immediately. Text that could
 * still be the start of a tag is held in an internal buffer until the next
 * chunk disambiguates it. flush() releases anything left once the stream ends
 * — except text still "inside" an unterminated think block, which is dropped
 * rather than leaked.
 */
function createThinkingChainStreamFilter() {
  let buffer = '';
  let insideThink = false;
  let closeTag = '';

  function push(delta: string): string {
    buffer += delta;
    let visible = '';

    for (;;) {
      if (insideThink) {
        const closeIdx = buffer.indexOf(closeTag);
        if (closeIdx === -1) return visible; // still hidden — keep buffering
        buffer = buffer.slice(closeIdx + closeTag.length);
        insideThink = false;
        continue;
      }

      let earliestIdx = -1;
      let matchedTag = '';
      for (const tag of THINK_OPEN_TAGS) {
        const idx = buffer.indexOf(tag);
        if (idx !== -1 && (earliestIdx === -1 || idx < earliestIdx)) {
          earliestIdx = idx;
          matchedTag = tag;
        }
      }

      if (earliestIdx !== -1) {
        visible += buffer.slice(0, earliestIdx);
        buffer = buffer.slice(earliestIdx + matchedTag.length);
        insideThink = true;
        closeTag = THINK_CLOSE_TAGS[matchedTag];
        continue;
      }

      // No complete tag found — the buffer's tail might be a partial tag
      // opening (e.g. "<thi"); hold that part back for the next chunk.
      const holdBackLen = Math.min(buffer.length, MAX_TAG_LEN - 1);
      const tail = buffer.slice(buffer.length - holdBackLen);
      const looksLikePartialTag = /<[a-zA-Z]*$|\[[A-Z]*$/.test(tail);

      if (looksLikePartialTag && holdBackLen > 0) {
        visible += buffer.slice(0, buffer.length - holdBackLen);
        buffer = buffer.slice(buffer.length - holdBackLen);
      } else {
        visible += buffer;
        buffer = '';
      }
      return visible;
    }
  }

  function flush(): string {
    // Anything still held back once the stream ends is released, UNLESS
    // we're still "inside" an unterminated think block — then it's dropped
    // (better to lose a reasoning fragment than leak it).
    const leftover = insideThink ? '' : buffer;
    buffer = '';
    return leftover;
  }

  return { push, flush };
}

// ─── Client ───────────────────────────────────────────────────────────────────

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const TIMEOUT_MS          = 30_000;

@Injectable()
export class OpenRouterClient {
  private readonly logger = new Logger(OpenRouterClient.name);
  private readonly apiKey: string;
  private readonly siteUrl: string;
  private readonly siteTitle: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey    = config.getOrThrow<string>('openRouterApiKey');
    this.siteUrl   = config.get<string>('appUrl', 'https://vendeoai.com');
    this.siteTitle = config.get<string>('appTitle', 'VendeoAI');
  }

  // ─── Single completion call ───────────────────────────────────────────────

  async complete(opts: ChatCompletionOptions): Promise<ChatCompletionResult> {
    const start      = Date.now();
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const body = {
      model:       opts.model,
      messages:    opts.messages,
      max_tokens:  opts.maxTokens,
      temperature: opts.temperature ?? 0.7,
      top_p:       opts.topP ?? 1,
    };

    this.logger.debug(
      `→ OpenRouter [${opts.model}] ${opts.messages.length} msgs, max=${opts.maxTokens}t`,
    );

    try {
      const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          Authorization:   `Bearer ${this.apiKey}`,
          'HTTP-Referer':  this.siteUrl,
          'X-Title':       this.siteTitle,
        },
        body:   JSON.stringify(body),
        signal: controller.signal,
      });

      const latencyMs = Date.now() - start;
      const json      = await res.json().catch(() => ({})) as Record<string, unknown>;

      if (!res.ok) {
        const msg = (json.error as { message?: string } | undefined)?.message
          ?? `HTTP ${res.status}`;
        throw new OpenRouterError(msg, res.status, json);
      }

      // FIX 1: raw.choices?.[0] — safe access if choices is undefined/null/empty
      const choicesArray = json.choices as Array<{ message?: { content?: string } }> | undefined;
      const rawContent   = choicesArray?.[0]?.message?.content ?? '';

      // FIX 2: Strip thinking chains BEFORE the content reaches callers
      const content = stripThinkingChain(rawContent);

      // FIX 3: Guard against models that return nothing useful
      if (!content) {
        this.logger.warn(
          `Model ${opts.model} returned empty content after stripping ` +
          `(raw length: ${rawContent.length}). ` +
          `This may be a thinking-only model — consider switching models.`,
        );
        throw new InternalServerErrorException(
          `Model returned empty content: ${opts.model}`,
        );
      }

      const usageRaw = json.usage as {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      } | undefined;

      const modelName = (json.model as string | undefined) ?? opts.model;

      this.logger.debug(
        `✓ OpenRouter [${modelName}] ${usageRaw?.total_tokens ?? '?'}t in ${latencyMs}ms`,
      );

      return {
        content,
        promptTokens: usageRaw?.prompt_tokens      ?? 0,
        replyTokens:  usageRaw?.completion_tokens  ?? 0,
        totalTokens:  usageRaw?.total_tokens       ?? 0,
        model:        modelName,
        latencyMs,
      };
    } catch (err) {
      if (err instanceof OpenRouterError)          throw err;
      if (err instanceof InternalServerErrorException) throw err;

      if (err instanceof Error && err.name === 'AbortError') {
        throw new InternalServerErrorException(
          `OpenRouter timeout after ${TIMEOUT_MS}ms for model ${opts.model}`,
        );
      }

      throw new InternalServerErrorException(
        `OpenRouter request failed: ${String(err)}`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  // ─── Streaming completion call (inbox AI suggestion) ──────────────────────

  /**
   * Same contract as complete(), but streams tokens as they arrive.
   * `onChunk` receives only VISIBLE text — thinking-chain spans are filtered
   * out incrementally (see createThinkingChainStreamFilter above) rather than
   * stripped after the fact, so nothing hidden ever reaches the caller even
   * mid-stream.
   */
  async completeStream(
    opts: ChatCompletionOptions,
    onChunk: (textChunk: string) => void,
  ): Promise<ChatCompletionResult> {
    const start      = Date.now();
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const body = {
      model:           opts.model,
      messages:        opts.messages,
      max_tokens:      opts.maxTokens,
      temperature:     opts.temperature ?? 0.7,
      top_p:           opts.topP ?? 1,
      stream:          true,
      stream_options:  { include_usage: true },
    };

    this.logger.debug(
      `→ OpenRouter [stream] [${opts.model}] ${opts.messages.length} msgs, max=${opts.maxTokens}t`,
    );

    try {
      const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          Authorization:   `Bearer ${this.apiKey}`,
          'HTTP-Referer':  this.siteUrl,
          'X-Title':       this.siteTitle,
        },
        body:   JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const errJson = await res.json().catch(() => ({})) as Record<string, unknown>;
        const msg = (errJson.error as { message?: string } | undefined)?.message
          ?? `HTTP ${res.status}`;
        throw new OpenRouterError(msg, res.status, errJson);
      }

      const reader      = res.body.getReader();
      const decoder      = new TextDecoder();
      const thinkFilter  = createThinkingChainStreamFilter();

      let sseBuffer      = '';
      let rawContent     = '';
      let promptTokens   = 0;
      let replyTokens    = 0;
      let totalTokens    = 0;
      let modelName      = opts.model;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop() ?? '';

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (payload === '[DONE]') continue;

          let json: Record<string, unknown>;
          try {
            json = JSON.parse(payload);
          } catch {
            continue; // partial/malformed SSE line — next chunk will complete it
          }

          const choices = json.choices as Array<{ delta?: { content?: string } }> | undefined;
          const delta = choices?.[0]?.delta?.content;
          if (delta) {
            rawContent += delta;
            const visible = thinkFilter.push(delta);
            if (visible) onChunk(visible);
          }
          if (typeof json.model === 'string') modelName = json.model;

          const usage = json.usage as
            | { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
            | undefined;
          if (usage) {
            promptTokens = usage.prompt_tokens     ?? promptTokens;
            replyTokens  = usage.completion_tokens ?? replyTokens;
            totalTokens  = usage.total_tokens      ?? totalTokens;
          }
        }
      }

      const trailing = thinkFilter.flush();
      if (trailing) onChunk(trailing);

      const content = stripThinkingChain(rawContent);
      if (!content) {
        throw new InternalServerErrorException(
          `Model returned empty content: ${opts.model}`,
        );
      }
      if (totalTokens === 0) {
        totalTokens = Math.ceil(rawContent.length / 4); // rough ~4 chars/token fallback
      }

      const latencyMs = Date.now() - start;
      this.logger.debug(
        `✓ OpenRouter [stream] [${modelName}] ${totalTokens}t in ${latencyMs}ms`,
      );

      return {
        content,
        promptTokens,
        replyTokens,
        totalTokens,
        model: modelName,
        latencyMs,
      };
    } catch (err) {
      if (err instanceof OpenRouterError)               throw err;
      if (err instanceof InternalServerErrorException)  throw err;

      if (err instanceof Error && err.name === 'AbortError') {
        throw new InternalServerErrorException(
          `OpenRouter timeout after ${TIMEOUT_MS}ms for model ${opts.model}`,
        );
      }

      throw new InternalServerErrorException(
        `OpenRouter stream request failed: ${String(err)}`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  // ─── Model catalogue ──────────────────────────────────────────────────────

  async listModels(): Promise<OpenRouterModel[]> {
    try {
      const res  = await fetch(`${OPENROUTER_BASE_URL}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      const json = await res.json() as { data: OpenRouterModelRaw[] };
      return (json.data ?? []).map(mapModel).sort((a, b) => a.name.localeCompare(b.name));
    } catch (err) {
      this.logger.error(`Failed to fetch OpenRouter models: ${String(err)}`);
      return [];
    }
  }
}

// ─── Model catalogue types ────────────────────────────────────────────────────

export interface OpenRouterModel {
  id:              string;
  name:            string;
  contextLength:   number;
  promptCostPer1k: number;
  replyCostPer1k:  number;
  isFree:          boolean;
}

interface OpenRouterModelRaw {
  id:             string;
  name:           string;
  context_length: number;
  pricing?: {
    prompt?:     string;
    completion?: string;
  };
}

function mapModel(r: OpenRouterModelRaw): OpenRouterModel {
  const promptCost = parseFloat(r.pricing?.prompt      ?? '0') * 1000;
  const replyCost  = parseFloat(r.pricing?.completion  ?? '0') * 1000;
  return {
    id:              r.id,
    name:            r.name,
    contextLength:   r.context_length ?? 0,
    promptCostPer1k: promptCost,
    replyCostPer1k:  replyCost,
    isFree:          promptCost === 0 && replyCost === 0,
  };
}
