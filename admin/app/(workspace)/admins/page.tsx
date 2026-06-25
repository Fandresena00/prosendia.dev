"use client";

// app/(workspace)/admins/page.tsx

import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AdminApiError,
  adminManagementApi,
  type AdminAccount,
} from "@/lib/admin-api";
import {
  AlertCircle,
  Crown,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

// ─── Subcomponents ────────────────────────────────────────────────────────────

function AdminTableSkeletonRows() {
  return Array.from({ length: 3 }).map((_, rowIndex) => (
    <TableRow key={rowIndex}>
      {Array.from({ length: 5 }).map((_, colIndex) => (
        <TableCell key={colIndex}>
          <Skeleton className="h-4 w-full" />
        </TableCell>
      ))}
    </TableRow>
  ));
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminAdminsPage() {
  const [adminAccounts, setAdminAccounts] = useState<AdminAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isActionBusy, setIsActionBusy] = useState(false);

  const fetchAdmins = useCallback(() => {
    let cancelled = false;

    adminManagementApi
      .list()
      .then((data) => {
        if (!cancelled) setAdminAccounts(data);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const cancel = fetchAdmins();
    return cancel;
  }, [fetchAdmins]);

  async function handleCreateAdmin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);
    setIsActionBusy(true);
    try {
      await adminManagementApi.create(emailInput, passwordInput);
      setEmailInput("");
      setPasswordInput("");
      fetchAdmins();
    } catch (err) {
      setErrorMessage(
        err instanceof AdminApiError
          ? err.message
          : "Erreur lors de la création.",
      );
    } finally {
      setIsActionBusy(false);
    }
  }

  async function handleDeleteAdmin(adminId: string) {
    setIsActionBusy(true);
    try {
      await adminManagementApi.remove(adminId);
      fetchAdmins();
    } catch (err) {
      setErrorMessage(
        err instanceof AdminApiError ? err.message : "Suppression impossible.",
      );
    } finally {
      setIsActionBusy(false);
    }
  }

  async function handleToggleAdminActive(adminAccount: AdminAccount) {
    setIsActionBusy(true);
    try {
      if (adminAccount.isActive) {
        await adminManagementApi.deactivate(adminAccount.id);
      } else {
        await adminManagementApi.activate(adminAccount.id);
      }
      fetchAdmins();
    } finally {
      setIsActionBusy(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* ── En-tête ────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-semibold">Administrateurs</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Gestion des comptes administrateurs de la plateforme.
        </p>
      </div>

      {/* ── Formulaire de création ─────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Plus className="h-4 w-4" />
            Ajouter un administrateur
          </CardTitle>
          <CardDescription>
            Le compte créé aura le rôle Admin. Seul le super admin peut créer
            d&apos;autres super admins.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorMessage && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleCreateAdmin} className="flex items-end gap-3">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="admin-email">Email</Label>
              <Input
                id="admin-email"
                type="email"
                required
                autoComplete="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="admin@vendeoai.com"
              />
            </div>

            <div className="flex-1 space-y-1.5">
              <Label htmlFor="admin-password">Mot de passe</Label>
              <div className="relative">
                <Input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={10}
                  autoComplete="new-password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Min. 10 caractères"
                  className="pr-10"
                />
                <button
                  type="button"
                  aria-label={
                    showPassword
                      ? "Masquer le mot de passe"
                      : "Afficher le mot de passe"
                  }
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <Button type="submit" disabled={isActionBusy} className="shrink-0">
              {isActionBusy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Créer
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ── Tableau des administrateurs ────────────────────────────── */}
      <div className="overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Administrateur</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Dernière connexion</TableHead>
              <TableHead className="w-[120px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <AdminTableSkeletonRows />
            ) : adminAccounts.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-12 text-center text-muted-foreground"
                >
                  Aucun administrateur.
                </TableCell>
              </TableRow>
            ) : (
              adminAccounts.map((adminAccount) => (
                <TableRow key={adminAccount.id}>
                  {/* Email + avatar */}
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                        {adminAccount.email[0].toUpperCase()}
                      </div>
                      <span className="text-sm font-medium">
                        {adminAccount.email}
                      </span>
                    </div>
                  </TableCell>

                  {/* Rôle */}
                  <TableCell>
                    {adminAccount.role === "SUPER_ADMIN" ? (
                      <Badge
                        variant="outline"
                        className="gap-1.5 border-yellow-500/30 bg-yellow-500/5 text-yellow-500"
                      >
                        <Crown className="h-3 w-3" />
                        Super admin
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1.5">
                        <ShieldCheck className="h-3 w-3" />
                        Admin
                      </Badge>
                    )}
                  </TableCell>

                  {/* Statut */}
                  <TableCell>
                    {adminAccount.isActive ? (
                      <Badge
                        variant="outline"
                        className="border-primary/30 bg-primary/5 text-primary"
                      >
                        Actif
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-muted-foreground"
                      >
                        Désactivé
                      </Badge>
                    )}
                  </TableCell>

                  {/* Dernière connexion */}
                  <TableCell className="text-sm tabular-nums text-muted-foreground">
                    {adminAccount.lastLoginAt
                      ? new Date(adminAccount.lastLoginAt).toLocaleDateString(
                          "fr-FR",
                        )
                      : "—"}
                  </TableCell>

                  {/* Actions — masquées pour SUPER_ADMIN */}
                  <TableCell>
                    {adminAccount.role !== "SUPER_ADMIN" && (
                      <div className="flex items-center justify-end gap-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isActionBusy}
                          onClick={() => handleToggleAdminActive(adminAccount)}
                          className="h-7 text-xs"
                        >
                          {adminAccount.isActive ? "Désactiver" : "Activer"}
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={isActionBusy}
                              className="h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                            >
                              Supprimer
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Supprimer {adminAccount.email} ?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Cette action est irréversible.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() =>
                                  handleDeleteAdmin(adminAccount.id)
                                }
                              >
                                Supprimer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
