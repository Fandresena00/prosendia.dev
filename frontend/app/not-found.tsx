"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

const QUICK_LINKS = [
  { href: "/inbox",            icon: "💬", label: "Inbox",           desc: "Vos messages Facebook" },
  { href: "/accounts",         icon: "📄", label: "Pages Facebook",  desc: "Gérer vos connexions" },
  { href: "/business-profile", icon: "🏪", label: "Profil Business", desc: "Configurer votre IA" },
  { href: "/analytics",        icon: "📊", label: "Analytiques",     desc: "Statistiques et rapports" },
];

export default function NotFound() {
  const router = useRouter();

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      }}
    >
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-7px); }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .nf-float  { animation: float   3.2s ease-in-out infinite; }
        .nf-up-1   { animation: fade-up 0.4s ease-out 0.00s both; }
        .nf-up-2   { animation: fade-up 0.4s ease-out 0.10s both; }
        .nf-up-3   { animation: fade-up 0.4s ease-out 0.20s both; }
        .nf-up-4   { animation: fade-up 0.4s ease-out 0.30s both; }
        .ql-tile {
          display: flex; align-items: center; gap: 0.75rem;
          padding: 0.75rem 1rem; border-radius: 0.6rem;
          border: 1px solid oklch(0.92 0.004 286 / 80%);
          background: oklch(1 0 0 / 50%);
          text-decoration: none; cursor: pointer;
          transition: border-color 0.15s, background 0.15s;
        }
        .ql-tile:hover {
          border-color: oklch(0.52 0.24 256 / 35%);
          background: oklch(0.52 0.24 256 / 5%);
        }
      `}</style>

      {/* ── Icon + 404 ── */}
      <div className="nf-float nf-up-1" style={{ textAlign: "center", marginBottom: "1.75rem" }}>
        {/* Icon tile */}
        <div
          style={{
            position: "relative",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 76,
            height: 76,
            borderRadius: "1.2rem",
            background: "oklch(0.52 0.24 256 / 7%)",
            border: "1px solid oklch(0.52 0.24 256 / 16%)",
            marginBottom: "1.25rem",
          }}
        >
          {/* Emerald accent dot — top-right */}
          <div
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              width: 13,
              height: 13,
              borderRadius: "50%",
              background: "oklch(0.70 0.18 162)",
              boxShadow: "0 0 8px 2px oklch(0.70 0.18 162 / 55%)",
              border: "2px solid var(--background, #fff)",
            }}
          />
          <span style={{ fontSize: "2rem", lineHeight: 1 }}>🔍</span>
        </div>

        {/* 404 gradient number */}
        <div
          style={{
            fontSize: "5rem",
            fontWeight: 800,
            letterSpacing: "-0.04em",
            lineHeight: 1,
            background:
              "linear-gradient(135deg, oklch(0.52 0.24 256) 0%, oklch(0.70 0.18 162) 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          404
        </div>
      </div>

      {/* ── Text ── */}
      <div className="nf-up-2" style={{ textAlign: "center", marginBottom: "2rem" }}>
        <h1
          style={{
            fontSize: "1.15rem",
            fontWeight: 700,
            letterSpacing: "-0.01em",
            marginBottom: "0.5rem",
            color: "var(--foreground)",
          }}
        >
          Page introuvable
        </h1>
        <p
          style={{
            fontSize: "0.875rem",
            color: "oklch(0.55 0.015 286)",
            maxWidth: "320px",
            lineHeight: 1.65,
          }}
        >
          Cette page n&apos;existe pas ou a été déplacée.
          Retournez au tableau de bord ou choisissez une section ci-dessous.
        </p>
      </div>

      {/* ── CTA buttons ── */}
      <div
        className="nf-up-3"
        style={{
          display: "flex",
          gap: "0.75rem",
          marginBottom: "2.5rem",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <Button variant="outline" className="h-9 gap-2" onClick={() => router.back()}>
          ← Retour
        </Button>
        <Button
          className="h-9 gap-2"
          style={{ boxShadow: "0 4px 14px oklch(0.52 0.24 256 / 22%)" }}
          onClick={() => router.push("/inbox")}
        >
          🏠 Tableau de bord
        </Button>
      </div>

      {/* ── Quick links ── */}
      <div className="nf-up-4" style={{ width: "100%", maxWidth: "440px" }}>
        <p
          style={{
            fontSize: "10px",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "oklch(0.60 0.012 286)",
            textAlign: "center",
            marginBottom: "0.75rem",
          }}
        >
          Accès rapide
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
          {QUICK_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="ql-tile">
              <span style={{ fontSize: "1.1rem", lineHeight: 1, flexShrink: 0 }}>
                {link.icon}
              </span>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--foreground)", marginBottom: "0.1rem" }}>
                  {link.label}
                </p>
                <p
                  style={{
                    fontSize: "0.68rem",
                    color: "oklch(0.55 0.015 286)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {link.desc}
                </p>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* ── Footer ── */}
      <p style={{ marginTop: "2.25rem", fontSize: "10px", color: "oklch(0.65 0.012 286)", letterSpacing: "0.02em" }}>
        prosendia · Problème persistant ?{" "}
        <a href="mailto:support@prosendia.ai" style={{ color: "oklch(0.52 0.24 256)", textDecoration: "none" }}>
          Contacter le support
        </a>
      </p>
    </div>
  );
}
