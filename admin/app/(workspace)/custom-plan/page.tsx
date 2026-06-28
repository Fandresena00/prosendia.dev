"use client";

// app/(workspace)/custom-plans/page.tsx
// Gestion des templates de plans custom
// Deux dialogs séparés : Créer un template / Attribuer à un user
// Design Linear dark

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
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Crown,
  Edit3,
  Eye,
  EyeOff,
  Image,
  Layers,
  Loader2,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

// ─── Template card ────────────────────────────────────────────────────────────

function TemplateCard({
  t,
  onEdit,
  onToggle,
  onDelete,
  busy,
}: {
  t: CustomPlanTemplate;
  onEdit: (t: CustomPlanTemplate) => void;
  onToggle: (t: CustomPlanTemplate) => void;
  onDelete: (t: CustomPlanTemplate) => void;
  busy: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4 transition-all",
        t.isActive ? "border-border" : "border-border/30 opacity-50",
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <Crown className="h-3.5 w-3.5 text-yellow-400" />
            <p className="text-[13px] font-semibold text-foreground">
              {t.name}
            </p>
          </div>
          {t.description && (
            <p className="mt-0.5 text-[11px] text-muted-foreground/60 leading-snug">
              {t.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {t.isPublic ? (
            <Badge
              variant="outline"
              className="h-5 text-[9px] border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
            >
              Public
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="h-5 text-[9px] text-muted-foreground/50"
            >
              Privé
            </Badge>
          )}
        </div>
      </div>

      {/* Specs grid */}
      <div className="grid grid-cols-2 gap-1.5 mb-4">
        {[
          {
            icon: CreditCard,
            label: "Crédits",
            val: t.credits.toLocaleString("fr-FR"),
          },
          { icon: Calendar, label: "Durée", val: `${t.durationDays} jours` },
          { icon: Layers, label: "Pages max", val: t.maxPages },
          { icon: Image, label: "Images max", val: t.maxReferenceImages },
        ].map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-1.5 rounded bg-white/5 px-2 py-1.5"
          >
            <item.icon className="h-3 w-3 text-muted-foreground/40 shrink-0" />
            <span className="text-[10px] text-muted-foreground/50">
              {item.label}
            </span>
            <span className="ml-auto font-mono text-[11px] font-semibold text-foreground">
              {item.val}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <p className="font-mono text-[15px] font-bold text-primary">
          {t.priceAriary === 0
            ? "Gratuit"
            : `${t.priceAriary.toLocaleString("fr-FR")} Ar`}
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={() => onEdit(t)}
            disabled={busy}
          >
            <Edit3 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={() => onToggle(t)}
            disabled={busy}
          >
            {t.isActive ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground/40 hover:text-destructive"
                disabled={busy}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Supprimer &quot;{t.name}&quot; ?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Le template sera désactivé. Les abonnements existants ne
                  seront pas affectés.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => onDelete(t)}
                >
                  Supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}

// ─── Template form fields ─────────────────────────────────────────────────────

function TemplateFormFields({
  values,
  onChange,
}: {
  values: Record<string, string | boolean>;
  onChange: (key: string, val: string | boolean) => void;
}) {
  const fields = [
    {
      key: "name",
      label: "Nom *",
      type: "text",
      placeholder: "Ex: Entreprise 50k",
      required: true,
    },
    {
      key: "description",
      label: "Description",
      type: "text",
      placeholder: "Description courte",
    },
    {
      key: "priceAriary",
      label: "Prix (Ar) *",
      type: "number",
      placeholder: "50000",
      required: true,
    },
    {
      key: "durationDays",
      label: "Durée (jours) *",
      type: "number",
      placeholder: "30",
      required: true,
    },
    {
      key: "credits",
      label: "Crédits IA *",
      type: "number",
      placeholder: "50000",
      required: true,
    },
    {
      key: "maxPages",
      label: "Pages max *",
      type: "number",
      placeholder: "10",
      required: true,
    },
    {
      key: "maxManagedPosts",
      label: "Posts gérés max *",
      type: "number",
      placeholder: "50",
      required: true,
    },
    {
      key: "maxReferenceImages",
      label: "Images de réf. max *",
      type: "number",
      placeholder: "200",
      required: true,
    },
    {
      key: "note",
      label: "Note interne",
      type: "text",
      placeholder: "Accord commercial…",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {fields.map((f) => (
        <div
          key={f.key}
          className={
            f.key === "name" || f.key === "description" || f.key === "note"
              ? "col-span-2"
              : ""
          }
        >
          <Label className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
            {f.label}
          </Label>
          <Input
            type={f.type}
            placeholder={f.placeholder}
            value={String(values[f.key] ?? "")}
            onChange={(e) => onChange(f.key, e.target.value)}
            className="mt-1 h-8 bg-background/60 text-sm"
          />
        </div>
      ))}
      <div className="col-span-2 flex items-center gap-2">
        <input
          type="checkbox"
          id="isPublic"
          checked={Boolean(values.isPublic ?? true)}
          onChange={(e) => onChange("isPublic", e.target.checked)}
          className="h-3.5 w-3.5 accent-primary"
        />
        <label
          htmlFor="isPublic"
          className="text-[12px] text-muted-foreground cursor-pointer"
        >
          Visible publiquement sur la page abonnements
        </label>
      </div>
    </div>
  );
}

// ─── User selector for attribution ───────────────────────────────────────────

function UserSelector({
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
      .list({ search: s || undefined, page: p, pageSize: 8 })
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
      <form onSubmit={handleSearch} className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/40" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Email ou nom…"
          className="h-7 pl-8 text-xs bg-background/60"
        />
      </form>
      <div className="rounded-md border border-border/40 overflow-hidden">
        {loading ? (
          <div className="p-3 space-y-1.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-full bg-white/5" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground/40">
            Aucun utilisateur
          </p>
        ) : (
          <div>
            {users.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => onSelect(selected?.id === u.id ? null : u)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/5 border-b border-border/20 last:border-0",
                  selected?.id === u.id && "bg-primary/10",
                )}
              >
                <div className="flex h-5 w-5 items-center justify-center rounded bg-primary/15 text-[9px] font-bold text-primary">
                  {u.email[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium truncate">
                    {u.username}
                  </p>
                  <p className="text-[10px] text-muted-foreground/50 truncate">
                    {u.email}
                  </p>
                </div>
                {selected?.id === u.id && (
                  <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      {total > 8 && (
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground/30">
            {total} résultats
          </p>
          <div className="flex gap-1">
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
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              disabled={page * 8 >= total}
              onClick={() => {
                setPage((p) => p + 1);
                doSearch(search, page + 1);
              }}
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
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
  isPublic: true,
  note: "",
};

export default function CustomPlansPage() {
  const [templates, setTemplates] = useState<CustomPlanTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  // Dialog: créer/éditer template
  const [templateDialog, setTemplateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] =
    useState<CustomPlanTemplate | null>(null);
  const [formValues, setFormValues] =
    useState<Record<string, string | boolean>>(EMPTY_FORM);

  // Dialog: attribuer template à un user
  const [assignDialog, setAssignDialog] = useState(false);
  const [assignTemplate, setAssignTemplate] =
    useState<CustomPlanTemplate | null>(null);
  const [assignUser, setAssignUser] = useState<AdminUserListItem | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    adminCustomPlansApi
      .list(showInactive)
      .then((d) => {
        if (!cancelled) setTemplates(d);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showInactive]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => load(), [load]);

  function openCreate() {
    setEditingTemplate(null);
    setFormValues(EMPTY_FORM);
    setTemplateDialog(true);
  }

  function openEdit(t: CustomPlanTemplate) {
    setEditingTemplate(t);
    setFormValues({
      name: t.name,
      description: t.description ?? "",
      priceAriary: String(t.priceAriary),
      durationDays: String(t.durationDays),
      credits: String(t.credits),
      maxPages: String(t.maxPages),
      maxManagedPosts: String(t.maxManagedPosts),
      maxReferenceImages: String(t.maxReferenceImages),
      isPublic: t.isPublic,
      note: t.note ?? "",
    });
    setTemplateDialog(true);
  }

  function openAssign(t: CustomPlanTemplate) {
    setAssignTemplate(t);
    setAssignUser(null);
    setAssignDialog(true);
  }

  async function handleSaveTemplate() {
    setBusy(true);
    try {
      const payload = {
        name: String(formValues.name),
        description: String(formValues.description) || undefined,
        priceAriary: parseInt(String(formValues.priceAriary)),
        durationDays: parseInt(String(formValues.durationDays)) || 30,
        credits: parseInt(String(formValues.credits)),
        maxPages: parseInt(String(formValues.maxPages)),
        maxManagedPosts: parseInt(String(formValues.maxManagedPosts)),
        maxReferenceImages: parseInt(String(formValues.maxReferenceImages)),
        isPublic: Boolean(formValues.isPublic),
        note: String(formValues.note) || undefined,
      };
      if (editingTemplate) {
        await adminCustomPlansApi.update(editingTemplate.id, payload);
      } else {
        await adminCustomPlansApi.create(payload);
      }
      setTemplateDialog(false);
      load();
    } finally {
      setBusy(false);
    }
  }

  async function handleToggle(t: CustomPlanTemplate) {
    setBusy(true);
    try {
      await adminCustomPlansApi.toggle(t.id);
      load();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(t: CustomPlanTemplate) {
    setBusy(true);
    try {
      await adminCustomPlansApi.remove(t.id);
      load();
    } finally {
      setBusy(false);
    }
  }

  async function handleAssign() {
    if (!assignTemplate || !assignUser) return;
    setBusy(true);
    try {
      await adminUsersApi.createCustomSubscription(assignUser.id, {
        credits: assignTemplate.credits,
        durationDays: assignTemplate.durationDays,
        priceAriary: assignTemplate.priceAriary,
        maxPages: assignTemplate.maxPages,
        maxManagedPosts: assignTemplate.maxManagedPosts,
        maxReferenceImages: assignTemplate.maxReferenceImages,
        note: `Attribution manuelle — template: ${assignTemplate.name}`,
      });
      setAssignDialog(false);
      setAssignUser(null);
    } finally {
      setBusy(false);
    }
  }

  const isFormValid = Boolean(
    formValues.name &&
    formValues.priceAriary &&
    formValues.credits &&
    formValues.maxPages &&
    formValues.maxManagedPosts &&
    formValues.maxReferenceImages,
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
            Créez des offres sur-mesure visibles sur la page abonnements
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs text-muted-foreground"
            onClick={() => setShowInactive((p) => !p)}
          >
            {showInactive ? (
              <EyeOff className="h-3 w-3" />
            ) : (
              <Eye className="h-3 w-3" />
            )}
            {showInactive ? "Masquer inactifs" : "Voir inactifs"}
          </Button>
          <Button
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={openCreate}
          >
            <Plus className="h-3.5 w-3.5" />
            Créer un plan
          </Button>
        </div>
      </div>

      {/* Templates grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-lg bg-card/50" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/40 py-20">
          <Crown className="mb-3 h-8 w-8 text-yellow-400/30" />
          <p className="text-sm font-medium text-foreground/50">
            Aucun plan custom créé
          </p>
          <p className="mt-1 text-xs text-muted-foreground/30">
            Côté user, &quot;Custom&quot; affichera &quot;Nous contacter&quot;
            jusqu&apos;à la création du premier plan.
          </p>
          <Button
            size="sm"
            className="mt-4 h-7 text-xs gap-1.5"
            onClick={openCreate}
          >
            <Plus className="h-3.5 w-3.5" />
            Créer le premier plan
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <div key={t.id} className="space-y-2">
              <TemplateCard
                t={t}
                onEdit={openEdit}
                onToggle={handleToggle}
                onDelete={handleDelete}
                busy={busy}
              />
              <Button
                variant="outline"
                size="sm"
                className="w-full h-7 text-xs gap-1.5 border-border/40 text-muted-foreground hover:text-foreground"
                onClick={() => openAssign(t)}
                disabled={!t.isActive || busy}
              >
                <Users className="h-3 w-3" />
                Attribuer à un utilisateur
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* ── Dialog : Créer / éditer template ────────────────────────── */}
      <Dialog
        open={templateDialog}
        onOpenChange={(o) => {
          if (!busy) setTemplateDialog(o);
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[15px]">
              {editingTemplate
                ? `Modifier "${editingTemplate.name}"`
                : "Créer un plan custom"}
            </DialogTitle>
            <DialogDescription className="text-[12px]">
              Ce plan sera proposé aux utilisateurs sur la page abonnements (si
              public).
            </DialogDescription>
          </DialogHeader>

          <TemplateFormFields
            values={formValues}
            onChange={(k, v) => setFormValues((prev) => ({ ...prev, [k]: v }))}
          />

          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTemplateDialog(false)}
              disabled={busy}
            >
              Annuler
            </Button>
            <Button
              size="sm"
              onClick={handleSaveTemplate}
              disabled={busy || !isFormValid}
            >
              {busy ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : null}
              {editingTemplate ? "Enregistrer" : "Créer le plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog : Attribution (style horizontal PackCard) ─────────── */}
      <Dialog
        open={assignDialog}
        onOpenChange={(o) => {
          if (!busy) {
            setAssignDialog(o);
            setAssignUser(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-[15px]">Attribuer un plan</DialogTitle>
            <DialogDescription className="text-[12px]">
              Attribution manuelle — l&apos;abonnement sera activé immédiatement
              sans paiement.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-4">
            {/* Colonne gauche : récap du plan (style PackCard horizontal) */}
            {assignTemplate && (
              <div className="w-56 shrink-0 rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Crown className="h-4 w-4 text-yellow-400" />
                  <p className="text-[13px] font-semibold">
                    {assignTemplate.name}
                  </p>
                </div>
                <p className="font-mono text-[22px] font-bold text-primary mb-3">
                  {assignTemplate.priceAriary === 0
                    ? "Gratuit"
                    : `${assignTemplate.priceAriary.toLocaleString("fr-FR")} Ar`}
                </p>
                <div className="space-y-1.5">
                  {[
                    {
                      label: "Crédits",
                      val: assignTemplate.credits.toLocaleString("fr-FR"),
                    },
                    { label: "Durée", val: `${assignTemplate.durationDays}j` },
                    { label: "Pages", val: assignTemplate.maxPages },
                    { label: "Posts", val: assignTemplate.maxManagedPosts },
                    { label: "Images", val: assignTemplate.maxReferenceImages },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex justify-between text-[11px]"
                    >
                      <span className="text-muted-foreground/50">
                        {item.label}
                      </span>
                      <span className="font-mono font-semibold text-foreground">
                        {item.val}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 rounded-md bg-orange-500/10 border border-orange-500/20 px-2.5 py-2">
                  <p className="text-[10px] text-orange-400 leading-snug">
                    Attribution gratuite — aucun paiement Papi déclenché.
                  </p>
                </div>
              </div>
            )}

            {/* Colonne droite : sélection user */}
            <div className="flex-1 min-w-0">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-widest text-muted-foreground/50">
                Sélectionner l&apos;utilisateur
              </p>
              <UserSelector selected={assignUser} onSelect={setAssignUser} />
              {assignUser && (
                <div className="mt-2 flex items-center gap-2 rounded-md bg-primary/10 border border-primary/20 px-3 py-2">
                  <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-[12px] font-medium text-primary">
                    {assignUser.email}
                  </span>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setAssignDialog(false);
                setAssignUser(null);
              }}
              disabled={busy}
            >
              Annuler
            </Button>
            <Button
              size="sm"
              onClick={handleAssign}
              disabled={busy || !assignUser}
            >
              {busy ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Users className="mr-1.5 h-3.5 w-3.5" />
              )}
              Attribuer à {assignUser?.username ?? "…"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
