"use client";

// app/(workspace)/admins/page.tsx

import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminApiError, adminManagementApi, type AdminAccount } from "@/lib/admin-api";
import { AlertCircle, Crown, Eye, EyeOff, Loader2, Plus, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

function SkeletonRows() {
  return Array.from({ length: 3 }).map((_, i) => (
    <TableRow key={i} className="border-border/70 hover:bg-transparent">
      {Array.from({ length: 5 }).map((_, j) => (
        <TableCell key={j}><Skeleton className="h-3.5 w-full" /></TableCell>
      ))}
    </TableRow>
  ));
}

export default function AdminsPage() {
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPwd,  setShowPwd]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [busy,     setBusy]     = useState(false);

  const load = useCallback(() => {
    let cancelled = false;
    adminManagementApi.list()
      .then((d) => { if (!cancelled) setAccounts(d); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => load(), [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      await adminManagementApi.create(email, password);
      setEmail(""); setPassword(""); load();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Erreur de création.");
    } finally { setBusy(false); }
  }

  async function handleDelete(id: string) {
    setBusy(true);
    try { await adminManagementApi.remove(id); load(); }
    catch (err) { setError(err instanceof AdminApiError ? err.message : "Erreur."); }
    finally { setBusy(false); }
  }

  async function handleToggle(account: AdminAccount) {
    setBusy(true);
    try {
      account.isActive
        ? await adminManagementApi.deactivate(account.id)
        : await adminManagementApi.activate(account.id);
      load();
    } finally { setBusy(false); }
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Administrateurs</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Gestion des accès admin à la plateforme
        </p>
      </div>

      {/* Create form — hairline in emerald: this card's job is a positive action */}
      <div className="glass-card">
        <div
          className="card-hairline"
          style={{ background: "linear-gradient(90deg, transparent, var(--secondary), transparent)" }}
        />
        <div className="border-b border-border/60 px-4 py-3">
          <p className="text-sm font-semibold">Ajouter un administrateur</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Rôle Admin uniquement — le Super Admin est créé via le script de seed.
          </p>
        </div>
        <div className="p-4">
          {error && (
            <Alert variant="destructive" className="mb-3 py-2.5 text-sm">
              <AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleCreate} className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <label className="text-label">Email</label>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@vendeoai.com" className="h-9 bg-background/60 text-sm" />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-label">Mot de passe</label>
              <div className="relative">
                <Input type={showPwd ? "text" : "password"} required minLength={10}
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 10 caractères" className="h-9 bg-background/60 pr-9 text-sm" />
                <button type="button" onClick={() => setShowPwd((p) => !p)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" size="sm" disabled={busy}
              className="h-9 shrink-0 bg-secondary text-secondary-foreground hover:bg-secondary/90">
              {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
              Créer
            </Button>
          </form>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              {["Administrateur", "Rôle", "Statut", "Dernière connexion", ""].map((h) => (
                <TableHead key={h} className="text-label">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? <SkeletonRows /> :
              accounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-16 text-center text-sm text-muted-foreground">
                    Aucun administrateur
                  </TableCell>
                </TableRow>
              ) : accounts.map((account) => (
                <TableRow key={account.id} className="group border-border/70 hover:bg-primary/5">
                  {/* Avatar + email */}
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-[11px] font-bold text-secondary-foreground ring-1 ring-secondary/20 dark:text-secondary">
                        {account.email[0].toUpperCase()}
                      </div>
                      <span className="text-sm font-medium">{account.email}</span>
                    </div>
                  </TableCell>
                  {/* Rôle */}
                  <TableCell>
                    {account.role === "SUPER_ADMIN" ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-warning/25 bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning">
                        <Crown className="h-3 w-3" />Super admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                        <ShieldCheck className="h-3 w-3" />Admin
                      </span>
                    )}
                  </TableCell>
                  {/* Statut */}
                  <TableCell>
                    {account.isActive ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-secondary-foreground dark:text-secondary">
                        <span className="h-1.5 w-1.5 rounded-full bg-secondary" />Actif
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Désactivé</span>
                    )}
                  </TableCell>
                  {/* Dernière connexion */}
                  <TableCell className="tabular text-xs text-muted-foreground">
                    {account.lastLoginAt ? new Date(account.lastLoginAt).toLocaleDateString("fr-FR") : "—"}
                  </TableCell>
                  {/* Actions — hidden until hover, house-style restraint */}
                  <TableCell>
                    {account.role !== "SUPER_ADMIN" && (
                      <div className="flex items-center justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button variant="ghost" size="sm" disabled={busy}
                          onClick={() => handleToggle(account)}
                          className="h-7 text-xs text-muted-foreground hover:text-foreground">
                          {account.isActive ? "Désactiver" : "Activer"}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" disabled={busy}
                              className="h-7 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                              Supprimer
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Supprimer {account.email} ?</AlertDialogTitle>
                              <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => handleDelete(account.id)}>
                                Supprimer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
