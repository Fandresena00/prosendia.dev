/**
 * @file features/facebook-posts/services/comment-prompt-builder.service.ts
 *
 * Prompt builder EXCLUSIVELY for post comment interactions.
 * Completely separate from PromptBuilderService (Messenger inbox system).
 *
 * WHY SEPARATE
 * ────────────
 * The inbox and comment systems have fundamentally different conversation
 * models and must never share prompt logic:
 *
 *   INBOX (PromptBuilderService)
 *   ─────────────────────────────────────────────────────────────────────
 *   • Multi-turn conversation already in progress
 *   • NEVER says "send us a DM" — you ARE in a DM
 *   • Detailed, helpful, answers questions directly
 *   • Has conversation history & summary context
 *
 *   POST COMMENTS (this file)
 *   ─────────────────────────────────────────────────────────────────────
 *   • PUBLIC reply: 1-2 sentences, always redirects to DM
 *   • PRIVATE DM opener: 2-3 sentences, welcoming, NEVER redirects to DM
 *     (you ARE opening a DM — saying "send DM" is nonsensical)
 *   • No conversation history — single-shot response
 *
 * Root cause of the bad inbox response:
 *   The old PromptBuilderService had "redirige vers le DM" in its
 *   ANTI-HALLUCINATION rule, which was appropriate for public comments
 *   but caused the AI to say "Mila antsoin dia mandefasa DM" (need to
 *   send a DM) when ALREADY inside a Messenger conversation.
 */

import { Injectable } from '@nestjs/common';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CommentBusinessContext {
  businessName:    string;
  businessType:    string;
  description:     string | null;
  tone:            string;
  responseStyle:   string;
  replyLanguage:   string | null;
  systemPrompt:    string | null;
  blockedKeywords: string[];
  allowedTopics:   string[];
}

export interface CommentReferenceImage {
  url:         string;
  description: string | null;
}

export interface CommentSpamResult {
  score:       number;   // 0–100
  shouldReply: boolean;  // true if score ≥ 60
  reason:      string;
}

export type DetectedLanguage = 'mg' | 'fr' | 'en';

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class CommentPromptBuilderService {

  // ─── Spam filter ─────────────────────────────────────────────────────────

  /**
   * Heuristic spam scoring — no AI tokens needed.
   * Score ≥ 60 → reply; < 60 → skip.
   * Copied & adapted from PromptBuilderService.scoreComment so both systems
   * can evolve independently.
   */
  scoreComment(text: string): CommentSpamResult {
    const trimmed = text.trim();
    const lower   = trimmed.toLowerCase();

    // Pure emoji / too short
    const noEmoji = trimmed.replace(/[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{26FF}]/gu, '').trim();
    if (!noEmoji)                         return { score: 5,  shouldReply: false, reason: 'emojis_only' };
    if (noEmoji.split(/\s+/).length < 2)  return { score: 15, shouldReply: false, reason: 'too_short' };

    let score = 50;

    // Spam signals
    if (/(.)\\1{4,}/u.test(lower))  score -= 25; // aaaa, heyyy
    if (/https?:\/\//.test(lower))  score -= 30; // links
    if ((lower.match(/@/g) ?? []).length > 2) score -= 20; // tag spam
    if (/^[A-Z\s!]{10,}$/.test(trimmed)) score -= 15;     // ALL CAPS

    // Quality signals — French
    const frKeywords = [
      'prix', 'combien', 'disponible', 'commande', 'livraison', 'délai',
      'infos', 'intéressé', 'acheter', 'contact', 'comment', 'payer',
    ];
    score += frKeywords.filter((k) => lower.includes(k)).length * 12;

    // Quality signals — Malagasy
    const mgKeywords = [
      'vidiny', 'firy', 'misy', 'azonao', 'mba', 'azafady', 'manahoana',
      'hividy', 'hividiana', 'mila', 'omeo', 'inona', 'ahoana',
    ];
    score += mgKeywords.filter((k) => lower.includes(k)).length * 12;

    // Question mark — strong signal
    if (lower.includes('?')) score += 20;

    // Complaints — still worth a response
    const negatives = ['nul', 'arnaque', 'mauvais', 'problème', 'rembours'];
    if (negatives.some((n) => lower.includes(n))) score += 15;

    score = Math.max(0, Math.min(100, score));

    return {
      score,
      shouldReply: score >= 60,
      reason: score >= 60 ? 'meaningful' : 'low_value',
    };
  }

  // ─── Language detection ───────────────────────────────────────────────────

  detectLanguage(text: string): DetectedLanguage {
    const lower = text.toLowerCase();

    const mgTokens = [
      'mba', 'azafady', 'vidiny', 'firy', 'misy', 'tena', 'ity',
      'izy', 'manao', 'misoatra', 'manahoana', 'omeo', 'hividiana',
      'mila', 'ny', 'eny', 'tsia', 'marina', 'ahoana', 'inona',
    ];
    const enTokens = [
      'hello', 'hi', 'price', 'available', 'order', 'how much',
      'delivery', 'please', 'thanks', 'what', 'when', 'where',
    ];

    const mgScore = mgTokens.filter((w) =>
      new RegExp(`\\b${w}\\b`, 'i').test(lower),
    ).length;

    const enScore = enTokens.filter((w) => lower.includes(w)).length;

    if (mgScore >= 2) return 'mg';
    if (enScore >= 2) return 'en';
    return 'fr';
  }

  // ─── Public comment reply ─────────────────────────────────────────────────

  /**
   * System prompt for a PUBLIC reply to a Facebook comment.
   *
   * Rules:
   *   - 1-2 sentences max (30-50 words)
   *   - Acknowledge the comment, then redirect to private message
   *   - NEVER give full details here (price, stock, delivery)
   *   - ONE language throughout
   */
  buildPublicCommentReplyPrompt(
    ctx:                CommentBusinessContext,
    postCaption:        string,
    customInstructions: string | null,
    images:             CommentReferenceImage[],
    commentLang:        DetectedLanguage,
  ): string {
    const parts: string[] = [];

    // Identity
    parts.push(
      `Tu es le service client de "${ctx.businessName}" sur Facebook.` +
      (ctx.description ? `\n${ctx.description}` : ''),
    );

    if (ctx.systemPrompt?.trim()) parts.push(ctx.systemPrompt.trim());

    // Context
    parts.push(
      'CONTEXTE: Tu réponds à UN commentaire public sur ce post:\n' +
      `"${postCaption.slice(0, 200)}"`,
    );

    // Strict rules for public reply
    parts.push(
      'RÈGLES — COMMENTAIRE PUBLIC (NON NÉGOCIABLES):\n' +
      '1. Maximum 1 à 2 phrases (30 à 50 mots). Jamais plus.\n' +
      '2. Accuser réception du commentaire positivement.\n' +
      '3. TOUJOURS terminer en invitant à envoyer un message privé.\n' +
      '   Exemples: "Envoie-nous un message pour plus de détails."\n' +
      '   En malgache: "Mandefa hafatra taminay mba ahafantarana bebe kokoa."\n' +
      '4. INTERDIT: donner prix, stock, délai, ou détails complets.\n' +
      '5. INTERDIT: listes numérotées, émojis excessifs.\n' +
      `6. Ton: ${this.toneLabel(ctx.tone)}.`,
    );

    parts.push(this.languageRule(ctx.replyLanguage, commentLang));

    if (customInstructions?.trim()) {
      parts.push(`Instructions spécifiques:\n${customInstructions.trim()}`);
    }

    if (images.length > 0) {
      parts.push(
        'Produits disponibles:\n' +
        images.slice(0, 3).map((i) => `- ${i.description}`).join('\n'),
      );
    }

    parts.push('FORMAT: Texte brut. Réponse directe. Commence sans formule de politesse longue.');

    return parts.join('\n\n');
  }

  // ─── Private DM reply (triggered by comment) ─────────────────────────────

  /**
   * System prompt for a PRIVATE DM sent as a response to a comment.
   *
   * CRITICAL difference from public comment:
   *   This IS the private message — never say "envoie un DM",
   *   never say "contact us privately". You ARE the private contact.
   *
   * CRITICAL difference from inbox auto-reply:
   *   This is the OPENING of a new conversation, not a continuation.
   *   There is no previous history. Be welcoming, not transactional.
   */
  buildPrivateDmReplyPrompt(
    ctx:                CommentBusinessContext,
    postCaption:        string,
    commentText:        string,
    customInstructions: string | null,
    images:             CommentReferenceImage[],
    commentLang:        DetectedLanguage,
  ): string {
    const parts: string[] = [];

    // Identity
    parts.push(
      `Tu es l'assistant de "${ctx.businessName}".` +
      (ctx.description ? `\n${ctx.description}` : ''),
    );

    if (ctx.systemPrompt?.trim()) parts.push(ctx.systemPrompt.trim());

    // Context — brief, no reproduction of comment
    parts.push(
      'CONTEXTE:\n' +
      'Tu envoies un MESSAGE PRIVÉ Facebook à quelqu\'un qui vient de commenter ton post.\n' +
      `Post: "${postCaption.slice(0, 150)}"\n` +
      'Tu ouvres TOIT MÊME cette conversation privée avec lui.',
    );

    // Strict rules for private DM opener
    parts.push(
      'RÈGLES — MESSAGE PRIVÉ D\'OUVERTURE (NON NÉGOCIABLES):\n' +
      '1. 2 à 3 phrases MAXIMUM.\n' +
      '2. Message chaleureux — tu prends l\'initiative de le contacter.\n' +
      '3. Montre que tu as vu son commentaire (sans le citer mot pour mot).\n' +
      '4. Propose de l\'aider DANS CETTE CONVERSATION.\n' +
      '5. *** INTERDIT: dire "envoie-nous un DM" ou "contacte-nous en privé".\n' +
      '   Tu ES DÉJÀ en message privé. Rediriger vers un DM est absurde. ***\n' +
      '6. INTERDIT: listes numérotées, étapes, tutoriels, prix sans qu\'on te le demande.\n' +
      '7. INTERDIT: reproduire le contenu du post.',
    );

    parts.push(this.languageRule(ctx.replyLanguage, commentLang));

    if (customInstructions?.trim()) {
      parts.push(`Instructions: ${customInstructions.trim()}`);
    }

    if (images.length > 0) {
      parts.push(
        'Produits disponibles:\n' +
        images.slice(0, 3).map((i) => `- ${i.description}`).join('\n'),
      );
    }

    parts.push('FORMAT: Texte brut. Commence directement. Pas de liste.');

    return parts.join('\n\n');
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private languageRule(
    configured: string | null,
    detected:   DetectedLanguage,
  ): string {
    const lang = configured ?? detected;

    if (lang === 'mg') {
      return (
        'LANGUE OBLIGATOIRE: MALGACHE INTÉGRAL.\n' +
        'Chaque phrase, du début à la fin, doit être en malgache.\n' +
        'Seuls les termes techniques sans équivalent malgache sont autorisés en français\n' +
        '(ex: "commande", "livraison", "site web", "automatisation").\n' +
        'INTERDIT: écrire une phrase entière en français. INTERDIT: mélanger les langues.'
      );
    }

    if (lang === 'en') {
      return 'LANGUAGE: English only, from start to finish. Do not switch languages.';
    }

    return (
      'LANGUE: Français uniquement, du début à la fin.\n' +
      'Ne change JAMAIS de langue en cours de réponse.'
    );
  }

  private toneLabel(tone: string): string {
    const map: Record<string, string> = {
      PROFESSIONAL: 'professionnel',
      FORMAL:       'formel',
      FRIENDLY:     'amical et chaleureux',
    };
    return map[tone.toUpperCase()] ?? 'amical et chaleureux';
  }
}
