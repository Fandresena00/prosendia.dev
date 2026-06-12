/**
 * @file features/dashboard/components/subscription-card.tsx
 *
 * Carte abonnement redesignée — layout 2 colonnes avec RadialBarChart shadcn
 * pour les crédits IA, et une grille de métriques secondaires compacte.
 * Inspiré Linear + Vercel Analytics.
 */
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { IconCreditCard } from "@tabler/icons-react";
import {
  AlertTriangle,
  ArrowRight,
  FileImage,
  Globe,
  LayoutGrid,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { PolarAngleAxis, RadialBar, RadialBarChart } from "recharts";
import type { SubscriptionUsage } from "../types/dashboard.types";

// ─── Credit radial chart ──────────────────────────────────────────────────────

interface CreditChartProps {
  remainingPct: number;
  balance: number;
  granted: number | null;
  isLow: boolean;
  isCritical: boolean;
  isDepleted: boolean;
}

function CreditRadialChart({
  remainingPct,
  balance,
  granted,
  isLow,
  isCritical,
  isDepleted,
}: CreditChartProps) {
  const color = isDepleted
    ? "#ef4444"
    : isCritical
      ? "#f97316"
      : isLow
        ? "#f59e0b"
        : "#10b981";
  const pct = Math.max(0, Math.min(100, remainingPct));

  const statusLabel = isDepleted
    ? "Épuisés"
    : isCritical
      ? "Critique"
      : isLow
        ? "Faible"
        : "Actifs";
  const statusColor = isDepleted
    ? "text-red-500"
    : isCritical
      ? "text-orange-500"
      : isLow
        ? "text-amber-500"
        : "text-emerald-500";

  const chartData = [{ name: "Crédits", value: pct, fill: color }];
  const chartConfig = {
    Crédits: { label: "Crédits restants", color },
  } satisfies Record<string, { label: string; color: string }>;

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <ChartContainer config={chartConfig} className="h-[120px] w-[120px]">
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="68%"
            outerRadius="90%"
            startAngle={90}
            endAngle={-270}
            data={chartData}
            barSize={10}
          >
            {/* Background track */}
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar
              dataKey="value"
              cornerRadius={5}
              background={{ fill: "currentColor", fillOpacity: 0.06 }}
              style={{
                filter:
                  pct > 0 && !isDepleted
                    ? `drop-shadow(0 0 4px ${color}66)`
                    : "none",
              }}
            />
          </RadialBarChart>
        </ChartContainer>

        {/* Center — percentage + label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span
            className="text-[22px] font-black tabular-nums leading-none"
            style={{ color }}
          >
            {Math.round(pct)}
          </span>
          <span className="text-[10px] text-muted-foreground leading-none mt-0.5">
            %
          </span>
        </div>
      </div>

      {/* Balance label */}
      <div className="text-center mt-1">
        <p className="text-[12px] font-semibold leading-none">Crédits IA</p>
        <p className="text-[11px] tabular-nums mt-1 leading-none">
          <span className="font-bold" style={{ color }}>
            {balance.toLocaleString("fr-FR")}
          </span>
          {granted && (
            <span className="text-muted-foreground text-[10px]">
              {" "}
              / {granted.toLocaleString("fr-FR")}
            </span>
          )}
        </p>
        <span
          className={cn(
            "text-[10px] font-medium mt-0.5 leading-none",
            statusColor,
          )}
        >
          {statusLabel}
        </span>
      </div>
    </div>
  );
}

// ─── Usage metric row ─────────────────────────────────────────────────────────

interface UsageMetricProps {
  icon: React.ElementType;
  label: string;
  used: number;
  limit: number | null;
  unit?: string;
}

function UsageMetric({
  icon: Icon,
  label,
  used,
  limit,
  unit,
}: UsageMetricProps) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : null;
  const isOver = pct !== null && pct >= 100;
  const isHigh = pct !== null && pct >= 80;

  const barColor = isOver
    ? "bg-red-500"
    : isHigh
      ? "bg-amber-500"
      : "bg-primary/60";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3 w-3 text-muted-foreground/60 shrink-0" />
          <span className="text-[11px] text-muted-foreground">{label}</span>
        </div>
        <span
          className={cn(
            "text-[11px] font-semibold tabular-nums",
            isOver ? "text-red-500" : "text-foreground",
          )}
        >
          {used.toLocaleString("fr-FR")}
          {limit !== null && (
            <span className="text-muted-foreground/60 font-normal">
              /{limit.toLocaleString("fr-FR")}
            </span>
          )}
          {unit && (
            <span className="text-muted-foreground/60 font-normal ml-0.5">
              {unit}
            </span>
          )}
        </span>
      </div>
      {limit !== null && (
        <div className="h-1 w-full rounded-full bg-border/30">
          <div
            className={cn(
              "h-1 rounded-full transition-all duration-500",
              barColor,
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface SubscriptionCardProps {
  data: SubscriptionUsage;
}

export function SubscriptionCard({ data }: SubscriptionCardProps) {
  const {
    planName,
    planId,
    creditBalance,
    creditsGranted,
    creditRemainingPct,
    creditIsLow,
    creditIsCritical,
    creditIsDepleted,
    periodEnd,
    daysRemaining,
    pagesUsed,
    pagesLimit,
    postsManaged,
    postsLimit,
    referenceImages,
    imagesLimit,
  } = data;

  const expiryDate = periodEnd
    ? new Date(periodEnd).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  const isNearExpiry = daysRemaining !== null && daysRemaining <= 7;
  const showCta = creditIsLow || creditIsCritical || creditIsDepleted;
  const planIsFree = planId === "FREE";

  return (
    <Card className="border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden relative">
      {/* Top accent — couleur selon état des crédits */}
      <div
        className="absolute top-0 left-0 right-0 h-px pointer-events-none"
        style={{
          background: creditIsDepleted
            ? "linear-gradient(90deg, transparent, #ef4444, transparent)"
            : creditIsCritical
              ? "linear-gradient(90deg, transparent, #f97316, transparent)"
              : creditIsLow
                ? "linear-gradient(90deg, transparent, #f59e0b, transparent)"
                : "linear-gradient(90deg, transparent, var(--primary), transparent)",
        }}
      />

      <CardHeader className="pb-2 pt-4 px-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 flex items-center gap-1.5">
            <IconCreditCard className="h-3.5 w-3.5 text-primary" />
            Abonnement &amp; Utilisation
          </CardTitle>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Plan badge */}
            <Badge
              variant="outline"
              className={cn(
                "h-5 text-[10px] font-bold px-2 tracking-wide",
                planIsFree
                  ? "border-muted-foreground/30 text-muted-foreground"
                  : "border-primary/30 text-primary bg-primary/5",
              )}
            >
              {planName}
            </Badge>

            {/* Expiry */}
            {expiryDate && (
              <span
                className={cn(
                  "text-[10px]",
                  isNearExpiry
                    ? daysRemaining! <= 3
                      ? "text-red-500 font-semibold"
                      : "text-amber-500 font-semibold"
                    : "text-muted-foreground",
                )}
              >
                {isNearExpiry
                  ? `${daysRemaining}j restant${daysRemaining! > 1 ? "s" : ""}`
                  : `Expire ${expiryDate}`}
              </span>
            )}

            {/* Alert icons */}
            {creditIsDepleted && (
              <XCircle className="h-3.5 w-3.5 text-red-500" />
            )}
            {!creditIsDepleted && (creditIsLow || creditIsCritical) && (
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-5 pb-4">
        {/* ── 2-col layout ── */}
        <div className="flex gap-5 items-start">
          {/* Left — radial credit chart */}
          <div className="shrink-0">
            <CreditRadialChart
              remainingPct={creditRemainingPct}
              balance={creditBalance}
              granted={creditsGranted}
              isLow={creditIsLow}
              isCritical={creditIsCritical}
              isDepleted={creditIsDepleted}
            />
          </div>

          {/* Divider */}
          <div className="w-px self-stretch bg-border/30 shrink-0" />

          {/* Right — usage metrics */}
          <div className="flex-1 min-w-0 flex flex-col gap-3 justify-center py-1">
            <UsageMetric
              icon={Globe}
              label="Pages Facebook"
              used={pagesUsed}
              limit={pagesLimit}
            />
            <UsageMetric
              icon={LayoutGrid}
              label="Posts gérés"
              used={postsManaged}
              limit={postsLimit}
            />
            <UsageMetric
              icon={FileImage}
              label="Images référence"
              used={referenceImages}
              limit={imagesLimit}
            />

            {/* CTA — inside right col for compact layout */}
            {(showCta || planIsFree) && (
              <Button
                asChild
                size="sm"
                variant={creditIsDepleted ? "default" : "outline"}
                className={cn(
                  "h-7 text-[11px] gap-1.5 mt-1",
                  creditIsDepleted &&
                    "bg-red-500 hover:bg-red-600 border-0 text-white",
                )}
              >
                <Link href="/billing">
                  {creditIsDepleted
                    ? "Réactiver l'IA"
                    : planIsFree
                      ? "Passer au Pro"
                      : "Gérer l'abonnement"}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
