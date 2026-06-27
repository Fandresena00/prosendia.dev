"use client";

// app/(workspace)/admins/page.tsx — Linear dark style

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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

function SkeletonRows() {
  return Array.from({ length: 3 }).map((_, i) => (
    <TableRow key={i} className="hover:bg-transparent border-border/40">
      {Array.from({ length: 5 }).map((_, j) => (
        <TableCell key={j}>
          <Skeleton className="h-3.5 w-full bg-white/5" />
        </TableCell>
      ))}
    </TableRow>
  ));
}

export default function AdminsPage() {
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fetchAdmins = useCallback(() => {
    let cancelled = false;
    adminManagementApi
      .list()
      .then((d) => {
        if (!cancelled) setAccounts(d);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
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
      setError(
        err instanceof AdminApiError ? err.message : "Erreur de création.",
      );
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
      setError(err instanceof AdminApiError ? err.message : "Erreur.");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggle(account: AdminAccount) {
    setBusy(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      account.isActive
        ? await adminManagementApi.deactivate(account.id)
        : await adminManagementApi.activate(account.id);
      fetchAdmins();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-[18px] font-semibold tracking-tight">
          Administrateurs
        </h1>
        <p className="mt-0.5 text-[12px] text-muted-foreground/60">
          Gestion des accès admin
        </p>
      </div>

      {/* Create form */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border/60 px-4 py-3">
          <p className="text-[13px] font-semibold">Ajouter un administrateur</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground/50">
            Rôle Admin uniquement. Le Super Admin est créé uniquement via le
            seed.
          </p>
        </div>
        <div className="p-4">
          {error && (
            <Alert variant="destructive" className="mb-3 py-2.5 text-xs">
              <AlertCircle className="h-3.5 w-3.5" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleCreate} className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <label className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/50">
                Email
              </label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@vendeoai.com"
                className="h-8 bg-background/60 text-sm"
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <label className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/50">
                Mot de passe
              </label>
              <div className="relative">
                <Input
                  type={showPwd ? "text" : "password"}
                  required
                  minLength={10}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 10 caractères"
                  className="h-8 bg-background/60 pr-8 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((p) => !p)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground"
                >
                  {showPwd ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={busy}
              className="h-8 shrink-0 text-xs"
            >
              {busy ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="mr-1.5 h-3.5 w-3.5" />
              )}
              Créer
            </Button>
          </form>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border/60">
              {[
                "Administrateur",
                "Rôle",
                "Statut",
                "Dernière connexion",
                "",
              ].map((h) => (
                <TableHead
                  key={h}
                  className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/40"
                >
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <SkeletonRows />
            ) : accounts.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-16 text-center text-sm text-muted-foreground/40"
                >
                  Aucun administrateur
                </TableCell>
              </TableRow>
            ) : (
              accounts.map((account) => (
                <TableRow
                  key={account.id}
                  className="border-border/40 hover:bg-white/2"
                >
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white/5 text-[11px] font-bold">
                        {account.email[0].toUpperCase()}
                      </div>
                      <span className="text-[13px] font-medium">
                        {account.email}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {account.role === "SUPER_ADMIN" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/10 px-2 py-0.5 text-[10px] font-semibold text-yellow-400">
                        <Crown className="h-2.5 w-2.5" />
                        Super admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        <ShieldCheck className="h-2.5 w-2.5" />
                        Admin
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {account.isActive ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Actif
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/40">
                        Désactivé
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-[11px] text-muted-foreground/40">
                    {account.lastLoginAt
                      ? new Date(account.lastLoginAt).toLocaleDateString(
                          "fr-FR",
                        )
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {account.role !== "SUPER_ADMIN" && (
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => handleToggle(account)}
                          className="h-6 text-[11px] text-muted-foreground hover:text-foreground"
                        >
                          {account.isActive ? "Désactiver" : "Activer"}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={busy}
                              className="h-6 text-[11px] text-muted-foreground/40 hover:bg-destructive/10 hover:text-destructive"
                            >
                              Supprimer
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Supprimer {account.email} ?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Action irréversible.
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
