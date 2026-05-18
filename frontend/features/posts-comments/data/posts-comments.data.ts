/**
 * @file features/posts-comments/data/posts-comments.data.ts
 * Static reference data only. All dynamic data comes from the backend.
 */

// ─── Photo gradients (CSS only, no external images) ──────────────────────────

export const PHOTO_GRADIENTS = [
  "linear-gradient(135deg, oklch(0.52 0.24 256 / 28%) 0%, oklch(0.45 0.22 280 / 22%) 100%)",
  "linear-gradient(135deg, oklch(0.55 0.18 155 / 28%) 0%, oklch(0.48 0.20 170 / 22%) 100%)",
  "linear-gradient(135deg, oklch(0.62 0.20 50  / 28%) 0%, oklch(0.55 0.22 30  / 22%) 100%)",
  "linear-gradient(135deg, oklch(0.58 0.20 310 / 28%) 0%, oklch(0.50 0.22 290 / 22%) 100%)",
] as const;

// ─── Recharts chart config ────────────────────────────────────────────────────

export const BAR_CHART_CONFIG = {
  aiEnabled: { label: "IA activée",   color: "oklch(0.52 0.24 256)" },
  aiOff:     { label: "IA désactivée", color: "oklch(0.75 0.03 255 / 25%)" },
  comments:  { label: "Commentaires", color: "oklch(0.52 0.24 256 / 60%)" },
};
