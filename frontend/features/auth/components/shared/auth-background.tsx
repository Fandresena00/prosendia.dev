"use client";

/** Dot-grid overlay — fixed, full viewport, pointer-events:none */
export function AuthDotGrid() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0"
      style={{
        backgroundImage: `radial-gradient(circle, oklch(0.52 0.24 256 / 0.04) 1px, transparent 1px)`,
        backgroundSize: "28px 28px",
      }}
    />
  );
}

/** Centered radial glow — used on single-column auth pages */
export function AuthRadialGlow() {
  return (
    <div
      className="pointer-events-none fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      style={{
        width: 500,
        height: 400,
        background:
          "radial-gradient(ellipse, oklch(0.52 0.24 256 / 0.07) 0%, transparent 70%)",
      }}
    />
  );
}
