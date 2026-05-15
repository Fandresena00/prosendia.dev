/**
 * @file features/ai/services/prompt-builder.service.ts
 *
 * Centralises all prompt construction.
 * Keeping prompts in one place makes them easy to iterate without touching
 * business logic in the AI services.
 *
 * Two prompt types:
 *   buildReplySystemPrompt()   — system prompt for ReplyAI
 *   buildSummaryPrompt()       — user-turn prompt for DataAI
 *
 * Token optimisation:
 *   - System prompts are built once per config and should be stable
 *   - Context messages are trimmed to maxContextMessages before being passed here
 *   - Summaries replace older messages entirely
 */

import { Injectable } from '@nestjs/common';

export interface BusinessContext {
  businessName: string;
  businessType: string;
  description: string | null;
  tone: string;
  responseStyle: string;
  replyLanguage: string | null;
  systemPrompt: string | null;
  inboxInstructions: string | null;
  personalizeGreeting: boolean;
  blockedKeywords: string[];
  allowedTopics: string[];
  escalationThreshold: number;
}

export interface ReferenceImage {
  url: string;
  description: string;
}

export interface ContextMessage {
  sender: 'client' | 'ai' | 'page' | 'human';
  content: string | null;
  imageUrl?: string | null;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class PromptBuilderService {
  // ─── ReplyAI system prompt ─────────────────────────────────────────────────

  /**
   * Builds the system prompt for the ReplyAI model.
   *
   * Structure (in order, skipped when empty):
   *   1. Identity & business context
   *   2. User's custom system prompt
   *   3. Tone and style instructions
   *   4. Language instruction
   *   5. Topic filters
   *   6. Escalation instructions
   *   7. Reference images (product catalogue)
   *   8. Reply format requirements
   */
  buildReplySystemPrompt(
    ctx: BusinessContext,
    referenceImages: ReferenceImage[],
  ): string {
    const parts: string[] = [];

    // 1. Identity
    parts.push(
      `You are the AI assistant for "${ctx.businessName}", ` +
        `a ${ctx.businessType.toLowerCase().replace('_', ' ')} business.` +
        (ctx.description ? ` ${ctx.description}` : ''),
    );

    // 2. Custom system prompt (user-defined)
    if (ctx.systemPrompt?.trim()) {
      parts.push(ctx.systemPrompt.trim());
    }

    // 3. Tone & style
    const tone =
      ctx.tone === 'FRIENDLY'
        ? 'warm, friendly, and approachable'
        : ctx.tone === 'PROFESSIONAL'
          ? 'professional and business-like'
          : 'formal and polite';

    const style =
      ctx.responseStyle === 'SHORT'
        ? 'Keep replies brief (1-3 sentences).'
        : ctx.responseStyle === 'DETAILED'
          ? 'Provide detailed, helpful responses.'
          : 'Balance brevity and detail based on the question complexity.';

    parts.push(`Tone: ${tone}. ${style}`);

    // 4. Language
    // Language rule
    if (ctx.replyLanguage) {
      parts.push(`Language: Reply in ${ctx.replyLanguage}.`);
    } else {
      parts.push(
        'Language: Reply in the customer language.',
        'If the customer mixes languages (e.g. Malagasy + French), you may naturally mix both.',
      );
    }

    if (ctx.personalizeGreeting) {
      parts.push(
        "Personalization: Use the customer's name naturally if available (only once, never force it).",
      );
    }

    // 5. Topic filter
    if (ctx.allowedTopics.length > 0) {
      parts.push(
        `Only answer questions related to: ${ctx.allowedTopics.join(', ')}. ` +
          'For any other topic, politely explain you can only help with these subjects.',
      );
    }

    if (ctx.blockedKeywords.length > 0) {
      parts.push(
        `If the customer mentions any of these sensitive topics: ${ctx.blockedKeywords.join(', ')}, ` +
          'immediately escalate to a human agent by responding ONLY with:\n' +
          'ESCALATE: <brief reason>',
      );
    }

    // 6. Inbox-specific instructions
    if (ctx.inboxInstructions?.trim()) {
      parts.push(ctx.inboxInstructions.trim());
    }

    // 7. Reference images / product catalogue
    if (referenceImages.length > 0) {
      const catalogue = referenceImages
        .map((img, i) => `[${i + 1}] ${img.description} — ${img.url}`)
        .join('\n');

      parts.push(
        'PRODUCT IMAGES:',
        'Use images only if directly relevant to the customer request.',
        'Do not invent or modify URLs.',
        'If used, format exactly: [IMAGE: url] on its own line after the reply.',
        '',
        'AVAILABLE IMAGES:',

        catalogue,
      );

      // Sales rules when catalogue is present
      parts.push(
        'SALES RULES:',
        '- Use only the configured language.',
        '- Never switch language automatically.',
        '- Focus only on selling the business service/product.',
        '- No unnecessary questions.',
        '- Be short, direct, and action-oriented.',
        '- Guide the customer toward ordering, booking, or contacting.',
      );
    }
    // 8. Escalation format
    parts.push(
      'ESCALATION RULES:',
      `- If confidence < ${Math.round(ctx.escalationThreshold * 100)}%, reply ONLY: ESCALATE: <reason>`,
      '- For complaints, refunds, orders, or personal data → ESCALATE only',
      '- Never invent product, price, or availability information',
      '- One short apology max per conversation',
    );
    // 9. Output format
    parts.push(
      'REPLY FORMAT:',
      '- Plain text only (no markdown or formatting)',
      '- No preamble or repetition of the question',
      '- No bullet points unless requested',
      '- Start directly with the answer',
      '',
      'IMAGE RULE:',
      '- Use [IMAGE: url] only if needed',
      '- Place each image on its own line AFTER the text',
      '- Never embed images inside sentences',
    );
    return parts.join('\n\n');
  }

  // ─── ReplyAI conversation context ─────────────────────────────────────────

  /**
   * Builds the messages array for ReplyAI.
   * Layout: system → optional summary → recent messages → inbound trigger
   */
  buildReplyMessages(
    systemPrompt: string,
    summary: string | null,
    recentMsgs: ContextMessage[],
    inboundText: string,
  ): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
    const messages: Array<{
      role: 'system' | 'user' | 'assistant';
      content: string;
    }> = [{ role: 'system', content: systemPrompt }];

    // Optional compressed history
    if (summary) {
      messages.push({
        role: 'user',
        content: `[Conversation summary so far]\n${summary}`,
      });
      messages.push({
        role: 'assistant',
        content: '[Summary acknowledged. I will reply based on this context.]',
      });
    }

    // Recent messages (already limited to maxContextMessages by the caller)
    for (const msg of recentMsgs) {
      if (!msg.content && !msg.imageUrl) continue;

      const text = msg.content ?? '';
      const imageNote = msg.imageUrl ? ` [image: ${msg.imageUrl}]` : '';
      const fullContent = (text + imageNote).trim();
      if (!fullContent) continue;

      const isAgent =
        msg.sender === 'ai' || msg.sender === 'page' || msg.sender === 'human';
      messages.push({
        role: isAgent ? 'assistant' : 'user',
        content: fullContent,
      });
    }

    // The inbound message to reply to (always the final user turn)
    messages.push({ role: 'user', content: inboundText });

    return messages;
  }

  // ─── DataAI summary prompt ─────────────────────────────────────────────────

  /**
   * Builds the prompt for DataAI to generate a compressed conversation summary.
   *
   * The summary is deliberately concise (max 150 words) to minimise tokens
   * consumed by ReplyAI when it reads the context.
   */
  buildSummaryPrompt(
    messages: ContextMessage[],
    clientName: string | null,
  ): string {
    const lines = messages
      .filter((m) => m.content || m.imageUrl)
      .map((m) => {
        const who =
          m.sender === 'client' ? (clientName ?? 'Customer') : 'Business';
        const content = m.content ?? '';
        const img = m.imageUrl ? ' [sent image]' : '';
        return `${who}: ${content}${img}`;
      })
      .join('\n');
    return (
      'Summarize in ≤80 words, factual, third-person, customer intent only.\n' +
      'No opinions, no greetings, one paragraph.\n\n' +
      'CONVERSATION:\n' +
      lines +
      '\n\nSUMMARY:'
    );
  }
}
