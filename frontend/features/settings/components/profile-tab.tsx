/**
 * @file features/settings/components/profile-tab.tsx
 * @description Profile tab for user information and settings.
 */

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuthStore, useCurrentUser } from "@/features/auth/store/auth.store";
import { IconCheck, IconUpload } from "@tabler/icons-react";
import { CheckCircle, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

export function ProfileTab() {
  const user = useCurrentUser();
  const { updateUser } = useAuthStore();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    user?.avatarUrl || null,
  );
  const [username, setUsername] = useState(user?.username);
  const email = user?.email;
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : "??";

  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("La photo doit faire moins de 2 MB.");
      return;
    }
    setSelectedFile(file);
    setAvatarUrl(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (selectedFile) {
        await useAuthStore.getState().uploadAvatar(selectedFile);
        setSelectedFile(null);
      }

      const freshAvatarUrl =
        useAuthStore.getState().user?.avatarUrl ?? avatarUrl;

      await updateUser({ username, avatarUrl: freshAvatarUrl });

      setSaving(false);
      setSaved(true);
      toast.success("Profil mis à jour avec succès.");
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      toast.error("Échec de la sauvegarde du profil.");
      console.error(error);
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Avatar & Basic Info */}
      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <CardTitle>Photo & Informations</CardTitle>
          <CardDescription>
            Mettez à jour votre photo de profil et vos informations personnelles
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {saved && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/8 px-3 py-2.5 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
              <p className="text-sm text-emerald-700 font-medium">
                Profil mis à jour avec succès.
              </p>
            </div>
          )}

          {/* Avatar Section */}
          <div className="flex items-start gap-6">
            <div className="relative group shrink-0">
              <Avatar className="h-24 w-24 shrink-0 border-2 border-primary/20 shadow-sm">
                {avatarUrl ? (
                  <AvatarImage
                    src={avatarUrl}
                    alt={username ?? user?.username ?? ""}
                  />
                ) : (
                  <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                    {initials}
                  </AvatarFallback>
                )}
              </Avatar>
              <button
                onClick={() => ref.current?.click()}
                className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:bg-primary/90 transition-colors"
              >
                <IconUpload className="h-4 w-4" />
              </button>
              {avatarUrl !== user?.avatarUrl && (
                <button
                  onClick={() => setAvatarUrl(user?.avatarUrl || null)}
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-md hover:bg-destructive/90 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <input
              ref={ref}
              type="file"
              accept="image/*"
              onChange={handleFile}
              className="hidden"
            />
            <div className="flex-1 pt-2">
              <p className="text-sm font-medium text-foreground mb-1">
                Photo de profil
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                JPG, PNG ou GIF. Taille max 2 MB
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => ref.current?.click()}
              >
                <IconUpload className="h-4 w-4 mr-2" />
                Changer la photo
              </Button>
            </div>
          </div>

          <Separator />

          {/* Form Fields */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Nom d&apos;utilisateur
              </Label>
              <Input
                value={username || ""}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Votre nom d'utilisateur"
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Email</Label>
              <Input value={email || ""} disabled className="h-10 bg-muted" />
            </div>
          </div>

          {/* Email Verification Status */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase">
              Vérification email
            </p>
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-600">Vérifié</Badge>
              <span className="text-sm text-muted-foreground">
                Votre adresse email est confirmée
              </span>
            </div>
          </div>

          {/* Member Since */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase">
              Date d&apos;inscription
            </p>
            <p className="text-sm text-foreground">
              {user?.createdAt
                ? new Date(user.createdAt).toLocaleDateString("fr-FR", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })
                : "Date non disponible"}
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setUsername(user?.username);
                setAvatarUrl(user?.avatarUrl || null);
              }}
            >
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <IconCheck className="h-4 w-4 mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <IconCheck className="h-4 w-4 mr-2" />
                  Enregistrer les modifications
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
