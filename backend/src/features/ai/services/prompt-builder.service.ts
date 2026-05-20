/**
 * @file features/ai/services/prompt-builder.service.ts
 *
 * Prompt builder for the INBOX / MESSENGER conversation system ONLY.
 *
 * ⚠️  THIS FILE IS FOR INBOX (MESSENGER DM CONVERSATIONS) ONLY.
 *
 * For POST COMMENT replies, use CommentPromptBuilderService.
 *
 * ROOT CAUSE FIX — "Mila antsoin dia mandefasa DM" bug
 * ──────────────────────────────────────────────────────
 * The previous ANTI-HALLUCINATION rule said:
 *   "Si le client demande quelque chose non mentionné → redirige vers le DM"
 *
 * This caused the AI to say "send us a DM" INSIDE an existing Messenger DM,
 * which is semantically wrong (you're already in a private conversation).
 *
 * FIX: Rule now reads:
 *   "If you don't know → admit honestly and ask a clarifying question here."
 *   The phrase "envoie DM" / "mandefasa DM" is FORBIDDEN in inbox context.
 *
 * LANGUAGE FIX
 * ────────────
 * Madagascar market: customers write Malagasy, French, or mixed.
 * The AI MUST detect the language once and stick to it for the ENTIRE response.
 * Previously it would start a sentence in Malagasy, finish in French.
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

@Injectable()
export class PromptBuilderService {
  /**
   * Constructs the full message array for OpenRouter.
   * Includes system prompt, optional summary (context compression),
   * recent message history, and the new inbound text.
   */
  buildReplyMessages(
    systemPrompt: string,
    summary: string | null,
    history: ContextMessage[],
    inboundText: string,
  ): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
    const messages: Array<{
      role: 'system' | 'user' | 'assistant';
      content: string;
    }> = [];

    // 1. System instructions
    messages.push({ role: 'system', content: systemPrompt });

    // 2. Summary (if exists) - provides compressed context of long conversations
    if (summary) {
      messages.push({
        role: 'system',
        content: `CONTEXT SUMMARY (previous turns): ${summary}`,
      });
    }

    // 3. History
    for (const msg of history) {
      if (!msg.content) continue;
      const role = msg.sender === 'client' ? 'user' : 'assistant';
      messages.push({ role, content: msg.content });
    }

    // 4. Inbound text (the user's latest message)
    const lastHistory = history[history.length - 1];
    if (!lastHistory || lastHistory.content !== inboundText) {
      messages.push({ role: 'user', content: inboundText });
    }

    return messages;
  }

  // ─── Inbox / Messenger reply prompt ──────────────────────────────────────

  buildReplySystemPrompt(
    ctx: BusinessContext,
    referenceImages: ReferenceImage[],
  ): string {
    const sections: string[] = [];

    // 1. Identity
    const typeLabel = this.humanizeBusinessType(ctx.businessType);
    sections.push(
      `Tu es l'assistant IA de "${ctx.businessName}"` +
        (typeLabel ? `, un(e) ${typeLabel}` : '') +
        '.\n' +
        (ctx.description ? ctx.description : '') +
        '\n\n' +
        '⚠️  TU ES DANS UNE CONVERSATION MESSENGER PRIVÉE.\n' +
        "Le client t'a déjà écrit. Réponds-lui directement ici.",
    );

    // 2. Custom system prompt (highest priority)
    if (ctx.systemPrompt?.trim()) {
      sections.push(ctx.systemPrompt.trim());
    }

    // 3. Anti-hallucination — FIXED: no "envoie DM" in inbox
    sections.push(
      'RÈGLE ABSOLUE — NE JAMAIS INVENTER:\n' +
        '- Parle UNIQUEMENT des services, produits et informations de ce contexte.\n' +
        '- Si tu ne sais pas → dis honnêtement que tu vas te renseigner, et pose une\n' +
        '  question de précision au client. NE PAS inventer.\n' +
        '- INTERDIT: "envoie-nous un DM", "contacte-nous en privé", "mandefasa DM".\n' +
        '  Tu ES déjà en conversation privée. Ces phrases sont absurdes ici.\n' +
        '- NE propose JAMAIS de services, prix ou disponibilités non confirmés.\n' +
        "- Mieux vaut demander des précisions qu'inventer.",
    );

    // 4. Language — fixed single-language enforcement
    sections.push(this.buildLanguageRule(ctx));

    // 5. Tone & style
    sections.push(this.buildToneSection(ctx));

    // 6. Inbox-specific instructions
    if (ctx.inboxInstructions?.trim()) {
      sections.push(
        'Instructions spécifiques pour les conversations:\n' +
          ctx.inboxInstructions.trim(),
      );
    }

    // 7. Topic filters
    if (ctx.blockedKeywords.length > 0 || ctx.allowedTopics.length > 0) {
      sections.push(this.buildTopicFilters(ctx));
    }

    // 8. Reference products / images
    if (referenceImages.length > 0) {
      sections.push(
        'Produits/services disponibles (réponds UNIQUEMENT sur ces éléments):\n' +
          referenceImages.map((img) => `- ${img.description}`).join('\n'),
      );
    }

    // 9. Response format
    sections.push(this.buildFormatSection(ctx));

    return sections.join('\n\n');
  }

  // ─── Summary prompt ───────────────────────────────────────────────────────

  buildSummaryPrompt(
    messages: ContextMessage[],
    clientName: string | null,
  ): string {
    const name = clientName ?? 'le client';

    const transcript = messages
      .map((m) => {
        const role =
          m.sender === 'client'
            ? name
            : m.sender === 'ai'
              ? 'Assistant IA'
              : 'Agent';
        const text = m.imageUrl ? `[Image: ${m.imageUrl}]` : (m.content ?? '');
        return `${role}: ${text}`;
      })
      .join('\n');

    return (
      `Résume cette conversation de façon concise (3-5 phrases maximum).\n` +
      `Indique: (1) la demande principale du client, (2) les informations importantes échangées,\n` +
      `(3) l'état de résolution. Sois factuel, pas de jugement.\n\n` +
      `Conversation:\n${transcript}`
    );
  }

  // ─── Spam scoring (for inbox filtering) ──────────────────────────────────

  scoreComment(text: string): {
    score: number;
    shouldReply: boolean;
    reason: string;
  } {
    const trimmed = text.trim();
    const lower = trimmed.toLowerCase();

    if (trimmed.length <= 3)
      return { score: 10, shouldReply: false, reason: 'too_short' };

    let score = 50;

    // Meaningful signals
    if (lower.includes('?')) score += 20;
    const keywords = [
      'prix',
      'combien',
      'disponible',
      'commande',
      'livraison',
      'vidiny',
      'firy',
      'misy',
      'hividiana',
      'mila',
      'info',
    ];
    score += keywords.filter((k) => lower.includes(k)).length * 10;

    // Spam signals
    if (/(.)\\1{3,}/u.test(lower)) score -= 20;
    if (/https?:\/\//.test(lower)) score -= 30;

    score = Math.max(0, Math.min(100, score));

    return {
      score,
      shouldReply: score >= 60,
      reason: score >= 60 ? 'meaningful' : 'low_value',
    };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private buildLanguageRule(ctx: BusinessContext): string {
    const lang = ctx.replyLanguage;

    if (lang === 'mg') {
      return (
        'LANGUE: MALGACHE UNIQUEMENT — chaque phrase du début à la fin.\n' +
        'Termes techniques sans équivalent malgache acceptés en français\n' +
        '(ex: "site web", "commande", "livraison", "automatisation").\n' +
        'INTERDIT: écrire une phrase entière en français.\n' +
        'INTERDIT: mélanger malgache et français dans la même phrase.'
      );
    }

    if (lang === 'fr') {
      return 'LANGUE: Français uniquement. Ne change jamais de langue.';
    }

    if (lang === 'en') {
      return 'LANGUAGE: English only throughout. Do not switch languages.';
    }

    // Auto-detect — critical rule to prevent mid-response language switching
    return (
      'LANGUE: Détecte la langue du client dans son PREMIER message.\n' +
      '→ Si malgache → réponds EN MALGACHE intégralement.\n' +
      '→ Si français  → réponds EN FRANÇAIS intégralement.\n' +
      '→ Si anglais   → réponds EN ANGLAIS intégralement.\n' +
      'INTERDIT: changer de langue en cours de réponse.\n' +
      'INTERDIT: mixer deux langues dans la même réponse.'
    );
  }

  private buildToneSection(ctx: BusinessContext): string {
    const toneLabel =
      {
        PROFESSIONAL: 'professionnel — poli, clair, efficace',
        FORMAL: 'formel — vouvoiement, registre soutenu',
        FRIENDLY: 'amical et chaleureux — tutoiement naturel',
      }[ctx.tone.toUpperCase()] ?? 'amical et chaleureux';

    const styleLabel =
      {
        SHORT: 'Réponses courtes et concises (2-4 phrases).',
        DETAILED: 'Réponses détaillées et complètes si nécessaire.',
        MIXED: 'Calibre la longueur selon la complexité de la question.',
      }[ctx.responseStyle.toUpperCase()] ?? 'Réponses courtes et concises.';

    return `TON: ${toneLabel}.\n${styleLabel}`;
  }

  private buildTopicFilters(ctx: BusinessContext): string {
    const parts: string[] = [];

    if (ctx.allowedTopics.length > 0) {
      parts.push(
        'Réponds UNIQUEMENT sur ces sujets: ' +
          ctx.allowedTopics.join(', ') +
          '.',
      );
    }

    if (ctx.blockedKeywords.length > 0) {
      parts.push(
        'INTERDIT de parler de: ' + ctx.blockedKeywords.join(', ') + '.',
      );
    }

    return parts.join('\n');
  }

  private buildFormatSection(ctx: BusinessContext): string {
    return (
      'FORMAT:\n' +
      '- Texte brut uniquement. Pas de markdown sauf si le client en utilise.\n' +
      '- Commence directement par la réponse, sans formule du type "Bonjour ! Je suis VendeoAI…".\n' +
      '- Ne te présente pas à chaque message.\n' +
      (ctx.personalizeGreeting
        ? '- Utilise le prénom du client si tu le connais.'
        : '')
    );
  }

  private humanizeBusinessType(type: string): string {
    const map: Record<string, string> = {
      ECOMMERCE: 'boutique en ligne',
      RESTAURANT: 'restaurant',
      RETAIL: 'commerce de détail',
      SERVICE: 'prestataire de services',
      REAL_ESTATE: 'agence immobilière',
      HEALTH: 'professionnel de santé',
      EDUCATION: 'établissement éducatif',
      ENTERTAINMENT: 'entreprise de divertissement',
      OTHER: '',
    };
    return map[type.toUpperCase()] ?? '';
  }
}
