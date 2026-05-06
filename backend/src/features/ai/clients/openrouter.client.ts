/**
 * @file features/ai/clients/openrouter.client.ts
 *
 * Typed HTTP client for the OpenRouter API.
 *
 * OpenRouter exposes an OpenAI-compatible /v1/chat/completions endpoint.
 * Key differences from OpenAI:
 *   - Base URL: https://openrouter.ai/api/v1
 *   - Auth header: Authorization: Bearer <OPENROUTER_API_KEY>
 *   - Required extra headers: HTTP-Referer, X-Title
 *   - Model IDs: "<provider>/<model-name>" (e.g. "anthropic/claude-3.5-haiku")
 *
 * This client keeps every call minimal — no retries, no streaming.
 * Callers are responsible for catching errors.
 */

import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// ─── Request / Response shapes ────────────────────────────────────────────────

export interface ChatMessage {
  role:    'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  /** OpenRouter model ID, e.g. "anthropic/claude-3.5-haiku" */
  model:        string;
  messages:     ChatMessage[];
  /** Hard token limit for the completion (not the full context) */
  maxTokens:    number;
  /** 0 = deterministic, 1 = maximum randomness */
  temperature?: number;
  /** Nucleus sampling probability threshold */
  topP?:        number;
}

export interface ChatCompletionResult {
  content:      string;
  promptTokens: number;
  replyTokens:  number;
  totalTokens:  number;
  model:        string;
  /** Latency in milliseconds (wall clock) */
  latencyMs:    number;
}

// ─── OpenRouter API error ─────────────────────────────────────────────────────

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

  /**
   * Send a chat completion request to OpenRouter.
   * Returns the first choice's text and usage stats.
   *
   * Throws OpenRouterError on non-2xx responses.
   * Throws InternalServerErrorException on network timeouts.
   */
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
      const json      = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = (json as { error?: { message?: string } }).error?.message
          ?? `HTTP ${res.status}`;
        throw new OpenRouterError(msg, res.status, json);
      }

      const raw = json as {
        model:   string;
        choices: Array<{ message: { content: string } }>;
        usage:   { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      };

      const content = raw.choices[0]?.message?.content?.trim() ?? '';

      this.logger.debug(
        `✓ OpenRouter [${raw.model}] ${raw.usage?.total_tokens}t in ${latencyMs}ms`,
      );

      return {
        content,
        promptTokens: raw.usage?.prompt_tokens      ?? 0,
        replyTokens:  raw.usage?.completion_tokens   ?? 0,
        totalTokens:  raw.usage?.total_tokens        ?? 0,
        model:        raw.model,
        latencyMs,
      };
    } catch (err) {
      if (err instanceof OpenRouterError) throw err;

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

  /**
   * Fetch the list of available models from OpenRouter.
   * Used by the AI config UI to let users pick their preferred models.
   * Results are NOT cached — call sparingly (max once per UI load).
   */
  async listModels(): Promise<OpenRouterModel[]> {
    try {
      const res  = await fetch(`${OPENROUTER_BASE_URL}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      const json = await res.json() as { data: OpenRouterModelRaw[] };
      return json.data.map(mapModel).sort((a, b) => a.name.localeCompare(b.name));
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
  /** Context window in tokens */
  contextLength:   number;
  /** Cost per 1k prompt tokens in USD */
  promptCostPer1k: number;
  /** Cost per 1k completion tokens in USD */
  replyCostPer1k:  number;
  /** true = free tier available */
  isFree:          boolean;
}

interface OpenRouterModelRaw {
  id:             string;
  name:           string;
  context_length: number;
  pricing: {
    prompt:     string;
    completion: string;
  };
}

function mapModel(r: OpenRouterModelRaw): OpenRouterModel {
  const promptCost = parseFloat(r.pricing?.prompt      ?? '0') * 1000;
  const replyCost  = parseFloat(r.pricing?.completion  ?? '0') * 1000;
  return {
    id:              r.id,
    name:            r.name,
    contextLength:   r.context_length,
    promptCostPer1k: promptCost,
    replyCostPer1k:  replyCost,
    isFree:          promptCost === 0 && replyCost === 0,
  };
}
