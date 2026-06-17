/**
 * @file features/settings/components/profile-tab.tsx
 * @description Profile tab for user information and settings.
 *
 * CHANGES:
 *   - L'avatar affiche désormais une étiquette "Synchronisée avec Google" ou
 *     "Photo personnalisée" selon user.avatarSource. Le changement manuel reste
 *     toujours possible : l'upload bascule automatiquement le compte sur
 *     avatarSource=LOCAL côté backend, ce qui désactive la synchro Google future.
 *   - updateUser() n'envoie plus avatarUrl (retiré du DTO backend) — uniquement
 *     username. L'avatar passe exclusivement par uploadAvatar().
 *   - Badge "Vérifié" rendu dynamique (user.emailVerified) au lieu d'être figé.
 *   - Bouton "Enregistrer" utilise un vrai spinner (Loader2) pendant le chargement.
 *
 * NOTE: le type `User` utilisé par useCurrentUser() doit exposer
 * `avatarSource: "LOCAL" | "GOOGLE"` (champ ajouté côté backend dans
 * UserResponseDto). Ajoute-le à l'interface User de ta feature auth si elle
 * n'est pas générée automatiquement depuis le backend.
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
import { IconUpload } from "@tabler/icons-react";
import {
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
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

  const isGoogleManaged = user?.avatarSource === "GOOGLE";

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

      await updateUser({ username });

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

  const hasPendingChanges = !!selectedFile || username !== user?.username;

  return (
    <div className="space-y-5 w-full">
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
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <p className="text-sm text-emerald-700 font-medium">
                Profil mis à jour avec succès.
              </p>
            </div>
          )}

          {/* Avatar Section */}
          <div className="flex items-start gap-6">
            <div className="relative group shrink-0">
              <Avatar className="h-24 w-24 shrink-0 border-2 border-primary/20 shadow-sm transition-all group-hover:border-primary/40">
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

              {/* Overlay au survol (desktop) */}
              <button
                onClick={() => ref.current?.click()}
                aria-label="Changer la photo de profil"
                className="absolute inset-0 flex items-center justify-center rounded-full bg-background/0 opacity-0 transition-all group-hover:bg-background/60 group-hover:opacity-100 backdrop-blur-[1px]"
              >
                <IconUpload className="h-5 w-5 text-foreground" />
              </button>

              {/* Bouton d'upload toujours visible (mobile / accessibilité) */}
              <button
                onClick={() => ref.current?.click()}
                aria-label="Changer la photo de profil"
                className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:bg-primary/90 transition-colors"
              >
                <IconUpload className="h-4 w-4" />
              </button>

              {avatarUrl !== user?.avatarUrl && (
                <button
                  onClick={() => {
                    setAvatarUrl(user?.avatarUrl || null);
                    setSelectedFile(null);
                  }}
                  aria-label="Annuler le changement de photo"
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
            <div className="flex-1 pt-2 space-y-3">
              <div>
                <p className="text-sm font-medium text-foreground mb-1">
                  Photo de profil
                </p>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG ou GIF. Taille max 2 MB
                </p>
              </div>

              {/* Source de la photo */}
              <div className="flex items-center gap-1.5 text-xs">
                {isGoogleManaged ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                    <RefreshCw className="h-3 w-3" />
                    Synchronisée avec Google
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                    <ImageIcon className="h-3 w-3" />
                    Photo personnalisée
                  </span>
                )}
              </div>

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
              {user?.emailVerified ? (
                <Badge className="bg-emerald-600">Vérifié</Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-amber-500/40 text-amber-700"
                >
                  Non vérifié
                </Badge>
              )}
              <span className="text-sm text-muted-foreground">
                {user?.emailVerified
                  ? "Votre adresse email est confirmée"
                  : "Confirmez votre email depuis l'onglet Sécurité"}
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
              disabled={saving}
              onClick={() => {
                setUsername(user?.username);
                setAvatarUrl(user?.avatarUrl || null);
                setSelectedFile(null);
              }}
            >
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !hasPendingChanges}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                "Enregistrer les modifications"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Abonnement */}
      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle>Abonnement</CardTitle>
              <CardDescription>
                Votre plan actuel et vos crédits
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 px-4 py-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-medium">
                {user?.activePlan ?? "FREE"}
              </Badge>
              <span className="text-sm text-muted-foreground">Plan actif</span>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/billing">Gérer l&apos;abonnement</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
