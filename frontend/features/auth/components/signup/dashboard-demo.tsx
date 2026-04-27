"use client";

import { EASE } from "@/lib/motion";
import { motion } from "framer-motion";
import { MessageCircleMore, TrendingUp, Zap } from "lucide-react";

export function DashboardDemo() {
  const CHART = [38, 52, 44, 68, 60, 82, 88, 76, 94, 100, 87, 110];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {[
          {
            label: "Messages",
            value: "1,247",
            color: "oklch(0.62 0.22 256)",
            bg: "oklch(0.52 0.24 256 / 12%)",
            icon: MessageCircleMore,
          },
          {
            label: "Taux IA",
            value: "94%",
            color: "#34d399",
            bg: "oklch(0.5 0.15 155 / 10%)",
            icon: Zap,
          },
          {
            label: "Ventes",
            value: "+18",
            color: "#fb923c",
            bg: "oklch(0.65 0.18 50 / 10%)",
            icon: TrendingUp,
          },
        ].map(({ label, value, color, bg, icon: Icon }, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE, delay: 0.6 + i * 0.1 }}
            className="rounded-xl border border-border/40 bg-secondary/40 p-2.5"
          >
            <div
              className="mb-1.5 flex h-6 w-6 items-center justify-center rounded-lg"
              style={{ background: bg }}
            >
              <Icon className="h-3 w-3" style={{ color }} />
            </div>
            <p className="text-[10px] text-muted-foreground">{label}</p>
            <p className="text-[13px] font-bold" style={{ color }}>
              {value}
            </p>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9, duration: 0.6 }}
        className="rounded-xl border border-border/40 bg-secondary/40 p-3"
      >
        <p className="text-[10px] font-medium text-muted-foreground mb-2">
          Messages · 12 derniers jours
        </p>
        <div className="flex items-end gap-1 h-14">
          {CHART.map((v, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm"
              style={{
                height: `${(v / 110) * 100}%`,
                background:
                  i === CHART.length - 1
                    ? "oklch(0.52 0.24 256)"
                    : "oklch(0.52 0.24 256 / 35%)",
              }}
            />
          ))}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.05, duration: 0.5 }}
        className="space-y-1.5"
      >
        {[
          { name: "Marie D.", msg: "Est-ce disponible ?" },
          { name: "Jean M.", msg: "Prix de livraison ?" },
          { name: "Sophie L.", msg: "Commander 2 unités" },
        ].map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.1 + i * 0.08, duration: 0.4 }}
            className="flex items-center gap-2.5 rounded-lg border border-border/40 bg-secondary/40 px-3 py-2"
          >
            <div
              className="h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
              style={{
                background: "oklch(0.52 0.24 256 / 15%)",
                color: "oklch(0.52 0.24 256)",
              }}
            >
              {item.name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold truncate">{item.name}</p>
              <p className="text-[10px] text-muted-foreground truncate">
                {item.msg}
              </p>
            </div>
            <span
              className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
              style={{
                background: "oklch(0.52 0.24 256 / 12%)",
                color: "oklch(0.52 0.24 256)",
              }}
            >
              IA
            </span>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
