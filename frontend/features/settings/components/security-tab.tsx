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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, Eye, EyeOff, Lock } from "lucide-react";
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

  return (
    <div className="space-y-5 max-w-2xl">
      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-semibold">
            Changer le mot de passe
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Minimum 8 caractères recommandés
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {done && (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/8 px-3 py-2.5 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
              <p className="text-sm text-emerald-700 font-medium">
                Mot de passe modifié avec succès.
              </p>
            </div>
          )}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Mot de passe actuel</Label>
            <div className="relative">
              <Input
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="h-10 text-sm pr-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCurrentPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
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
                  className="h-10 text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {newPassword.length > 0 && newPassword.length < 8 && (
                <p className="text-xs text-amber-600">
                  {8 - newPassword.length} caractère
                  {8 - newPassword.length > 1 ? "s" : ""} manquant
                  {8 - newPassword.length > 1 ? "s" : ""}
                </p>
              )}
              {newPassword.length >= 8 && (
                <p className="text-xs text-emerald-600 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Longueur valide
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Confirmer</Label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`h-10 text-sm pr-10 ${mismatch ? "border-destructive/60" : match ? "border-emerald-500/50" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {mismatch && (
                <p className="text-xs text-destructive">Ne correspondent pas</p>
              )}
              {match && (
                <p className="text-xs text-emerald-600 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Correspondance OK
                </p>
              )}
            </div>
          </div>
          <Button
            size="sm"
            className="h-9 gap-2 px-5"
            disabled={!valid}
            onClick={() => setChangeDialog(true)}
          >
            <Lock className="h-4 w-4" />
            Changer le mot de passe
          </Button>
        </CardContent>
      </Card>

      {/* Password confirm dialog */}
      <AlertDialog open={changeDialog} onOpenChange={setChangeDialog}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer le changement</AlertDialogTitle>
            <AlertDialogDescription>
              Votre mot de passe sera modifié immédiatement. Les sessions
              actives sur d&apos;autres appareils seront déconnectées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-9 text-sm">
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-9 text-sm gap-2"
              onClick={() => {
                setChangeDialog(false);
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
                setDone(true);
              }}
            >
              <Lock className="h-4 w-4" />
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
