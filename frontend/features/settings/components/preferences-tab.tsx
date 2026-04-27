/**
 * @file features/settings/components/preferences-tab.tsx
 * @description  settings tab for user preferences, including language and notification options.
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { IconCheck } from "@tabler/icons-react";

export function PreferencesTab() {
  return (
    <div className="space-y-5 max-w-2xl">
      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-semibold">
            Langue &amp; Région
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Langue de l&apos;interface
            </Label>
            <Select defaultValue="fr">
              <SelectTrigger className="h-10 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fr">🇫🇷 Français</SelectItem>
                <SelectItem value="en">🇬🇧 English</SelectItem>
                <SelectItem value="mg">🇲🇬 Malagasy</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-semibold">Notifications</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Choisissez comment vous souhaitez être alerté
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            {
              id: "email",
              label: "Résumé quotidien par email",
              sub: "Activités de votre assistant IA",
              default: true,
            },
            {
              id: "push",
              label: "Notifications push",
              sub: "Alertes temps réel sur votre appareil",
              default: true,
            },
            {
              id: "urgent",
              label: "Messages urgents uniquement",
              sub: "Transferts humains et réclamations",
              default: false,
            },
            {
              id: "weekly",
              label: "Rapport hebdomadaire",
              sub: "Performances IA chaque lundi",
              default: true,
            },
          ].map((item) => (
            <div
              key={item.id}
              className="flex items-start justify-between gap-4"
            >
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {item.sub}
                </p>
              </div>
              <Switch
                defaultChecked={item.default}
                className="shrink-0 mt-0.5"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button size="sm" className="h-9 gap-2 px-5">
          <IconCheck className="h-4 w-4" />
          Sauvegarder les préférences
        </Button>
      </div>
    </div>
  );
}
