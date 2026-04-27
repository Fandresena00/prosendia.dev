// ─── Layout decorators ────────────────────────────────────────────────────────
// Stateless, zero-dependency visual primitives used at page level.

// Fixed dot-grid background — sits behind all content.
export function DotGrid() {
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

// Full-width gradient rule between sections.
export function Divider() {
  return (
    <div className="mx-auto max-w-6xl px-6">
      <div className="h-px bg-linear-to-r from-transparent via-border/60 to-transparent" />
    </div>
  );
}
