"use client";

// app/(workspace)/custom-plans/page.tsx
// Chaque config custom est liée à UN user spécifique.
// Dialog création : sélection user + config (formulaire unique)
// Dialog attribution manuelle : active la config sans paiement
// Cards : affichent user + config, bouton toggle visibilité

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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  adminCustomPlansApi,
  adminUsersApi,
  type AdminUserListItem,
  type CustomPlanTemplate,
} from "@/lib/admin-api";
import { cn } from "@/lib/utils";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Crown,
  Edit3,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

// ─── User picker ──────────────────────────────────────────────────────────────

function UserPicker({
  selected,
  onSelect,
}: {
  selected: AdminUserListItem | null;
  onSelect: (u: AdminUserListItem | null) => void;
}) {
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  function doSearch(s: string, p: number) {
    setLoading(true);
    adminUsersApi
      .list({ search: s || undefined, page: p, pageSize: 6 })
      .then((r) => {
        setUsers(r.data);
        setTotal(r.pagination.total);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    doSearch("", 1);
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    doSearch(search, 1);
  }

  return (
    <div className="space-y-2">
      <Label className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground/50">
        Utilisateur *
      </Label>
      <form onSubmit={handleSearch} className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/40" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Email ou nom…"
          className="h-8 pl-8 text-xs bg-background/60"
        />
      </form>

      <div className="rounded-md border border-border/40 overflow-hidden max-h-40 overflow-y-auto">
        {loading ? (
          <div className="p-2 space-y-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full bg-white/5" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground/40">
            Aucun résultat
          </p>
        ) : (
          users.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => onSelect(selected?.id === u.id ? null : u)}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/5 border-b border-border/20 last:border-0 text-xs",
                selected?.id === u.id && "bg-primary/10",
              )}
            >
              <div className="flex h-5 w-5 items-center justify-center rounded bg-primary/15 text-[9px] font-bold text-primary shrink-0">
                {u.email[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-medium">{u.username}</span>
                <span className="ml-2 text-muted-foreground/50">{u.email}</span>
              </div>
              <Badge variant="outline" className="text-[9px] h-4 shrink-0">
                {u.activePlan}
              </Badge>
              {selected?.id === u.id && (
                <Check className="h-3 w-3 text-primary shrink-0" />
              )}
            </button>
          ))
        )}
      </div>

      {total > 6 && (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            disabled={page <= 1}
            onClick={() => {
              setPage((p) => p - 1);
              doSearch(search, page - 1);
            }}
          >
            <ChevronLeft className="h-3 w-3" />
          </Button>
          <span className="text-[10px] text-muted-foreground/30">{page}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            disabled={page * 6 >= total}
            onClick={() => {
              setPage((p) => p + 1);
              doSearch(search, page + 1);
            }}
          >
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      )}

      {selected && (
        <div className="flex items-center gap-2 rounded-md bg-primary/10 border border-primary/20 px-3 py-1.5">
          <Check className="h-3 w-3 text-primary shrink-0" />
          <span className="text-[11px] font-medium text-primary">
            {selected.email}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Config form fields ───────────────────────────────────────────────────────

function ConfigFields({
  values,
  onChange,
}: {
  values: Record<string, string | boolean>;
  onChange: (key: string, val: string | boolean) => void;
}) {
  const fields = [
    {
      key: "name",
      label: "Nom affiché",
      type: "text",
      placeholder: "Plan Entreprise",
    },
    {
      key: "description",
      label: "Description",
      type: "text",
      placeholder: "Offre sur mesure…",
    },
    {
      key: "priceAriary",
      label: "Prix (Ar) *",
      type: "number",
      placeholder: "50000",
    },
    {
      key: "durationDays",
      label: "Durée (jours) *",
      type: "number",
      placeholder: "30",
    },
    {
      key: "credits",
      label: "Crédits IA *",
      type: "number",
      placeholder: "50000",
    },
    {
      key: "maxPages",
      label: "Pages max *",
      type: "number",
      placeholder: "10",
    },
    {
      key: "maxManagedPosts",
      label: "Posts gérés max *",
      type: "number",
      placeholder: "50",
    },
    {
      key: "maxReferenceImages",
      label: "Images de réf. max *",
      type: "number",
      placeholder: "200",
    },
    {
      key: "note",
      label: "Note interne",
      type: "text",
      placeholder: "Accord spécial…",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {fields.map((f) => (
        <div
          key={f.key}
          className={
            ["name", "description", "note"].includes(f.key) ? "col-span-2" : ""
          }
        >
          <Label className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground/50">
            {f.label}
          </Label>
          <Input
            type={f.type}
            placeholder={f.placeholder}
            value={String(values[f.key] ?? "")}
            onChange={(e) => onChange(f.key, e.target.value)}
            className="mt-1 h-8 bg-background/60 text-xs"
          />
        </div>
      ))}
      <div className="col-span-2 space-y-1.5">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(values.isVisible ?? true)}
            onChange={(e) => onChange("isVisible", e.target.checked)}
            className="h-3.5 w-3.5 accent-primary"
          />
          <span className="text-[11px] text-muted-foreground">
            Visible dans /billing de l&apos;utilisateur
          </span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(values.isPurchasable ?? true)}
            onChange={(e) => onChange("isPurchasable", e.target.checked)}
            className="h-3.5 w-3.5 accent-primary"
          />
          <span className="text-[11px] text-muted-foreground">
            Achetable via Papi (désactiver = attribution manuelle uniquement)
          </span>
        </label>
      </div>
    </div>
  );
}

// ─── Config card ──────────────────────────────────────────────────────────────

function ConfigCard({
  config,
  onEdit,
  onToggle,
  onDelete,
  onAssign,
  busy,
}: {
  config: CustomPlanTemplate & { userEmail?: string; userName?: string };
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onAssign: () => void;
  busy: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4 space-y-3 transition-all",
        config.isActive ? "border-border" : "border-border/30 opacity-50",
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Crown className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
            <p className="text-[13px] font-semibold truncate">{config.name}</p>
          </div>
          {/* User associé */}
          <div className="flex items-center gap-1.5">
            <div className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/15 text-[8px] font-bold text-primary shrink-0">
              {(config.userEmail ?? "?")?.[0]?.toUpperCase()}
            </div>
            <span className="text-[11px] text-muted-foreground/60 truncate">
              {config.userEmail ?? "—"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {config.isActive ? (
            <Badge
              variant="outline"
              className="h-4 text-[9px] border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
            >
              Visible
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="h-4 text-[9px] text-muted-foreground/40"
            >
              Caché
            </Badge>
          )}
          {!config.isPurchasable && (
            <Badge
              variant="outline"
              className="h-4 text-[9px] border-orange-500/30 bg-orange-500/10 text-orange-400"
            >
              Manuel
            </Badge>
          )}
        </div>
      </div>

      {/* Specs */}
      <div className="grid grid-cols-2 gap-1">
        {[
          {
            label: "Crédits",
            val: (config.credits ?? 0).toLocaleString("fr-FR"),
          },
          { label: "Durée", val: `${config.durationDays ?? 30}j` },
          { label: "Pages", val: config.maxPages ?? "—" },
          { label: "Posts", val: config.maxManagedPosts ?? "—" },
        ].map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between rounded bg-white/5 px-2 py-1"
          >
            <span className="text-[10px] text-muted-foreground/40">
              {item.label}
            </span>
            <span className="font-mono text-[11px] font-semibold">
              {item.val}
            </span>
          </div>
        ))}
      </div>

      {/* Price + actions */}
      <div className="flex items-center justify-between pt-1">
        <p className="font-mono text-[14px] font-bold text-primary">
          {(config.priceAriary ?? 0) === 0
            ? "Gratuit"
            : `${(config.priceAriary ?? 0).toLocaleString("fr-FR")} Ar`}
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
            onClick={onEdit}
            disabled={busy}
            title="Modifier"
          >
            <Edit3 className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
            onClick={onToggle}
            disabled={busy}
            title={config.isActive ? "Masquer" : "Afficher"}
          >
            {config.isActive ? (
              <EyeOff className="h-3 w-3" />
            ) : (
              <Eye className="h-3 w-3" />
            )}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground/40 hover:text-destructive"
                disabled={busy}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Supprimer la config de {config.userEmail} ?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  L&apos;offre custom disparaîtra de la page /billing de
                  l&apos;utilisateur. Les abonnements existants ne seront pas
                  affectés.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={onDelete}
                >
                  Supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Attribuer manuellement */}
      <Button
        variant="outline"
        size="sm"
        className="w-full h-7 text-[11px] gap-1.5 border-border/40 text-muted-foreground hover:text-foreground"
        onClick={onAssign}
        disabled={busy}
      >
        <Users className="h-3 w-3" />
        Attribuer maintenant (sans paiement)
      </Button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const EMPTY_FORM: Record<string, string | boolean> = {
  name: "",
  description: "",
  priceAriary: "",
  durationDays: "30",
  credits: "",
  maxPages: "",
  maxManagedPosts: "",
  maxReferenceImages: "",
  isVisible: true,
  isPurchasable: true,
  note: "",
};

export default function CustomPlansPage() {
  const [configs, setConfigs] = useState<
    (CustomPlanTemplate & { userEmail?: string; userName?: string })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showInvisible, setShowInvisible] = useState(false);

  // Dialog créer / modifier
  const [dialog, setDialog] = useState(false);
  const [editingConfig, setEditingConfig] = useState<CustomPlanTemplate | null>(
    null,
  );
  const [selectedUser, setSelectedUser] = useState<AdminUserListItem | null>(
    null,
  );
  const [formValues, setFormValues] =
    useState<Record<string, string | boolean>>(EMPTY_FORM);

  // Dialog attribuer manuellement
  const [assignDialog, setAssignDialog] = useState(false);
  const [assigningConfig, setAssigningConfig] =
    useState<CustomPlanTemplate | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    adminCustomPlansApi
      .list(showInvisible)
      .then((d) => {
        if (!cancelled) setConfigs(d as typeof configs);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showInvisible]);

  useEffect(() => load(), [load]);

  function openCreate() {
    setEditingConfig(null);
    setSelectedUser(null);
    setFormValues(EMPTY_FORM);
    setDialog(true);
  }

  function openEdit(config: (typeof configs)[0]) {
    setEditingConfig(config);
    setSelectedUser(null); // pas besoin de resélectionner le user
    setFormValues({
      name: config.name ?? "",
      description: config.description ?? "",
      priceAriary: String(config.priceAriary ?? 0),
      durationDays: String(config.durationDays ?? 30),
      credits: String(config.credits ?? ""),
      maxPages: String(config.maxPages ?? ""),
      maxManagedPosts: String(config.maxManagedPosts ?? ""),
      maxReferenceImages: String(config.maxReferenceImages ?? ""),
      isVisible: config.isActive ?? true,
      isPurchasable:
        ((config as Record<string, unknown>).isPurchasable as boolean) ?? true,
      note: ((config as Record<string, unknown>).note as string) ?? "",
    });
    setDialog(true);
  }

  async function handleSave() {
    if (!editingConfig && !selectedUser) return;
    setBusy(true);
    try {
      const payload = {
        userId: selectedUser?.id ?? editingConfig?.id ?? "",
        name: String(formValues.name) || undefined,
        description: String(formValues.description) || undefined,
        priceAriary: parseInt(String(formValues.priceAriary)),
        durationDays: parseInt(String(formValues.durationDays)) || 30,
        credits: parseInt(String(formValues.credits)),
        maxPages: parseInt(String(formValues.maxPages)),
        maxManagedPosts: parseInt(String(formValues.maxManagedPosts)),
        maxReferenceImages: parseInt(String(formValues.maxReferenceImages)),
        isVisible: Boolean(formValues.isVisible),
        isPurchasable: Boolean(formValues.isPurchasable),
        note: String(formValues.note) || undefined,
      };

      if (editingConfig) {
        await adminCustomPlansApi.update(editingConfig.id, payload);
      } else {
        await adminCustomPlansApi.create(payload);
      }
      setDialog(false);
      load();
    } finally {
      setBusy(false);
    }
  }

  async function handleToggle(config: (typeof configs)[0]) {
    setBusy(true);
    try {
      await adminCustomPlansApi.toggle(config.id);
      load();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(config: (typeof configs)[0]) {
    setBusy(true);
    try {
      await adminCustomPlansApi.remove(config.id);
      load();
    } finally {
      setBusy(false);
    }
  }

  async function handleAssign() {
    if (!assigningConfig) return;
    setBusy(true);
    try {
      // Récupère le userId depuis la config
      const userId = (assigningConfig as Record<string, unknown>)
        .userId as string;
      if (!userId) return;
      await adminUsersApi.createCustomSubscription(userId, {
        credits: assigningConfig.credits ?? 0,
        durationDays: assigningConfig.durationDays ?? 30,
        priceAriary: assigningConfig.priceAriary ?? 0,
        maxPages: assigningConfig.maxPages ?? 1,
        maxManagedPosts: assigningConfig.maxManagedPosts ?? 1,
        maxReferenceImages: assigningConfig.maxReferenceImages ?? 5,
        note: `Attribution manuelle — config: ${assigningConfig.name}`,
      });
      setAssignDialog(false);
    } finally {
      setBusy(false);
    }
  }

  const isFormValid = Boolean(
    formValues.credits &&
    formValues.priceAriary !== "" &&
    formValues.maxPages &&
    formValues.maxManagedPosts &&
    formValues.maxReferenceImages &&
    (editingConfig || selectedUser),
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight">
            Plans Custom
          </h1>
          <p className="mt-0.5 text-[12px] text-muted-foreground/60">
            Offres personnalisées — 1 config par utilisateur
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs text-muted-foreground"
            onClick={() => setShowInvisible((p) => !p)}
          >
            {showInvisible ? (
              <EyeOff className="h-3 w-3" />
            ) : (
              <Eye className="h-3 w-3" />
            )}
            {showInvisible ? "Masquer cachés" : "Voir cachés"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground"
            onClick={load}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={openCreate}
          >
            <Plus className="h-3.5 w-3.5" />
            Nouvelle config
          </Button>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-lg bg-card/50" />
          ))}
        </div>
      ) : configs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/40 py-20">
          <Sparkles className="mb-3 h-8 w-8 text-yellow-400/30" />
          <p className="text-sm font-medium text-foreground/50">
            Aucune config custom
          </p>
          <p className="mt-1 text-xs text-muted-foreground/30">
            Les users sans config voient "Contacter" pour le plan Custom.
          </p>
          <Button
            size="sm"
            className="mt-4 h-7 text-xs gap-1.5"
            onClick={openCreate}
          >
            <Plus className="h-3.5 w-3.5" />
            Créer la première
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {configs.map((config) => (
            <ConfigCard
              key={config.id}
              config={config}
              onEdit={() => openEdit(config)}
              onToggle={() => handleToggle(config)}
              onDelete={() => handleDelete(config)}
              onAssign={() => {
                setAssigningConfig(config);
                setAssignDialog(true);
              }}
              busy={busy}
            />
          ))}
        </div>
      )}

      {/* ── Dialog : Créer / éditer ────────────────────────────────── */}
      <Dialog
        open={dialog}
        onOpenChange={(o) => {
          if (!busy) setDialog(o);
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[15px] flex items-center gap-2">
              <Crown className="h-4 w-4 text-yellow-400" />
              {editingConfig ? "Modifier la config" : "Créer une config custom"}
            </DialogTitle>
            <DialogDescription className="text-[11px]">
              {editingConfig
                ? `Config de ${(editingConfig as Record<string, unknown>).userEmail ?? "…"}`
                : "Sélectionnez un utilisateur et définissez son offre personnalisée."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* User picker — uniquement à la création */}
            {!editingConfig && (
              <UserPicker selected={selectedUser} onSelect={setSelectedUser} />
            )}

            <ConfigFields
              values={formValues}
              onChange={(k, v) =>
                setFormValues((prev) => ({ ...prev, [k]: v }))
              }
            />
          </div>

          <DialogFooter className="gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialog(false)}
              disabled={busy}
            >
              Annuler
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={busy || !isFormValid}
            >
              {busy ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : null}
              {editingConfig ? "Enregistrer" : "Créer la config"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog : Attribution manuelle ─────────────────────────── */}
      <Dialog
        open={assignDialog}
        onOpenChange={(o) => {
          if (!busy) setAssignDialog(o);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[15px]">
              Attribuer sans paiement
            </DialogTitle>
            <DialogDescription className="text-[11px]">
              Active l'abonnement custom immédiatement pour{" "}
              <strong>
                {((assigningConfig as Record<string, unknown> | null)
                  ?.userEmail as string) ?? "cet utilisateur"}
              </strong>
              . Aucun paiement Papi ne sera déclenché.
            </DialogDescription>
          </DialogHeader>

          {assigningConfig && (
            <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4 space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <Crown className="h-3.5 w-3.5 text-yellow-400" />
                <p className="text-[13px] font-semibold">
                  {assigningConfig.name}
                </p>
              </div>
              {[
                {
                  label: "Crédits",
                  val: (assigningConfig.credits ?? 0).toLocaleString("fr-FR"),
                },
                {
                  label: "Durée",
                  val: `${assigningConfig.durationDays ?? 30} jours`,
                },
                { label: "Pages max", val: assigningConfig.maxPages ?? "—" },
                {
                  label: "Posts max",
                  val: assigningConfig.maxManagedPosts ?? "—",
                },
                {
                  label: "Prix affiché",
                  val:
                    (assigningConfig.priceAriary ?? 0) === 0
                      ? "Gratuit"
                      : `${(assigningConfig.priceAriary ?? 0).toLocaleString("fr-FR")} Ar`,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex justify-between text-[11px]"
                >
                  <span className="text-muted-foreground/50">{item.label}</span>
                  <span className="font-mono font-semibold">{item.val}</span>
                </div>
              ))}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAssignDialog(false)}
              disabled={busy}
            >
              Annuler
            </Button>
            <Button size="sm" onClick={handleAssign} disabled={busy}>
              {busy ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Users className="mr-1.5 h-3.5 w-3.5" />
              )}
              Attribuer maintenant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
