"use client";

import { PreferencesTab } from "@/features/settings/components/preferences-tab";
import { ProfileTab } from "@/features/settings/components/profile-tab";
import { SecurityTab } from "@/features/settings/components/security-tab";
import { Bell, Lock, User } from "lucide-react";
import { useState } from "react";

const TABS = [
  { id: "profile", label: "Profil", icon: User },
  { id: "preferences", label: "Préférences", icon: Bell },
  { id: "security", label: "Sécurité", icon: Lock },
];

export default function SettingsPage() {
  const [tab, setTab] = useState("profile");

  return (
    <div className="flex h-full flex-col">
      <div className="sticky top-0 z-10 border-b border-border/40 bg-background/95 backdrop-blur-sm px-5 pt-5">
        <h1 className="text-2xl font-bold tracking-tight">Paramètres</h1>
        <p className="text-sm text-muted-foreground mt-0.5 mb-4">
          Gérez votre compte et vos préférences
        </p>
        <div className="flex">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  tab === t.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex-1 overflow-auto p-5">
        {tab === "profile" && <ProfileTab />}
        {tab === "preferences" && <PreferencesTab />}
        {tab === "security" && <SecurityTab />}
      </div>
    </div>
  );
}
