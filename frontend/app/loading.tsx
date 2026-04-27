export default function Loading() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "18px",
        pointerEvents: "none",
      }}
    >
      <style>{`
        @keyframes orbit-outer {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes orbit-inner {
          from { transform: rotate(0deg); }
          to   { transform: rotate(-360deg); }
        }
        @keyframes pulse-core {
          0%, 100% { transform: translate(-50%, -50%) scale(1);    opacity: 1; }
          50%       { transform: translate(-50%, -50%) scale(1.22); opacity: 0.60; }
        }
        @keyframes glow-ring {
          0%, 100% { opacity: 0.22; transform: scale(1); }
          50%       { opacity: 0.06; transform: scale(1.04); }
        }
        @keyframes blink-dot {
          0%, 100% { opacity: 0.20; }
          50%       { opacity: 1; }
        }
        .loader-outer { animation: orbit-outer 2.4s linear infinite; }
        .loader-inner { animation: orbit-inner 1.6s linear infinite; }
        .loader-core  { animation: pulse-core  1.8s ease-in-out infinite; }
        .loader-glow  { animation: glow-ring   2.2s ease-in-out infinite; }
        .blink-1 { animation: blink-dot 1.4s ease-in-out infinite 0.00s; }
        .blink-2 { animation: blink-dot 1.4s ease-in-out infinite 0.22s; }
        .blink-3 { animation: blink-dot 1.4s ease-in-out infinite 0.44s; }
      `}</style>

      {/* ── Orbital spinner ── */}
      <div style={{ position: "relative", width: 56, height: 56 }}>

        {/* Outer glow ring */}
        <div
          className="loader-glow"
          style={{
            position: "absolute",
            inset: -3,
            borderRadius: "50%",
            border: "1.5px solid oklch(0.52 0.24 256 / 38%)",
          }}
        />

        {/* Outer orbit track */}
        <div
          style={{
            position: "absolute",
            inset: 5,
            borderRadius: "50%",
            border: "1px solid oklch(0.52 0.24 256 / 11%)",
          }}
        />

        {/* Outer dot — primary blue, clockwise */}
        <div className="loader-outer" style={{ position: "absolute", inset: 5 }}>
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: 0,
              transform: "translateY(-50%) translateX(-50%)",
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "oklch(0.52 0.24 256)",
              boxShadow: "0 0 10px 3px oklch(0.52 0.24 256 / 65%)",
            }}
          />
        </div>

        {/* Inner orbit track — emerald tint */}
        <div
          style={{
            position: "absolute",
            inset: 15,
            borderRadius: "50%",
            border: "1px solid oklch(0.70 0.18 162 / 16%)",
          }}
        />

        {/* Inner dot — emerald, counter-clockwise */}
        <div className="loader-inner" style={{ position: "absolute", inset: 15 }}>
          <div
            style={{
              position: "absolute",
              top: 0,
              left: "50%",
              transform: "translateX(-50%) translateY(-50%)",
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "oklch(0.70 0.18 162)",
              boxShadow: "0 0 7px 2px oklch(0.70 0.18 162 / 65%)",
            }}
          />
        </div>

        {/* Pulsing core — blue gradient */}
        <div
          className="loader-core"
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: 11,
            height: 11,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, oklch(0.65 0.20 256) 0%, oklch(0.45 0.24 256) 100%)",
            boxShadow: "0 0 14px 3px oklch(0.52 0.24 256 / 50%)",
          }}
        />
      </div>

      {/* ── Label — dot 2 is emerald ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
        <span
          style={{
            fontSize: "11px",
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            fontWeight: 500,
            letterSpacing: "0.05em",
            color: "oklch(0.55 0.015 286)",
          }}
        >
          Chargement
        </span>
        <span style={{ display: "flex", gap: "3px", marginTop: "1px" }}>
          {(["blink-1", "blink-2", "blink-3"] as const).map((cls) => (
            <span
              key={cls}
              className={cls}
              style={{
                display: "block",
                width: "3px",
                height: "3px",
                borderRadius: "50%",
                background:
                  cls === "blink-2"
                    ? "oklch(0.70 0.18 162)"   /* emerald middle dot */
                    : "oklch(0.52 0.24 256)",  /* blue outer dots    */
              }}
            />
          ))}
        </span>
      </div>
    </div>
  );
}