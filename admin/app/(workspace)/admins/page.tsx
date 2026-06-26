"use client";

// app/(workspace)/admins/page.tsx — gestion admins, design soigné

import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AdminApiError, adminManagementApi, type AdminAccount,
} from "@/lib/admin-api";
import {
  AlertCircle, Crown, Eye, EyeOff,
  Loader2, Plus, ShieldCheck, Settings,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

// ─── Skeleton rows ───────────────────────────────────────────────────────────

function SkeletonRows() {
  return Array.from({ length: 3 }).map((_, i) => (
    <TableRow key={i} className="hover:bg-transparent">
      {Array.from({ length: 5 }).map((_, j) => (
        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
      ))}
    </TableRow>
  ));
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AdminAdminsPage() {
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fetchAdmins = useCallback(() => {
    let cancelled = false;
    adminManagementApi.list()
      .then((data) => { if (!cancelled) setAccounts(data); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => fetchAdmins(), [fetchAdmins]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await adminManagementApi.create(email, password);
      setEmail("");
      setPassword("");
      fetchAdmins();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Erreur lors de la création.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    setBusy(true);
    try {
      await adminManagementApi.remove(id);
      fetchAdmins();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Suppression impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggle(account: AdminAccount) {
    setBusy(true);
    try {
      account.isActive
        ? await adminManagementApi.deactivate(account.id)
        : await adminManagementApi.activate(account.id);
      fetchAdmins();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Administrateurs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestion des accès admin à la plateforme
          </p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/60">
          <Settings className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      {/* ── Création ────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <p className="text-sm font-semibold">Ajouter un administrateur</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Le compte créé aura le rôle <strong>Admin</strong>. Seul le super admin peut être créé via le script de seed.
          </p>
        </div>
        <div className="p-5">
          {error && (
            <Alert variant="destructive" className="mb-4 py-3">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">{error}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleCreate} className="flex items-end gap-3">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="admin-email" className="text-xs uppercase tracking-wide text-muted-foreground">
                Email
              </Label>
              <Input
                id="admin-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@vendeoai.com"
                className="h-9 text-sm"
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="admin-password" className="text-xs uppercase tracking-wide text-muted-foreground">
                Mot de passe
              </Label>
              <div className="relative">
                <Input
                  id="admin-password"
                  type={showPwd ? "text" : "password"}
                  required
                  minLength={10}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 10 caractères"
                  className="h-9 pr-9 text-sm"
                />
                <button
                  type="button"
                  aria-label={showPwd ? "Masquer" : "Afficher"}
                  onClick={() => setShowPwd((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground"
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" size="sm" disabled={busy} className="h-9 shrink-0">
              {busy
                ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                : <Plus className="mr-1.5 h-3.5 w-3.5" />}
              Créer
            </Button>
          </form>
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Administrateur</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Dernière connexion</TableHead>
              <TableHead className="w-[140px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <SkeletonRows />
            ) : accounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-16 text-center">
                  <p className="text-sm font-medium">Aucun administrateur</p>
                </TableCell>
              </TableRow>
            ) : (
              accounts.map((account) => (
                <TableRow key={account.id}>
                  {/* Avatar + email */}
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
                        {account.email[0].toUpperCase()}
                      </div>
                      <span className="text-sm font-medium">{account.email}</span>
                    </div>
                  </TableCell>

                  {/* Rôle */}
                  <TableCell>
                    {account.role === "SUPER_ADMIN" ? (
                      <Badge variant="outline" className="gap-1.5 border-yellow-500/30 bg-yellow-500/5 text-yellow-600 dark:text-yellow-400">
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
                    {account.isActive ? (
                      <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400">
                        Actif
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Désactivé
                      </Badge>
                    )}
                  </TableCell>

                  {/* Dernière connexion */}
                  <TableCell className="text-sm tabular-nums text-muted-foreground">
                    {account.lastLoginAt
                      ? new Date(account.lastLoginAt).toLocaleDateString("fr-FR")
                      : "—"}
                  </TableCell>

                  {/* Actions */}
                  <TableCell>
                    {account.role !== "SUPER_ADMIN" && (
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => handleToggle(account)}
                          className="h-7 text-xs"
                        >
                          {account.isActive ? "Désactiver" : "Activer"}
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={busy}
                              className="h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                            >
                              Supprimer
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Supprimer {account.email} ?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Cette action est irréversible.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => handleDelete(account.id)}
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
