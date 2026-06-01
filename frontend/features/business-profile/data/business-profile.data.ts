/**
 * @file features/business-profile/data/business-profile.data.ts
 *
 * CHANGES:
 *  - Templates now include `autoReply` (required by updated Template type)
 *  - WhatsApp removed from all data structures
 */

import type {
  BusinessTypeOption,
  StyleOption,
  Template,
  ToneOption,
} from "../types/business-profile.types";

// ─── Default templates ────────────────────────────────────────────────────────

export const TEMPLATES: Template[] = [
  {
    label:               "Salon de coiffure",
    businessType:        "HAIR_SALON",
    name:                "Mon Salon",
    description:         "Salon de coiffure proposant coupes, colorations et soins capillaires.",
    tone:                "FRIENDLY",
    responseStyle:       "SHORT",
    autoReply:           true,
    aiInstructions:
      "Tu es l'assistant du salon. Propose toujours un rendez-vous. Réponds en français et/ou malagasy. Sois chaleureux et concis. Ne confirme jamais un RDV sans vérification.",
    commentInstructions:
      "Pour chaque commentaire sur les posts, réponds avec un emoji coiffure et propose de contacter en MP pour prendre RDV.",
  },
  {
    label:               "Restaurant",
    businessType:        "RESTAURANT",
    name:                "Mon Restaurant",
    description:         "Restaurant proposant des plats locaux et internationaux, livraison disponible.",
    tone:                "FRIENDLY",
    responseStyle:       "MIXED",
    autoReply:           true,
    aiInstructions:
      "Tu es l'assistant du restaurant. Partage toujours le menu du jour. Propose la réservation ou la livraison. Réponds rapidement et avec enthousiasme pour la nourriture.",
    commentInstructions:
      "Réponds avec appétit ! Mentionne les plats disponibles et les horaires. Invite à réserver ou commander.",
  },
  {
    label:               "Freelance / Agence",
    businessType:        "FREELANCER",
    name:                "Mon Activité",
    description:         "Services freelance en développement, design ou marketing digital.",
    tone:                "PROFESSIONAL",
    responseStyle:       "DETAILED",
    autoReply:           false,
    aiInstructions:
      "Tu es l'assistant commercial. Demande toujours le budget et les délais. Redirige vers le portfolio. Ne donne jamais de prix sans brief complet. Escalade les projets complexes.",
    commentInstructions:
      "Remercie pour l'intérêt, demande à contacter en MP pour discuter du projet en détail.",
  },
  {
    label:               "Boutique",
    businessType:        "SHOP",
    name:                "Ma Boutique",
    description:         "Boutique en ligne vendant des produits avec livraison à domicile.",
    tone:                "FRIENDLY",
    responseStyle:       "SHORT",
    autoReply:           true,
    aiInstructions:
      "Tu es l'assistant boutique. Propose toujours la livraison. Mentionne les promos actives. Ne donne pas de remise sans accord humain. Sois enthousiaste sur les produits.",
    commentInstructions:
      "Réponds avec enthousiasme, mentionne la disponibilité du produit, invite à écrire en MP pour commander.",
  },
  {
    label:               "Service / Autre",
    businessType:        "SERVICE",
    name:                "Mon Service",
    description:         "Prestation de services professionnels sur mesure.",
    tone:                "PROFESSIONAL",
    responseStyle:       "MIXED",
    autoReply:           false,
    aiInstructions:
      "Tu es l'assistant. Écoute le besoin du client, pose des questions clarificatrices. Escalade les réclamations à un agent humain. Sois professionnel et réactif.",
    commentInstructions:
      "Remercie pour le message, propose de contacter en MP pour obtenir plus d'informations et un devis personnalisé.",
  },
];

// ─── Option lists ─────────────────────────────────────────────────────────────

export const BUSINESS_TYPES: BusinessTypeOption[] = [
  { value: "HAIR_SALON",  label: "Salon de coiffure" },
  { value: "RESTAURANT",  label: "Restaurant" },
  { value: "FREELANCER",  label: "Freelance / Agence" },
  { value: "SHOP",        label: "Boutique" },
  { value: "SERVICE",     label: "Service professionnel" },
  { value: "OTHER",       label: "Autre" },
];

export const TONE_OPTIONS: ToneOption[] = [
  { value: "FRIENDLY",     label: "Amical",        desc: "Chaleureux et proche" },
  { value: "PROFESSIONAL", label: "Professionnel", desc: "Sérieux et clair" },
  { value: "FORMAL",       label: "Formel",        desc: "Officiel et structuré" },
];

export const STYLE_OPTIONS: StyleOption[] = [
  { value: "SHORT",    label: "Courtes",    desc: "1–2 phrases" },
  { value: "DETAILED", label: "Détaillées", desc: "Complètes et précises" },
  { value: "MIXED",    label: "Mixte",      desc: "S'adapte au contexte" },
];
