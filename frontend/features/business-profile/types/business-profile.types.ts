/**
 * @file features/business-profile/types/business-profile.types.ts
 * Types for the business profile feature.
 * - WhatsApp removed
 * - API response types added
 * - ReferencePreset added for AI image sending
 */

export type BusinessType  = 'HAIR_SALON' | 'RESTAURANT' | 'FREELANCER' | 'SHOP' | 'SERVICE' | 'OTHER';
export type Tone          = 'FRIENDLY' | 'PROFESSIONAL' | 'FORMAL';
export type ResponseStyle = 'SHORT' | 'DETAILED' | 'MIXED';

/** Local form state (what the user edits in the UI). */
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
  // WhatsApp removed
}

/** Template used in the template picker. */
export interface Template extends Omit<BusinessProfileForm, 'facebookPageId'> {
  label:       string;
  /** undefined = hardcoded template, string = saved profile ID */
  profileId?:  string;
  isUserSaved?: boolean;
}

/** Reference image from a preset (used by AI to send to clients). */
export interface ReferenceImageDto {
  id:          string;
  url:         string;
  description: string;
  sortOrder:   number;
}

export interface ReferencePresetDto {
  id:          string;
  name:        string;
  description: string;
  images:      ReferenceImageDto[];
}

/** Lightweight summary for the profile switcher. */
export interface BusinessProfileSummaryDto {
  id:               string;
  name:             string;
  businessType:     string;
  facebookPageId:   string | null;
  facebookPageName: string | null;
  autoReply:        boolean;
  updatedAt:        string;
}

/** Full profile response from the API. */
export interface BusinessProfileResponseDto {
  id:                  string;
  name:                string;
  businessType:        string;
  description:         string | null;
  tone:                string;
  responseStyle:       string;
  autoReply:           boolean;
  aiInstructions:      string | null;
  commentInstructions: string | null;
  facebookPageId:      string | null;
  facebookPageName:    string | null;
  referencePresets:    ReferencePresetDto[];
  updatedAt:           string;
}

/** Sent to the API on save. */
export interface UpdateBusinessProfileDto {
  name?:               string;
  businessType?:       BusinessType;
  description?:        string;
  tone?:               Tone;
  responseStyle?:      ResponseStyle;
  autoReply?:          boolean;
  aiInstructions?:     string;
  commentInstructions?: string;
}

export interface ToneOption          { value: Tone;          label: string; desc: string; }
export interface StyleOption         { value: ResponseStyle;  label: string; desc: string; }
export interface BusinessTypeOption  { value: BusinessType;   label: string; }
