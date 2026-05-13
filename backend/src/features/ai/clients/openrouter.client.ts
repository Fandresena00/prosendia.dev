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

// ─── Thinking chain stripper ──────────────────────────────────────────────────

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
