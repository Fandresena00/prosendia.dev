/**
 * @file features/dashboard/components/subscription-card.tsx
 */
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { IconCreditCard } from "@tabler/icons-react";
import { AlertTriangle, ArrowRight, XCircle } from "lucide-react";
import Link from "next/link";
import type { SubscriptionUsage } from "../types/dashboard.types";

interface SubscriptionCardProps {
  data: SubscriptionUsage;
}

function UsageRow({
  label, used, limit, warn,
}: { label: string; used: number; limit: number | null; warn?: boolean }) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const isOver = limit ? used >= limit : false;

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={cn("text-xs font-semibold tabular-nums", isOver && "text-red-500")}>
          {used.toLocaleString("fr-FR")}
          {limit !== null && (
            <span className="text-muted-foreground font-normal">
              {" / "}{limit.toLocaleString("fr-FR")}
            </span>
          )}
        </span>
      </div>
      {limit !== null && (
        <div className="h-1 w-full rounded-full bg-border/40">
          <div
            className={cn(
              "h-1 rounded-full transition-all",
              pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-primary/60",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function SubscriptionCard({ data }: SubscriptionCardProps) {
  const {
    planName, creditBalance, creditsGranted, creditRemainingPct,
    creditIsLow, creditIsCritical, creditIsDepleted,
    periodEnd, daysRemaining,
    pagesUsed, pagesLimit, postsManaged, postsLimit, referenceImages, imagesLimit,
  } = data;

  const expiryDate = periodEnd
    ? new Date(periodEnd).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : null;

  const creditBarColor = creditIsDepleted ? "bg-red-500"
    : creditIsCritical ? "bg-orange-500"
    : creditIsLow ? "bg-amber-500"
    : "bg-emerald-500";

  return (
    <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[12px] font-semibold flex items-center gap-2">
            <IconCreditCard className="h-3.5 w-3.5 text-primary" />
            Abonnement &amp; Utilisation
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="h-5 text-[10px] font-semibold px-2">
              {planName}
            </Badge>
            {creditIsDepleted && <XCircle className="h-3.5 w-3.5 text-red-500" />}
            {!creditIsDepleted && (creditIsLow || creditIsCritical) && (
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-4">
        {/* Crédits IA — barre proéminente */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Crédits IA</span>
            <span className={cn(
              "text-xs font-bold tabular-nums",
              creditIsDepleted ? "text-red-500" : creditIsCritical ? "text-orange-500" : creditIsLow ? "text-amber-500" : "text-foreground",
            )}>
              {creditBalance.toLocaleString("fr-FR")}
              {creditsGranted && (
                <span className="text-muted-foreground font-normal">
                  {" / "}{creditsGranted.toLocaleString("fr-FR")}
                </span>
              )}
            </span>
          </div>
          {creditsGranted && (
            <div className="h-2 w-full rounded-full bg-border/40">
              <div
                className={cn("h-2 rounded-full transition-all", creditBarColor)}
                style={{ width: `${Math.max(0, Math.min(100, creditRemainingPct))}%` }}
              />
            </div>
          )}
          {creditIsDepleted && (
            <p className="text-[10px] text-red-500">
              IA désactivée — souscrivez pour réactiver
            </p>
          )}
          {!creditIsDepleted && creditIsLow && (
            <p className="text-[10px] text-amber-600">
              {Math.round(creditRemainingPct)}% restant
            </p>
          )}
        </div>

        {/* Autres limites */}
        <div className="space-y-2.5">
          <UsageRow label="Pages Facebook"     used={pagesUsed}        limit={pagesLimit} />
          <UsageRow label="Posts gérés"        used={postsManaged}     limit={postsLimit} />
          <UsageRow label="Images référence"   used={referenceImages}  limit={imagesLimit} />
        </div>

        {/* Expiration */}
        {expiryDate && (
          <div className="flex items-center justify-between pt-1 border-t border-border/30">
            <span className="text-[10px] text-muted-foreground">Expire le {expiryDate}</span>
            {daysRemaining !== null && daysRemaining <= 7 && (
              <span className={cn(
                "text-[10px] font-semibold",
                daysRemaining <= 3 ? "text-red-500" : "text-amber-500",
              )}>
                {daysRemaining}j restant{daysRemaining > 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}

        {/* CTA */}
        {(creditIsLow || creditIsCritical || creditIsDepleted || !expiryDate) && (
          <Button asChild size="sm" variant={creditIsDepleted ? "default" : "outline"} className="w-full h-7 text-[11px] gap-1">
            <Link href="/billing">
              {creditIsDepleted ? "Réactiver l'IA" : "Gérer l'abonnement"}
              <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
