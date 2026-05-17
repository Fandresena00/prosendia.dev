/**
 * @file features/ai/services/prompt-builder.service.ts
 *
 * REWRITE — key improvements:
 *
 * 1. ANTI-HALLUCINATION
 *    The AI was inventing services like "conseil stratégique", "gestion de projets",
 *    "support technique" — completely made up. New strict rule: ONLY use what is
 *    explicitly provided in the business context. Never invent anything.
 *
 * 2. LANGUAGE DETECTION — MALAGASY + FRENCH
 *    Madagascar market reality: customers write in Malagasy, French, or a natural
 *    mix of both. The AI must:
 *      - Pure Malagasy → reply in Malagasy (French only for technical terms)
 *      - Pure French   → reply in French
 *      - Mixed         → Malagasy base, French for complex/technical words only
 *    Never add "Note: I can also communicate in Malagasy" or similar disclaimers.
 *
 * 3. CTA STRATEGY
 *    Primary goal: keep comment replies SHORT (1-2 sentences) and always
 *    guide customers toward sending a DM for details. Never give full
 *    quotes/prices/availability in public comments.
 *
 * 4. TOKEN OPTIMIZATION
 *    Prompts are shorter and focused. Each section is conditional (only included
 *    when non-empty). The context window stays lean.
 *
 * 5. EMPTY BUSINESS CONTEXT GUARD
 *    When business description / system prompt is missing, the AI says
 *    "Envoyer nous un DM" rather than inventing a service catalogue.
 */

import { Injectable } from '@nestjs/common';

export interface BusinessContext {
  businessName:        string;
  businessType:        string;
  description:         string | null;
  tone:                string;
  responseStyle:       string;
  replyLanguage:       string | null;
  systemPrompt:        string | null;
  inboxInstructions:   string | null;
  personalizeGreeting: boolean;
  blockedKeywords:     string[];
  allowedTopics:       string[];
  escalationThreshold: number;
}

export interface ReferenceImage {
  url:         string;
  description: string;
}

export interface ContextMessage {
  sender:   'client' | 'ai' | 'page' | 'human';
  content:  string | null;
  imageUrl?: string | null;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class PromptBuilderService {

  // ─── ReplyAI — Messenger inbox ────────────────────────────────────────────

  buildReplySystemPrompt(
    ctx: BusinessContext,
    referenceImages: ReferenceImage[],
  ): string {
    const sections: string[] = [];

    // ── 1. Identity ──────────────────────────────────────────────────────────
    const businessTypeLabel = this.humanizeBusinessType(ctx.businessType);
    sections.push(
      `Tu es l'assistant IA de "${ctx.businessName}"` +
      (businessTypeLabel ? `, un(e) ${businessTypeLabel}` : '') + '.' +
      (ctx.description ? `\n${ctx.description}` : ''),
    );

    // ── 2. Custom system prompt (user-defined — highest priority) ────────────
    if (ctx.systemPrompt?.trim()) {
      sections.push(ctx.systemPrompt.trim());
    }

    // ── 3. ANTI-HALLUCINATION — most important rule ──────────────────────────
    sections.push(
      'RÈGLE ABSOLUE — NE JAMAIS INVENTER:\n' +
      '- Parle UNIQUEMENT des services, produits et informations mentionnés dans ce contexte.\n' +
      '- Si le client demande quelque chose qui n\'est pas mentionné ici → redirige vers le DM : "Envoie-nous un message privé pour plus de détails."\n' +
      '- Ne propose JAMAIS de services inventés, de prix ou de disponibilités non confirmés.\n' +
      '- N\'écris JAMAIS de liste numérotée de services que tu ne connais pas avec certitude.\n' +
      '- Mieux vaut inviter à contacter que d\'inventer.',
    );

    // ── 4. Language — Malagasy / French / mixed ──────────────────────────────
    if (ctx.replyLanguage) {
      // Fixed language set by owner
      const langLabel = ctx.replyLanguage === 'mg' ? 'malgache' :
                        ctx.replyLanguage === 'fr' ? 'français' : ctx.replyLanguage;
      sections.push(`LANGUE: Réponds toujours en ${langLabel}.`);
    } else {
      sections.push(
        'LANGUE — RÈGLES STRICTES (marché malgache):\n' +
        '- Client écrit en MALGACHE pur → réponds en malgache. Utilise le français UNIQUEMENT pour les termes techniques sans équivalent malgache.\n' +
        '- Client écrit en FRANÇAIS pur → réponds entièrement en français.\n' +
        '- Client mélange malgache + français → réponds en malgache comme base, avec les mots techniques en français. Exemple: "Ny vidiny dia 50 000 Ar. Afaka alefa DM isika mba hanazavana bebe kokoa."\n' +
        '- Ne dis JAMAIS "Note: je peux aussi communiquer en malgache" ou équivalent.\n' +
        '- Ne commente JAMAIS sur la langue utilisée.\n' +
        '- Ne change JAMAIS de langue spontanément sans que le client le fasse d\'abord.',
      );
    }

    // ── 5. Tone & style ──────────────────────────────────────────────────────
    const toneLabel =
      ctx.tone === 'FRIENDLY'     ? 'chaleureux et accessible'     :
      ctx.tone === 'PROFESSIONAL' ? 'professionnel et direct'       :
      'formel et respectueux';

    const styleRule =
      ctx.responseStyle === 'SHORT'    ? 'Réponds brièvement (1-2 phrases max).' :
      ctx.responseStyle === 'DETAILED' ? 'Tu peux donner des réponses détaillées.' :
      'Adapte la longueur à la complexité de la question (court = simple, plus long = question complexe).';

    sections.push(`TON: ${toneLabel}. ${styleRule}`);

    if (ctx.personalizeGreeting) {
      sections.push('Utilise le prénom du client naturellement quand disponible (une seule fois, jamais de façon forcée).');
    }

    // ── 6. Topic filter ──────────────────────────────────────────────────────
    if (ctx.allowedTopics.length > 0) {
      sections.push(
        `Réponds UNIQUEMENT aux sujets liés à: ${ctx.allowedTopics.join(', ')}.\n` +
        'Pour tout autre sujet → redirige poliment vers le DM.',
      );
    }

    if (ctx.blockedKeywords.length > 0) {
      sections.push(
        `Si le client mentionne: ${ctx.blockedKeywords.join(', ')} → réponds UNIQUEMENT: ESCALATE: <raison courte>`,
      );
    }

    // ── 7. Inbox-specific instructions ───────────────────────────────────────
    if (ctx.inboxInstructions?.trim()) {
      sections.push(ctx.inboxInstructions.trim());
    }

    // ── 8. Reference images / product catalogue ───────────────────────────────
    if (referenceImages.length > 0) {
      const catalogue = referenceImages
        .map((img, i) => `[${i + 1}] ${img.description}: ${img.url}`)
        .join('\n');

      sections.push(
        'IMAGES PRODUITS DISPONIBLES:\n' +
        catalogue + '\n\n' +
        'Règles images:\n' +
        '- Inclus une image UNIQUEMENT si directement pertinente à la demande du client.\n' +
        '- Format exact: [IMAGE: url] sur sa propre ligne après le texte.\n' +
        '- Ne modifie jamais les URLs. N\'invente pas d\'images.',
      );
    }

    // ── 9. CTA strategy ──────────────────────────────────────────────────────
    sections.push(
      'STRATÉGIE DE RÉPONSE:\n' +
      '- Objectif principal: amener le client à envoyer un DM pour les détails.\n' +
      '- Ne donne pas de prix, devis ou disponibilités dans les commentaires — invite au DM.\n' +
      '- Sois court et direct. Pas de listes numérotées non demandées.',
    );

    // ── 10. Escalation ───────────────────────────────────────────────────────
    sections.push(
      'ESCALADE:\n' +
      `- Si confiance < ${Math.round(ctx.escalationThreshold * 100)}% → réponds UNIQUEMENT: ESCALATE: <raison>\n` +
      '- Plainte, remboursement, commande spéciale, données personnelles → ESCALATE seulement.\n' +
      '- Une seule courte excuse par conversation maximum.',
    );

    // ── 11. Format ───────────────────────────────────────────────────────────
    sections.push(
      'FORMAT:\n' +
      '- Texte brut uniquement (pas de markdown, pas de gras, pas d\'italique).\n' +
      '- Commence directement par la réponse (pas de "Bien sûr !", pas de répétition de la question).\n' +
      '- Pas de liste numérotée sauf si le client en demande une.',
    );

    return sections.join('\n\n');
  }

  // ─── ReplyAI — Post comment reply ─────────────────────────────────────────

  /**
   * Shorter, CTA-focused prompt for replying to Facebook post comments.
   * Comments are public — never give prices, always redirect to DM.
   */
  buildCommentReplySystemPrompt(
    ctx: BusinessContext,
    postCaption: string,
    customInstructions: string | null,
    referenceImages: ReferenceImage[],
  ): string {
    const sections: string[] = [];

    const businessTypeLabel = this.humanizeBusinessType(ctx.businessType);
    sections.push(
      `Tu es l'assistant de "${ctx.businessName}"` +
      (businessTypeLabel ? ` (${businessTypeLabel})` : '') + '.\n' +
      (ctx.description ? ctx.description : ''),
    );

    if (ctx.systemPrompt?.trim()) {
      sections.push(ctx.systemPrompt.trim());
    }

    sections.push(
      'CONTEXTE DU POST FACEBOOK:\n' + postCaption,
    );

    sections.push(
      'RÈGLES STRICTES POUR LES COMMENTAIRES PUBLICS:\n' +
      '- Réponse courte: 1-2 phrases MAXIMUM.\n' +
      '- JAMAIS de prix, stock, devis ou disponibilités dans les commentaires.\n' +
      '- Toujours terminer par une invitation au DM: "Envoyez-nous un message privé 📩" ou "Alefa DM 📩" (selon la langue).\n' +
      '- Ne propose JAMAIS de services non mentionnés dans ce contexte.\n' +
      '- N\'invente aucune information.',
    );

    // Language rules (same as inbox but shorter)
    if (ctx.replyLanguage) {
      const langLabel = ctx.replyLanguage === 'mg' ? 'malgache' :
                        ctx.replyLanguage === 'fr' ? 'français' : ctx.replyLanguage;
      sections.push(`LANGUE: ${langLabel}.`);
    } else {
      sections.push(
        'LANGUE: Détecte et utilise la langue du commentaire (malgache, français, ou mélange). ' +
        'Ne commente jamais sur la langue.',
      );
    }

    if (customInstructions?.trim()) {
      sections.push(customInstructions.trim());
    }

    if (referenceImages.length > 0) {
      sections.push(
        'Produits/services disponibles:\n' +
        referenceImages.map((img) => `- ${img.description}`).join('\n'),
      );
    }

    sections.push(
      'ESCALADE: Si le commentaire est une plainte ou nécessite une intervention humaine → ' +
      'réponds UNIQUEMENT: ESCALATE: <raison>',
    );

    return sections.join('\n\n');
  }

  /**
   * Prompt for generating a PRIVATE REPLY (DM sent in response to a comment).
   * More detailed than the public comment reply since it's a private conversation.
   */
  buildPrivateReplyPrompt(
    ctx: BusinessContext,
    postCaption: string,
    commentText: string,
    customInstructions: string | null,
    referenceImages: ReferenceImage[],
  ): string {
    const sections: string[] = [];

    const businessTypeLabel = this.humanizeBusinessType(ctx.businessType);
    sections.push(
      `Tu es l'assistant de "${ctx.businessName}"` +
      (businessTypeLabel ? ` (${businessTypeLabel})` : '') + '.\n' +
      (ctx.description ? ctx.description : ''),
    );

    if (ctx.systemPrompt?.trim()) {
      sections.push(ctx.systemPrompt.trim());
    }

    sections.push(
      'CONTEXTE: Le client vient de commenter ce post Facebook:\n' +
      `Post: ${postCaption}\n` +
      `Commentaire: ${commentText}\n\n` +
      'Tu envoies un MESSAGE PRIVÉ en réponse à ce commentaire.',
    );

    sections.push(
      'RÈGLES DU MESSAGE PRIVÉ:\n' +
      '- 2-4 phrases maximum. Sois chaleureux et utile.\n' +
      '- Tu peux mentionner le sujet du commentaire et proposer de l\'aide spécifique.\n' +
      '- Si tu as des informations sur les produits/services → tu peux les mentionner brièvement.\n' +
      '- Invite à répondre dans cette conversation pour continuer.\n' +
      '- JAMAIS d\'inventions — seulement les infos présentes dans ce contexte.',
    );

    if (ctx.replyLanguage) {
      const langLabel = ctx.replyLanguage === 'mg' ? 'malgache' :
                        ctx.replyLanguage === 'fr' ? 'français' : ctx.replyLanguage;
      sections.push(`LANGUE: ${langLabel}.`);
    } else {
      sections.push('LANGUE: Utilise la même langue que le commentaire du client.');
    }

    if (customInstructions?.trim()) {
      sections.push(customInstructions.trim());
    }

    if (referenceImages.length > 0) {
      const catalogue = referenceImages
        .map((img) => `- ${img.description}: ${img.url}`)
        .join('\n');
      sections.push('Produits/services avec images:\n' + catalogue);
    }

    sections.push(
      'FORMAT: Texte brut uniquement. Commence directement. Pas de liste non demandée.\n' +
      'Si image pertinente: [IMAGE: url] sur sa propre ligne.',
    );

    return sections.join('\n\n');
  }

  // ─── Message array builder ─────────────────────────────────────────────────

  buildReplyMessages(
    systemPrompt:  string,
    summary:       string | null,
    recentMsgs:    ContextMessage[],
    inboundText:   string,
  ): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    if (summary) {
      messages.push({
        role:    'user',
        content: `[Résumé de la conversation]\n${summary}`,
      });
      messages.push({
        role:    'assistant',
        content: '[Résumé pris en compte.]',
      });
    }

    for (const msg of recentMsgs) {
      if (!msg.content && !msg.imageUrl) continue;
      const text       = msg.content ?? '';
      const imageNote  = msg.imageUrl ? ` [image: ${msg.imageUrl}]` : '';
      const fullContent = (text + imageNote).trim();
      if (!fullContent) continue;
      const isAgent = msg.sender === 'ai' || msg.sender === 'page' || msg.sender === 'human';
      messages.push({ role: isAgent ? 'assistant' : 'user', content: fullContent });
    }

    messages.push({ role: 'user', content: inboundText });
    return messages;
  }

  // ─── DataAI summary prompt ────────────────────────────────────────────────

  buildSummaryPrompt(messages: ContextMessage[], clientName: string | null): string {
    const lines = messages
      .filter((m) => m.content || m.imageUrl)
      .map((m) => {
        const who     = m.sender === 'client' ? (clientName ?? 'Client') : 'Business';
        const content = m.content ?? '';
        const img     = m.imageUrl ? ' [image]' : '';
        return `${who}: ${content}${img}`;
      })
      .join('\n');

    return (
      'Résume cette conversation en ≤80 mots. Troisième personne. Factuel.\n' +
      'Couvre: intention du client, infos échangées, questions non résolues, sentiment général.\n' +
      'Pas d\'opinions, pas de salutations.\n\n' +
      'CONVERSATION:\n' + lines + '\n\nRÉSUMÉ:'
    );
  }

  // ─── Comment spam filter ──────────────────────────────────────────────────

  /**
   * Determines if a comment is worth responding to.
   * Returns a score 0-100 and a reason.
   * Pure heuristic — no AI needed, saves tokens.
   *
   * Rules:
   *   > 60 → worth replying (useful/question/interest)
   *   30-60 → borderline (use with caution)
   *   < 30  → skip (spam/noise)
   */
  scoreComment(commentText: string): { score: number; reason: string; shouldReply: boolean } {
    const text = commentText.trim().toLowerCase();
    let score = 50; // neutral baseline

    // ── Spam signals (reduce score) ──────────────────────────────────────────

    // Only emojis or very short
    const noEmojiText = text.replace(/[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim();
    if (!noEmojiText) return { score: 5, reason: 'emojis uniquement', shouldReply: false };
    if (noEmojiText.split(/\s+/).length < 2) return { score: 15, reason: 'trop court', shouldReply: false };

    // Repeated characters (aaaa, heyyy, woooo)
    if (/(.)\1{4,}/u.test(text)) score -= 25;

    // All caps + exclamation spam
    if (/^[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ\s!]{10,}$/.test(commentText)) score -= 20;

    // Competitor promotion / spam links
    if (/https?:\/\//.test(text)) score -= 30;
    if (/whatsapp|telegram|www\.|\.com|\.mg/.test(text)) score -= 20;

    // Tag spam (tagging many people)
    const tagCount = (text.match(/@/g) || []).length;
    if (tagCount > 2) score -= 20;

    // ── Quality signals (increase score) ─────────────────────────────────────

    // Questions
    if (text.includes('?')) score += 20;

    // Purchase/interest keywords — French
    const frKeywords = [
      'prix', 'combien', 'disponible', 'commande', 'livraison', 'délai',
      'infos', 'renseignement', 'intéressé', 'acheter', 'contact',
      'comment', 'payer', 'vendre', 'service',
    ];
    const frMatches = frKeywords.filter((k) => text.includes(k)).length;
    score += frMatches * 12;

    // Purchase/interest keywords — Malagasy
    const mgKeywords = [
      'vidiny', 'firy', 'misy', 'azonao', 'manao', 'mba', 'azafady',
      'manahoana', 'misoatra', 'tena', 'omeo', 'ampitao', 'maniry',
      'hividy', 'hividiana', 'mila',
    ];
    const mgMatches = mgKeywords.filter((k) => text.includes(k)).length;
    score += mgMatches * 12;

    // Compliments (worth acknowledging but no need for detailed reply)
    const compliments = ['super', 'bravo', 'bien', 'top', 'excellent', 'magnifique', 'tsara', 'mamy'];
    if (compliments.some((c) => text.includes(c))) score += 5;

    // Negative/complaint (should escalate, not ignore)
    const negatives = ['nul', 'arnaque', 'mauvais', 'problème', 'rembours', 'plainte', 'menteur'];
    if (negatives.some((n) => text.includes(n))) score += 15; // still worth responding

    // Clamp to [0, 100]
    score = Math.max(0, Math.min(100, score));

    const reason =
      score >= 60 ? 'commentaire utile (question ou intérêt d\'achat)' :
      score >= 30 ? 'commentaire borderline' :
      'commentaire bruit/spam';

    return { score, reason, shouldReply: score >= 60 };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private humanizeBusinessType(type: string): string {
    const map: Record<string, string> = {
      HAIR_SALON:  'salon de coiffure',
      RESTAURANT:  'restaurant',
      FREELANCER:  'freelance',
      SHOP:        'boutique',
      SERVICE:     'prestataire de services',
      OTHER:       '',
    };
    return map[type] ?? '';
  }
}
