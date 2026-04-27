// ─── Easing ───────────────────────────────────────────────────────────────────
// Custom cubic-bezier: fast start, gentle overshoot, snappy settle
export const EASE = [0.22, 1, 0.36, 1] as const;

// ─── fadeUp ───────────────────────────────────────────────────────────────────
// For direct motion props (initial / animate).
// Improved: more y-travel, stronger blur entrance, longer settle for elegance.
export const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 28, filter: "blur(10px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  transition: { duration: 0.75, ease: EASE, delay },
});

// ─── fadeUpVariant ────────────────────────────────────────────────────────────
// Variant-compatible (hidden / visible) version — use inside stagger containers
// or with whileInView. Pass directly as `variants={fadeUpVariant}` on children.
export const fadeUpVariant = {
  hidden: { opacity: 0, y: 28, filter: "blur(10px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.75, ease: EASE },
  },
};

// ─── stagger ─────────────────────────────────────────────────────────────────
// Wrap a grid / list with this + initial="hidden" whileInView="visible".
// Children should use `fadeUpVariant`.
export const stagger = (delay = 0.08) => ({
  hidden: {},
  visible: { transition: { staggerChildren: delay, delayChildren: 0.05 } },
});

// ─── slideInLeft / slideInRight ───────────────────────────────────────────────
// For two-column panel entrances (brand panel ↔ form panel).
export const slideInLeft = {
  initial: { opacity: 0, x: -28, filter: "blur(8px)" },
  animate: { opacity: 1, x: 0, filter: "blur(0px)" },
  transition: { duration: 0.85, ease: EASE },
};

export const slideInRight = {
  initial: { opacity: 0, x: 28, filter: "blur(8px)" },
  animate: { opacity: 1, x: 0, filter: "blur(0px)" },
  transition: { duration: 0.85, ease: EASE },
};

// ─── scaleIn ─────────────────────────────────────────────────────────────────
// Pop-in for icons, badges, and success states.
export const scaleIn = (delay = 0) => ({
  initial: { opacity: 0, scale: 0.72, filter: "blur(4px)" },
  animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
  transition: { duration: 0.5, ease: EASE, delay },
});

// ─── heroFade ────────────────────────────────────────────────────────────────
// Above-the-fold hero elements — slightly heavier travel than section fadeUp.
export const heroFade = (delay = 0) => ({
  initial: { opacity: 0, y: 36, filter: "blur(12px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  transition: { duration: 0.9, ease: EASE, delay },
});

// ─── fadeIn ──────────────────────────────────────────────────────────────────
// Opacity-only — for trust bars, subtle overlays, delayed reveals.
export const fadeIn = (delay = 0) => ({
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.55, ease: EASE, delay },
});
