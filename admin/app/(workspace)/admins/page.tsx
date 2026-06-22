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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useEffect, useState } from "react";

export default function AdminAdminsPage() {
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    adminManagementApi
      .list()
      .then(setAdmins)
      .finally(() => setLoading(false));
  }
  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await adminManagementApi.create(email, password);
      setEmail("");
      setPassword("");
      load();
    } catch (err) {
      setError(
        err instanceof AdminApiError
          ? err.message
          : "Erreur lors de la création.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    setBusy(true);
    try {
      await adminManagementApi.remove(id);
      load();
    } catch (err) {
      setError(
        err instanceof AdminApiError ? err.message : "Suppression impossible.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleToggle(admin: AdminAccount) {
    setBusy(true);
    try {
      if (admin.isActive) await adminManagementApi.deactivate(admin.id);
      else await adminManagementApi.activate(admin.id);
      load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-[18px] font-semibold tracking-tight text-zinc-100">
          Administrateurs
        </h1>
        <p className="mt-0.5 text-[13px] text-zinc-500">
          Gestion des comptes administrateurs de la plateforme.
        </p>
      </div>

      {/* Create form */}
      <Card className="mb-6 border-zinc-800/60 bg-zinc-900/50">
        <CardHeader className="pb-0 pt-4">
          <CardTitle className="flex items-center gap-2 text-[13px] font-semibold text-zinc-300">
            <Plus className="h-3.5 w-3.5 text-zinc-500" />
            Ajouter un administrateur
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {error && (
            <Alert className="mb-4 border-red-900/50 bg-red-950/30 text-red-400 [&>svg]:text-red-400">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-[13px]">
                {error}
              </AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleCreate} className="flex items-end gap-3">
            <div className="flex-1 space-y-1.5">
              <Label className="text-[11px] font-medium text-zinc-500">
                Email
              </Label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@vendeoai.com"
                className="h-9 border-zinc-800 bg-zinc-950 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus-visible:border-emerald-500/50 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label className="text-[11px] font-medium text-zinc-500">
                Mot de passe
              </Label>
              <div className="relative">
                <Input
                  type={showPwd ? "text" : "password"}
                  required
                  minLength={10}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 10 caractères"
                  className="h-9 border-zinc-800 bg-zinc-950 pr-9 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus-visible:border-emerald-500/50 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
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
              disabled={busy}
              size="sm"
              className="h-9 shrink-0 bg-emerald-600 text-[12px] font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Créer"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-zinc-800/60">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800/60 hover:bg-transparent">
              {[
                "Administrateur",
                "Rôle",
                "Statut",
                "Dernière connexion",
                "",
              ].map((h) => (
                <TableHead
                  key={h}
                  className="bg-zinc-900/80 text-[11px] font-medium uppercase tracking-wider text-zinc-500"
                >
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow
                  key={i}
                  className="border-zinc-800/60 hover:bg-transparent"
                >
                  {Array.from({ length: 5 }).map((_, j) => (
                    <TableCell key={j} className="py-3">
                      <Skeleton className="h-4 w-full bg-zinc-800" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : admins.length === 0 ? (
              <TableRow className="border-zinc-800/60 hover:bg-transparent">
                <TableCell
                  colSpan={5}
                  className="py-10 text-center text-[13px] text-zinc-600"
                >
                  Aucun administrateur.
                </TableCell>
              </TableRow>
            ) : (
              admins.map((admin) => (
                <TableRow
                  key={admin.id}
                  className="border-zinc-800/40 transition-colors hover:bg-zinc-900/40"
                >
                  <TableCell className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[11px] font-semibold text-zinc-300">
                        {admin.email[0].toUpperCase()}
                      </div>
                      <span className="text-[13px] text-zinc-200">
                        {admin.email}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    {admin.role === "SUPER_ADMIN" ? (
                      <Badge
                        variant="outline"
                        className="gap-1 border-amber-800/40 bg-amber-950/30 text-[11px] text-amber-400"
                      >
                        <Crown className="h-2.5 w-2.5" />
                        Super admin
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="gap-1 border-zinc-700 bg-zinc-800/40 text-[11px] text-zinc-400"
                      >
                        <ShieldCheck className="h-2.5 w-2.5" />
                        Admin
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="py-3">
                    {admin.isActive ? (
                      <Badge
                        variant="outline"
                        className="border-emerald-900/50 bg-emerald-950/30 text-[11px] text-emerald-400"
                      >
                        Actif
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="border-zinc-700 bg-zinc-800/40 text-[11px] text-zinc-500"
                      >
                        Désactivé
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="py-3 text-[12px] text-zinc-500">
                    {admin.lastLoginAt
                      ? new Date(admin.lastLoginAt).toLocaleDateString("fr-FR")
                      : "—"}
                  </TableCell>
                  <TableCell className="py-3 text-right">
                    {admin.role !== "SUPER_ADMIN" && (
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => handleToggle(admin)}
                          disabled={busy}
                          className="text-[12px] text-zinc-400 transition-colors hover:text-zinc-100 disabled:opacity-40"
                        >
                          {admin.isActive ? "Désactiver" : "Activer"}
                        </button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button
                              disabled={busy}
                              className="text-[12px] text-red-500/70 transition-colors hover:text-red-400 disabled:opacity-40"
                            >
                              Supprimer
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="border-zinc-800 bg-zinc-900 text-zinc-100">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-[15px]">
                                Supprimer {admin.email} ?
                              </AlertDialogTitle>
                              <AlertDialogDescription className="text-[13px] text-zinc-500">
                                Cette action est irréversible.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="border-zinc-800 bg-transparent text-zinc-400 hover:bg-zinc-900">
                                Annuler
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(admin.id)}
                                className="bg-red-600 hover:bg-red-500 text-[12px]"
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
