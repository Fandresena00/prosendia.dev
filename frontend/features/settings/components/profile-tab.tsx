/**
 * @file features/settings/components/profile-tab.tsx
 * @description profile tab for user information and settings.
 */

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuthStore, useCurrentUser } from "@/features/auth/store/auth.store";
import { IconCheck, IconUpload } from "@tabler/icons-react";
import { CheckCircle, Lock, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

export function ProfileTab() {
  const user = useCurrentUser();
  const { updateUser } = useAuthStore();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    user?.avatarUrl || null,
  );
  const [username, setUsername] = useState(user?.username);
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
    setAvatarUrl(URL.createObjectURL(file)); // preview
  };
  const handleSave = async () => {
    setSaving(true);
    try {
      // 1. Upload du fichier si un nouveau a été sélectionné
      if (selectedFile) {
        // Utilise getState() au lieu d'un hook
        await useAuthStore.getState().uploadAvatar(selectedFile);
        setSelectedFile(null);
      }

      // 2. Récupère l'avatar après l'upload éventuel (via le store, pas le hook)
      const freshAvatarUrl =
        useAuthStore.getState().user?.avatarUrl ?? avatarUrl;

      // 3. Mise à jour du username (et avatar si nécessaire)
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
    <div className="space-y-5 max-w-2xl">
      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-semibold">
            Photo &amp; informations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-4">
            <div className="relative group shrink-0">
              <Avatar className="h-16 w-16 shrink-0 border border-primary/20">
                {avatarUrl ? (
                  <AvatarImage
                    src={avatarUrl}
                    alt={username ?? user?.username ?? ""}
                  />
                ) : (
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                    {initials}
                  </AvatarFallback>
                )}
              </Avatar>
              {avatarUrl != user?.avatarUrl && (
                <button
                  onClick={() => setAvatarUrl(user?.avatarUrl || null)}
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3 text-white" />
                </button>
              )}
            </div>
            <div>
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-2"
                onClick={() => ref.current?.click()}
              >
                <IconUpload className="h-4 w-4" />
                {avatarUrl ? "Changer la photo" : "Ajouter une photo"}
              </Button>
              <p className="text-xs text-muted-foreground mt-1.5">
                JPG ou PNG · Max 2 MB
              </p>
              {avatarUrl != user?.avatarUrl && (
                <p className="text-xs text-emerald-600 flex items-center gap-1 mt-1">
                  <CheckCircle className="h-3 w-3" />
                  Photo prête à sauvegarder
                </p>
              )}
            </div>
            <input
              ref={ref}
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={handleFile}
            />
          </div>

          <Separator />

          <div className="grid gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Username</Label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-10 text-sm"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                Email de connexion
                <Badge variant="secondary" className="text-xs font-normal">
                  Non modifiable
                </Badge>
              </Label>
              <div className="relative">
                <Input
                  type="email"
                  value="jean.dupont@maboutique.fr"
                  readOnly
                  disabled
                  className="h-10 text-sm bg-muted/50 cursor-not-allowed text-muted-foreground pr-10"
                />
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
              </div>
              <p className="text-xs text-muted-foreground">
                L&apos;email est votre identifiant de connexion. Contactez le
                support pour le modifier.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-emerald-600">
            <CheckCircle className="h-4 w-4" />
            Profil sauvegardé
          </span>
        )}
        <Button
          size="sm"
          className="h-9 gap-2 px-5"
          disabled={saving}
          onClick={handleSave}
        >
          {saving ? (
            <>
              <div className="h-4 w-4 rounded-full border-2 border-transparent border-t-current animate-spin" />
              Sauvegarde…
            </>
          ) : (
            <>
              <IconCheck className="h-4 w-4" />
              Sauvegarder
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
