/**
 * @file features/business-profile/types/business-profile.types.ts
 * Types and static data for the business profile feature.
 * Mirrors the Prisma schema enums.
 */

/* ─────────────────────────────────────────────
   Enums (mirror Prisma)
───────────────────────────────────────────── */
export type BusinessType   = "HAIR_SALON" | "RESTAURANT" | "FREELANCER" | "SHOP" | "SERVICE" | "OTHER";
export type Tone           = "FRIENDLY" | "PROFESSIONAL" | "FORMAL";
export type ResponseStyle  = "SHORT" | "DETAILED" | "MIXED";

/* ─────────────────────────────────────────────
   Business profile state shape
───────────────────────────────────────────── */
export interface BusinessProfileForm {
  name:                string;
  businessType:        BusinessType;
  description:         string;
  tone:                Tone;
  responseStyle:       ResponseStyle;
  autoReply:           boolean;
  aiInstructions:      string;
  commentInstructions: string;
  facebookPageId:      string;
  whatsappNumber:      string;
}

/* ─────────────────────────────────────────────
   Template
───────────────────────────────────────────── */
export interface Template extends Omit<BusinessProfileForm, "autoReply" | "facebookPageId" | "whatsappNumber"> {
  label: string;
}

/* ─────────────────────────────────────────────
   UI option shapes
───────────────────────────────────────────── */
export interface ToneOption {
  value: Tone;
  label: string;
  desc:  string;
}

export interface StyleOption {
  value: ResponseStyle;
  label: string;
  desc:  string;
}

export interface BusinessTypeOption {
  value: BusinessType;
  label: string;
}
