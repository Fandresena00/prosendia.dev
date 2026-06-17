/**
 * @file features/settings/components/security-tab.tsx
 * @description Security settings for password management and account protection.
 *
 * CHANGES (connexion au backend) :
 *   - Le changement de mot de passe appelle réellement PATCH /users/:id/change-password
 *     (settingsService.changePassword) au lieu de simuler un succès en local.
 *   - La checklist de force du mot de passe reflète exactement la regex backend
 *     de ChangePasswordDto (8+ caractères, 1 majuscule, 1 chiffre, 1 caractère
 *     spécial parmi @$!%*?&) — évite les rejets serveur surprenants.
 *   - "Renvoyer l'email de confirmation" appelle POST /auth/resend-verification
 *     et n'apparaît que si le compte n'est pas encore vérifié.
 *   - Nouvelle section "Sessions actives" : "Se déconnecter de tous les
 *     appareils" appelle POST /auth/logout-all puis redirige vers /sign-in.
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
import { useCurrentUser } from "@/features/auth/store/auth.store";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  LogOut,
  Lock,
  Mail,
  Monitor,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { settingsService } from "../services/settings.service";

const SPECIAL_CHARS = /[@$!%*?&]/;
const RESEND_COOLDOWN_SECONDS = 60;

function RuleRow({ met, label }: { met: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {met ? (
        <Check className="h-3.5 w-3.5 text-emerald-600" />
      ) : (
        <X className="h-3.5 w-3.5 text-muted-foreground/50" />
      )}
      <span
        className={
          met ? "text-xs text-emerald-700" : "text-xs text-muted-foreground"
        }
      >
        {label}
      </span>
    </div>
  );
}

export function SecurityTab() {
  const user = useCurrentUser();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changeDialog, setChangeDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [logoutAllDialog, setLogoutAllDialog] = useState(false);
  const [loggingOutAll, setLoggingOutAll] = useState(false);

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  // ── Règles de mot de passe — alignées sur ChangePasswordDto (backend) ─────
  const rules = {
    length: newPassword.length >= 8,
    uppercase: /[A-Z]/.test(newPassword),
    digit: /\d/.test(newPassword),
    special: SPECIAL_CHARS.test(newPassword),
  };
  const newPasswordValid = Object.values(rules).every(Boolean);

  const match = newPassword === confirmPassword && newPassword.length > 0;
  const mismatch =
    confirmPassword.length > 0 && newPassword !== confirmPassword;
  const valid =
    currentPassword.length > 0 && newPasswordValid && match;

  // ── Changement de mot de passe ─────────────────────────────────────────────

  const handleConfirmChangePassword = async () => {
    if (!user?.id) return;
    setSubmitting(true);
    try {
      await settingsService.changePassword(user.id, {
        currentPassword,
        newPassword,
        confirmPassword,
      });
      setDone(true);
      setChangeDialog(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Mot de passe modifié avec succès.");
      setTimeout(() => setDone(false), 5000);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Échec du changement de mot de passe.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Renvoi de l'email de vérification ──────────────────────────────────────

  const startCooldown = () => {
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((s) => {
        if (s <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  const handleResendVerification = async () => {
    if (!user?.email) return;
    setResending(true);
    try {
      await settingsService.resendVerificationEmail(user.email);
      toast.success("Email de vérification envoyé.");
      startCooldown();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Échec de l'envoi de l'email.";
      toast.error(message);
    } finally {
      setResending(false);
    }
  };

  // ── Déconnexion de tous les appareils ──────────────────────────────────────

  const handleLogoutAllDevices = async () => {
    setLoggingOutAll(true);
    try {
      await settingsService.logoutAllDevices();
      window.location.href = "/sign-in";
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Échec de la déconnexion des appareils.";
      toast.error(message);
      setLoggingOutAll(false);
    }
  };

  return (
    <div className="space-y-5 w-full">
      {/* Password Change */}
      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Lock className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle>Changer le mot de passe</CardTitle>
              <CardDescription>
                Minimum 8 caractères, avec majuscule, chiffre et caractère spécial
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {done && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/8 px-4 py-3 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
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
                autoComplete="current-password"
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
                  autoComplete="new-password"
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
                  autoComplete="new-password"
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
            <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 rounded-lg border border-border/50 bg-muted/30 px-3 py-2.5">
              <RuleRow met={rules.length} label="8 caractères minimum" />
              <RuleRow met={rules.uppercase} label="1 lettre majuscule" />
              <RuleRow met={rules.digit} label="1 chiffre" />
              <RuleRow met={rules.special} label="1 caractère spécial (@$!%*?&)" />
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
              disabled={submitting}
              onClick={() => {
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
              }}
            >
              Annuler
            </Button>
            <Button disabled={!valid || submitting} onClick={() => setChangeDialog(true)}>
              Changer le mot de passe
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Email Verification — uniquement si pas encore vérifié */}
      {!user?.emailVerified && (
        <Card className="border-border/50">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10">
                <Mail className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <CardTitle>Vérification d&apos;email</CardTitle>
                <CardDescription>
                  Confirmez votre adresse e-mail pour un accès complet
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Si vous n&apos;avez pas reçu votre code de vérification ou s&apos;il
              a expiré, vous pouvez en demander un nouveau.
            </p>
            <Button
              variant="outline"
              className="w-full"
              disabled={resending || resendCooldown > 0}
              onClick={handleResendVerification}
            >
              {resending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Envoi en cours...
                </>
              ) : resendCooldown > 0 ? (
                `Renvoyer dans ${resendCooldown}s`
              ) : (
                "Renvoyer l'email de confirmation"
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Sessions actives */}
      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10">
              <Monitor className="h-4 w-4 text-destructive" />
            </div>
            <div>
              <CardTitle>Sessions actives</CardTitle>
              <CardDescription>
                Déconnectez tous les appareils connectés à votre compte
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Utile si vous pensez que votre compte est accessible depuis un
            appareil que vous ne reconnaissez pas. Vous serez déconnecté ici
            aussi et devrez vous reconnecter.
          </p>
          <Button
            variant="outline"
            className="w-full border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive"
            onClick={() => setLogoutAllDialog(true)}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Se déconnecter de tous les appareils
          </Button>
        </CardContent>
      </Card>

      {/* Confirmation — changement de mot de passe */}
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
            <AlertDialogCancel disabled={submitting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={submitting}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmChangePassword();
              }}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Modification...
                </>
              ) : (
                "Confirmer la modification"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation — déconnexion de tous les appareils */}
      <AlertDialog open={logoutAllDialog} onOpenChange={setLogoutAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Déconnecter tous les appareils ?</AlertDialogTitle>
            <AlertDialogDescription>
              Toutes vos sessions actives seront fermées, y compris celle-ci.
              Vous devrez vous reconnecter.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loggingOutAll}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={loggingOutAll}
              onClick={(e) => {
                e.preventDefault();
                void handleLogoutAllDevices();
              }}
            >
              {loggingOutAll ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Déconnexion...
                </>
              ) : (
                "Déconnecter tous les appareils"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
