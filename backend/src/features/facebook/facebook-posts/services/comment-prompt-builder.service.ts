/**
 * @file features/facebook-posts/services/comment-prompt-builder.service.ts
 *
 * Prompt builder + NON-AI rule engine for post comment interactions.
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
 * ─────────────────────────────────────────────────────────────────────────
 * FIX — scoreComment() threshold (ROOT CAUSE of "AI never replies to comments")
 * ─────────────────────────────────────────────────────────────────────────
 * Previous logic started from a base score of 50 with a reply threshold
 * of 60. Any comment WITHOUT a "?", a recognised keyword, or a complaint
 * word stayed at exactly 50 → shouldReply = false — FOREVER. This meant
 * the most common comments on a Facebook post ("Super produit !", "J'adore
 * ❤️", "Tena tsara ity", "Magnifique") NEVER received an AI reply, even
 * with autoReply=true.
 *
 * Fix: raise the BASE score from 50 → 65. The reply threshold stays at 60.
 *   - A plain positive/neutral comment with 2+ words now scores 65 → replies.
 *   - A SINGLE spam signal (link -30, repeated chars -25, ALL CAPS -15,
 *     tag spam -20) still drops the score below 60 → still filtered.
 *   - Pure-emoji / single-word comments are still filtered separately.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * NEW — Keyword rules: flexible, NON-AI, instruction-following automation
 * ─────────────────────────────────────────────────────────────────────────
 * Some user instructions are perfectly deterministic ("reply 'test' to any
 * comment containing 'test'", "send X to everyone") and DON'T need an AI
 * call at all — running them through the LLM would be slower, less
 * reliable (the model might not follow the instruction "to the letter"),
 * AND would burn credits unnecessarily.
 *
 * `findMatchingKeywordRule()` is a pure, deterministic, NON-AI matcher
 * (case/accent-insensitive). PostAiConfig.keywordRules is a JSON array of
 * `KeywordRule`:
 *
 *   - `replyText` SET    → the comment gets this EXACT fixed reply, posted
 *                           directly. ZERO AI calls, ZERO credits consumed.
 *                           This is how "répond 'test' à tout commentaire
 *                           contenant 'test'" is implemented — literally,
 *                           every time, instantly.
 *   - `replyText` NULL   → the comment BYPASSES the spam-score filter and
 *                           an AI reply is generated as normal (credits
 *                           consumed). Use this for "this type of comment
 *                           deserves special attention" without dictating
 *                           the exact wording.
 *
 * `PostAiConfig.replyToAllComments` is the blunt "repondre a tous les
 * commentaires" switch: when true, EVERY comment bypasses the spam filter
 * (still subject to credits/AI generation — use with care on busy posts).
 *
 * Both mechanisms are evaluated by PostCommentAiService BEFORE the
 * spam-score check, so they always take priority and never get silently
 * swallowed by the spam filter.
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
  shouldReply: boolean;  // true if score ≥ REPLY_THRESHOLD
  reason:      string;
}

export type DetectedLanguage = 'mg' | 'fr' | 'en';

/** Field that an AI "suggestion" can fill in the post AI config form. */
export type SuggestibleField = 'privateReplyMessage' | 'customInstructions';

/**
 * Deterministic, non-AI keyword rule. Evaluated BEFORE the spam-score
 * filter so explicit user instructions are always honoured.
 *
 *   replyText !== null  → fixed reply, NO AI call, NO credits.
 *   replyText === null  → bypass spam filter, AI generates the reply
 *                          (credits consumed as usual).
 */
export interface KeywordRule {
  id:               string;
  keyword:          string;
  matchType:        'contains' | 'exact';
  replyText:        string | null;
  sendPrivateReply: boolean;
  /** Fixed private DM text. If sendPrivateReply=true and this is null, the
   *  DM is AI-generated (credits consumed). */
  privateReplyText: string | null;
}

// ─── Tuning constants ──────────────────────────────────────────────────────────

/**
 * Base score for any comment that passes the minimum length/emoji checks.
 * Raised from 50 → 65 so that ordinary positive/neutral comments (no "?",
 * no keyword) clear the REPLY_THRESHOLD by default. See file header.
 */
const BASE_SCORE = 65;

/** Minimum score required for the AI to reply. Unchanged. */
const REPLY_THRESHOLD = 60;

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class CommentPromptBuilderService {

  // ─── Spam filter ─────────────────────────────────────────────────────────

  /**
   * Heuristic spam scoring — no AI tokens needed.
   * Score ≥ REPLY_THRESHOLD (60) → reply; below → skip.
   *
   * Base score is BASE_SCORE (65). A single strong spam signal (link,
   * repeated characters, ALL CAPS, tag spam) is enough to drop a comment
   * below the threshold; ordinary engagement comments pass through.
   */
  scoreComment(text: string): CommentSpamResult {
    const trimmed = text.trim();
    const lower   = trimmed.toLowerCase();

    // Pure emoji / too short — never worth an AI reply regardless of score.
    const noEmoji = trimmed.replace(/[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{26FF}]/gu, '').trim();
    if (!noEmoji)                         return { score: 5,  shouldReply: false, reason: 'emojis_only' };
    if (noEmoji.split(/\s+/).length < 2)  return { score: 15, shouldReply: false, reason: 'too_short' };

    let score = BASE_SCORE;

    // Spam signals
    if (/(.)\1{4,}/u.test(lower))   score -= 25; // aaaa, heyyy
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
      shouldReply: score >= REPLY_THRESHOLD,
      reason: score >= REPLY_THRESHOLD ? 'meaningful' : 'low_value',
    };
  }

  // ─── Keyword rules (non-AI, deterministic) ────────────────────────────────

  /**
   * Returns the FIRST KeywordRule whose keyword matches `message`
   * (case-insensitive, accent-insensitive), or null if none match.
   *
   * Rules are evaluated in array order — put more specific rules first.
   */
  findMatchingKeywordRule(rules: KeywordRule[], message: string): KeywordRule | null {
    const normalizedMessage = this.normalizeForMatch(message);

    for (const rule of rules) {
      const keyword = this.normalizeForMatch(rule.keyword?.trim() ?? '');
      if (!keyword) continue;

      const matches = rule.matchType === 'exact'
        ? normalizedMessage === keyword
        : normalizedMessage.includes(keyword);

      if (matches) return rule;
    }

    return null;
  }

  /** Lowercase + strip accents, for accent/case-insensitive matching. */
  private normalizeForMatch(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
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
   *
   * FIX — empty post caption handling:
   *   If `postCaption` is empty, the "CONTEXTE: post" block is omitted and
   *   `customInstructions` (if any) is promoted to the primary context
   *   anchor instead of being a minor addendum.
   *
   * `ruleContext`, when provided, means a KeywordRule with replyText=null
   * matched this comment (see findMatchingKeywordRule) — i.e. the spam
   * filter was bypassed by explicit user configuration. The model is told
   * so it understands why it's replying to something that might otherwise
   * look low-value.
   */
  buildPublicCommentReplyPrompt(
    ctx:                CommentBusinessContext,
    postCaption:        string,
    customInstructions: string | null,
    images:             CommentReferenceImage[],
    commentLang:        DetectedLanguage,
    ruleContext?:       string,
  ): string {
    const parts: string[] = [];
    const trimmedCaption = postCaption.trim();
    const trimmedInstructions = customInstructions?.trim() || null;

    // Identity
    parts.push(
      `Tu es le service client de "${ctx.businessName}" sur Facebook.` +
      (ctx.description ? `\n${ctx.description}` : ''),
    );

    if (ctx.systemPrompt?.trim()) parts.push(ctx.systemPrompt.trim());

    if (ruleContext) {
      parts.push(
        'RÈGLE CONFIGURÉE PAR LE PROPRIÉTAIRE DE LA PAGE:\n' + ruleContext,
      );
    }

    // Context — post caption (only when present)
    if (trimmedCaption) {
      parts.push(
        'CONTEXTE: Tu réponds à UN commentaire public sur ce post:\n' +
        `"${trimmedCaption.slice(0, 200)}"`,
      );
    }

    // FIX: customInstructions is now the HIGHEST-PRIORITY behavioural rule
    // — the model must follow it literally ("à la lettre"), even when the
    // post has no caption to anchor it.
    if (trimmedInstructions) {
      parts.push(
        'INSTRUCTIONS SPÉCIFIQUES À CE POST (PRIORITÉ ABSOLUE — à suivre ' +
        'littéralement et exactement, même si cela semble en tension avec ' +
        'les règles générales ci-dessous, SAUF si cela impliquerait de ' +
        'mentir, d\'inventer un prix/stock, ou un contenu dangereux):\n' +
        trimmedInstructions,
      );
    } else if (!trimmedCaption) {
      parts.push(
        'CONTEXTE: Ce post Facebook ne contient pas de légende. ' +
        "Réponds de façon générique et chaleureuse, sans faire référence " +
        'au contenu du post.',
      );
    }

    // Strict rules for public reply
    parts.push(
      'RÈGLES — COMMENTAIRE PUBLIC:\n' +
      '1. Maximum 1 à 2 phrases (30 à 50 mots) SAUF si les instructions ' +
      'spécifiques ci-dessus imposent un texte exact différent.\n' +
      '2. Accuser réception du commentaire positivement.\n' +
      '3. Si rien dans les instructions ne s\'y oppose, termine en invitant ' +
      'à envoyer un message privé.\n' +
      '   Exemples: "Envoie-nous un message pour plus de détails."\n' +
      '   En malgache: "Mandefa hafatra taminay mba ahafantarana bebe kokoa."\n' +
      '4. INTERDIT (sauf instruction contraire explicite ci-dessus): donner ' +
      'prix, stock, délai, ou détails complets.\n' +
      '5. INTERDIT: listes numérotées, émojis excessifs.\n' +
      `6. Ton: ${this.toneLabel(ctx.tone)}.`,
    );

    parts.push(this.languageRule(ctx.replyLanguage, commentLang));

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
   *
   * FIX — empty post caption handling: same approach as
   * buildPublicCommentReplyPrompt() — when the post has no caption,
   * customInstructions become the primary context anchor instead of
   * being silently dropped.
   */
  buildPrivateDmReplyPrompt(
    ctx:                CommentBusinessContext,
    postCaption:        string,
    commentText:        string,
    customInstructions: string | null,
    images:             CommentReferenceImage[],
    commentLang:        DetectedLanguage,
    ruleContext?:       string,
  ): string {
    const parts: string[] = [];
    const trimmedCaption = postCaption.trim();
    const trimmedInstructions = customInstructions?.trim() || null;

    // Identity
    parts.push(
      `Tu es l'assistant de "${ctx.businessName}".` +
      (ctx.description ? `\n${ctx.description}` : ''),
    );

    if (ctx.systemPrompt?.trim()) parts.push(ctx.systemPrompt.trim());

    if (ruleContext) {
      parts.push(
        'RÈGLE CONFIGURÉE PAR LE PROPRIÉTAIRE DE LA PAGE:\n' + ruleContext,
      );
    }

    // Context — brief, no reproduction of comment
    parts.push(
      'CONTEXTE:\n' +
      'Tu envoies un MESSAGE PRIVÉ Facebook à quelqu\'un qui vient de commenter ton post.\n' +
      (trimmedCaption
        ? `Post: "${trimmedCaption.slice(0, 150)}"\n`
        : "Ce post Facebook n'a pas de légende — ne le mentionne pas.\n") +
      'Tu ouvres TOI-MÊME cette conversation privée avec lui.',
    );

    if (trimmedInstructions) {
      parts.push(
        'INSTRUCTIONS SPÉCIFIQUES À CE POST (PRIORITÉ ABSOLUE — à suivre ' +
        'littéralement):\n' + trimmedInstructions,
      );
    }

    // Strict rules for private DM opener
    parts.push(
      'RÈGLES — MESSAGE PRIVÉ D\'OUVERTURE:\n' +
      '1. 2 à 3 phrases MAXIMUM, sauf si les instructions ci-dessus imposent ' +
      'un contenu exact différent.\n' +
      '2. Message chaleureux — tu prends l\'initiative de le contacter.\n' +
      '3. Montre que tu as vu son commentaire (sans le citer mot pour mot).\n' +
      '4. Propose de l\'aider DANS CETTE CONVERSATION.\n' +
      '5. *** INTERDIT (sauf instruction contraire explicite ci-dessus): dire ' +
      '"envoie-nous un DM" ou "contacte-nous en privé".\n' +
      '   Tu ES DÉJÀ en message privé. Rediriger vers un DM est absurde. ***\n' +
      '6. INTERDIT: listes numérotées, étapes, tutoriels, prix sans qu\'on te le demande.\n' +
      '7. INTERDIT: reproduire le contenu du post.',
    );

    parts.push(this.languageRule(ctx.replyLanguage, commentLang));

    if (images.length > 0) {
      parts.push(
        'Produits disponibles:\n' +
        images.slice(0, 3).map((i) => `- ${i.description}`).join('\n'),
      );
    }

    parts.push('FORMAT: Texte brut. Commence directement. Pas de liste.');

    return parts.join('\n\n');
  }

  // ─── AI suggestion for config form fields ─────────────────────────────────

  /**
   * Builds a system prompt that asks the model to draft/improve a single
   * PostAiConfig field (the fixed private DM message, or the post's custom
   * instructions), taking the CURRENT field content into account.
   *
   * Used by the "✨ Suggestion IA" button in the post configuration panel.
   * The response must be ONLY the field content — no preamble, no quotes,
   * no markdown — so it can be inserted directly into the textarea.
   */
  buildFieldSuggestionPrompt(
    ctx:          CommentBusinessContext,
    field:        SuggestibleField,
    currentValue: string,
    postCaption:  string,
  ): string {
    const parts: string[] = [];
    const trimmedCaption = postCaption.trim();
    const trimmedCurrent = currentValue.trim();

    parts.push(
      `Tu aides "${ctx.businessName}" (${this.humanizeBusinessType(ctx.businessType)}) ` +
      'à rédiger un champ de configuration pour ses réponses automatiques Facebook.' +
      (ctx.description ? `\n${ctx.description}` : ''),
    );

    if (trimmedCaption) {
      parts.push(`CONTEXTE — Légende du post concerné:\n"${trimmedCaption.slice(0, 250)}"`);
    }

    if (field === 'privateReplyMessage') {
      parts.push(
        'CHAMP À RÉDIGER: "Message privé fixe" — envoyé automatiquement en ' +
        "message privé Facebook (DM) à toute personne qui commente ce post, " +
        "quand l'option DM automatique est activée.\n" +
        'RÈGLES:\n' +
        '1. 2 à 3 phrases MAXIMUM, chaleureuses, ton ' + this.toneLabel(ctx.tone) + '.\n' +
        "2. Tu OUVRES la conversation — ne dis jamais \"envoie-nous un DM\" " +
        '(ce message EST le DM).\n' +
        "3. Ne reproduis pas le contenu du post mot pour mot.\n" +
        '4. Pas de prix/stock/délai précis sauf si déjà donné dans le contexte.',
      );
    } else {
      parts.push(
        'CHAMP À RÉDIGER: "Instructions spécifiques à ce post" — instructions ' +
        "internes ajoutées au prompt de l'IA pour CE post précis (produit, " +
        'promotion, date limite, ton particulier, etc.). Ce texte n\'est PAS ' +
        'envoyé au client — il guide les réponses automatiques, et sera suivi ' +
        'littéralement par l\'IA.\n' +
        'RÈGLES:\n' +
        '1. 2 à 5 phrases courtes, format instructions claires (impératif).\n' +
        '2. Mentionne les informations utiles que le post seul ne donne pas ' +
        '(prix, date limite, conditions, produit exact, etc. si pertinent).\n' +
        "3. N'invente pas de prix ou de promesses si rien n'est fourni — " +
        "reste général dans ce cas (ex: \"Mets l'accent sur la qualité et " +
        'la disponibilité, redirige les questions de prix en message privé.").',
      );
    }

    if (trimmedCurrent) {
      parts.push(
        'BROUILLON ACTUEL (à améliorer, compléter ou reformuler — ne pars pas ' +
        'de zéro si ce contenu est déjà pertinent):\n' +
        `"""\n${trimmedCurrent.slice(0, 1000)}\n"""`,
      );
    } else {
      parts.push('Aucun brouillon existant — rédige depuis zéro.');
    }

    parts.push(
      'LANGUE: Français (sauf si le brouillon actuel est dans une autre langue, ' +
      'dans ce cas continue dans cette langue).\n' +
      'FORMAT DE SORTIE: Réponds UNIQUEMENT avec le texte du champ. ' +
      'Pas de guillemets, pas de préambule ("Voici…"), pas de markdown, ' +
      'pas de commentaire sur ta proposition.',
    );

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

  private humanizeBusinessType(type: string): string {
    const map: Record<string, string> = {
      ECOMMERCE:     'boutique en ligne',
      RESTAURANT:    'restaurant',
      RETAIL:        'commerce de détail',
      SERVICE:       'prestataire de services',
      REAL_ESTATE:   'agence immobilière',
      HEALTH:        'professionnel de santé',
      EDUCATION:     'établissement éducatif',
      ENTERTAINMENT: 'entreprise de divertissement',
      OTHER:         'entreprise',
    };
    return map[type.toUpperCase()] ?? 'entreprise';
  }
}
