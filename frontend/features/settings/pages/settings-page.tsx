/**
 * @file features/settings/pages/settings-page.tsx
 *
 * CHANGE: layout responsive.
 *   - >= lg (grand écran / fenêtre large) : Profil et Sécurité affichés côte à
 *     côte sur une seule page, sans navigation par onglets.
 *   - < lg (mobile / petite fenêtre) : navigation par onglets, un seul panneau
 *     visible à la fois — comportement identique à l'ancienne version.
 *
 * Les deux panneaux restent montés en permanence (juste cachés en CSS sur
 * mobile) pour ne pas perdre leur état local quand on bascule d'onglet.
 */

"use client";

import { Lock, User } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { ProfileTab } from "../components/profile-tab";
import { SecurityTab } from "../components/security-tab";

const TABS = [
  { id: "profile", label: "Profil", icon: User },
  { id: "security", label: "Sécurité", icon: Lock },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function SettingsPage() {
  const [tab, setTab] = useState<TabId>("profile");

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border/40 bg-background/95 backdrop-blur-sm px-6 pt-6 pb-4">
        <div className="flex flex-col gap-1 mb-6">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Compte
          </p>
          <h1 className="text-3xl font-bold tracking-tight">Paramètres</h1>
          <p className="text-sm text-muted-foreground">
            Gérez votre profil, votre sécurité et vos sessions actives
          </p>
        </div>

        {/* Tabs Navigation — uniquement en dessous du breakpoint lg */}
        <div className="flex gap-1 lg:hidden">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all",
                  isActive
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                )}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="px-6 py-6">
          <div className="mx-auto w-full max-w-6xl">
            <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
              <div className={cn(tab === "profile" ? "block" : "hidden", "lg:block")}>
                <ProfileTab />
              </div>
              <div className={cn(tab === "security" ? "block" : "hidden", "lg:block")}>
                <SecurityTab />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
