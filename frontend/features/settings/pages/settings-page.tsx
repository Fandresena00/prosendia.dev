"use client";

import { Lock, User } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { ProfileTab } from "../components/profile-tab";
import { SecurityTab } from "../components/security-tab";

const TABS = [
  { id: "profile", label: "Profil", icon: User },
  { id: "security", label: "Sécurité", icon: Lock },
];

export default function SettingsPage() {
  const [tab, setTab] = useState("profile");

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border/40 bg-background/95 backdrop-blur-sm px-6 pt-6 pb-4">
        <div className="flex flex-col gap-1 mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Paramètres</h1>
          <p className="text-sm text-muted-foreground">
            Gérez votre compte et vos informations
          </p>
        </div>

        {/* Tabs Navigation */}
        <div className="flex gap-1">
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
          {tab === "profile" && <ProfileTab />}
          {tab === "security" && <SecurityTab />}
        </div>
      </div>
    </div>
  );
}
