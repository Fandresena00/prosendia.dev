/**
 * @file features/settings/components/security-tab.tsx
 * @description Security settings for password management and account protection.
 */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import {
  AlertTriangle,
  CheckCircle,
  Eye,
  EyeOff,
  Lock,
  Mail,
} from "lucide-react";
import { useState } from "react";

export function SecurityTab() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changeDialog, setChangeDialog] = useState(false);
  const [done, setDone] = useState(false);

  const match = newPassword === confirmPassword && newPassword.length > 0;
  const mismatch =
    confirmPassword.length > 0 && newPassword !== confirmPassword;
  const valid = currentPassword.length > 0 && newPassword.length >= 8 && match;

  const passwordStrength =
    newPassword.length >= 16
      ? "Très forte"
      : newPassword.length >= 12
        ? "Forte"
        : newPassword.length >= 8
          ? "Moyenne"
          : "Faible";

  const getStrengthColor = (strength: string) => {
    switch (strength) {
      case "Très forte":
        return "bg-emerald-500";
      case "Forte":
        return "bg-blue-500";
      case "Moyenne":
        return "bg-amber-500";
      default:
        return "bg-destructive";
    }
  };

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Password Change */}
      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Changer le mot de passe</CardTitle>
              <CardDescription>
                Minimum 8 caractères recommandés pour la sécurité
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {done && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/8 px-4 py-3 flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-emerald-700">
                  Mot de passe modifié avec succès
                </p>
                <p className="text-xs text-emerald-600 mt-0.5">
                  Votre nouveau mot de passe est maintenant actif
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-sm font-medium">Mot de passe actuel</Label>
            <div className="relative">
              <Input
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Entrez votre mot de passe actuel"
                className="h-10 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showCurrentPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Nouveau mot de passe
              </Label>
              <div className="relative">
                <Input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 caractères"
                  className="h-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Confirmer le mot de passe
              </Label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirmez votre mot de passe"
                  className="h-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {newPassword.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium">Force du mot de passe</p>
                <span
                  className={`text-xs font-medium px-2 py-1 rounded-full text-white ${getStrengthColor(passwordStrength)}`}
                >
                  {passwordStrength}
                </span>
              </div>
              <div className="h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${getStrengthColor(passwordStrength)}`}
                  style={{
                    width: `${Math.min(100, (newPassword.length / 16) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          {mismatch && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/8 px-3 py-2.5 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <p className="text-xs text-amber-700 font-medium">
                Les mots de passe ne correspondent pas
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
              }}
            >
              Annuler
            </Button>
            <Button disabled={!valid} onClick={() => setChangeDialog(true)}>
              Changer le mot de passe
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Email Verification */}
      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Vérification d&apos;Email</CardTitle>
              <CardDescription>
                Confirmez votre adresse e-mail pour un accès complet
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Si vous n&apos;avez pas reçu votre email de confirmation ou si le
            lien a expiré, vous pouvez demander l&apos;envoi d&apos;un nouveau
            code de vérification.
          </p>
          <Button variant="outline" className="w-full">
            Renvoyer l&apos;email de confirmation
          </Button>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={changeDialog} onOpenChange={setChangeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous certain ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action modifiera votre mot de passe. Vous devrez vous
              reconnecter après cette modification.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDone(true);
                setChangeDialog(false);
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
                setTimeout(() => setDone(false), 5000);
              }}
            >
              Confirmer la modification
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
