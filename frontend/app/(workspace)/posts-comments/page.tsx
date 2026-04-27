"use client";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  IconBrandFacebook,
  IconCheck,
  IconExternalLink,
  IconInfoCircle,
  IconMessage,
  IconMessageForward,
  IconPlus,
  IconSettings,
} from "@tabler/icons-react";
import {
  ChevronLeft,
  ChevronRight,
  Globe,
  ImageIcon,
  MessageSquare,
  Search,
  ThumbsUp,
  X,
  Zap,
} from "lucide-react";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";

/* ── Types ── */
type Post = {
  id: number;
  accountPageKey: string;
  name: string;
  body: string;
  postId: string;
  photos: string[];
  autoReply: boolean;
  comments: number;
  dmEnabled: boolean;
  date: string;
  dmMessage: string;
  aiDescription: string;
  templates: string[];
  templateInstructions: string;
  likes: number;
  authorName: string;
  authorAvatar: string;
  authorType: string;
  facebookUrl: string;
  aiReplied: number;
  totalComments: number;
};

const ACCOUNT_PAGES = [
  {
    key: "1_1",
    accountId: 1,
    pageId: 1,
    accountName: "Jean Dupont",
    pageName: "Ma Boutique Mode",
    type: "Page",
    avatar: "MB",
    color: "bg-primary/15 text-primary",
  },
  {
    key: "1_2",
    accountId: 1,
    pageId: 2,
    accountName: "Jean Dupont",
    pageName: "Ventes Privées",
    type: "Page",
    avatar: "VP",
    color: "bg-violet-500/15 text-violet-500",
  },
  {
    key: "2_3",
    accountId: 2,
    pageId: 3,
    accountName: "Boutique Pro",
    pageName: "Promotions Spéciales",
    type: "Compte perso",
    avatar: "PS",
    color: "bg-emerald-500/15 text-emerald-600",
  },
];

/* Placeholder photos — CSS gradient tiles */
const PHOTO_GRADIENTS = [
  "linear-gradient(135deg, oklch(0.52 0.24 256 / 30%) 0%, oklch(0.45 0.22 280 / 25%) 100%)",
  "linear-gradient(135deg, oklch(0.55 0.18 155 / 30%) 0%, oklch(0.48 0.20 170 / 25%) 100%)",
  "linear-gradient(135deg, oklch(0.62 0.20 50 / 30%) 0%, oklch(0.55 0.22 30 / 25%) 100%)",
  "linear-gradient(135deg, oklch(0.58 0.20 310 / 30%) 0%, oklch(0.50 0.22 290 / 25%) 100%)",
];

const MOCK_FB_POSTS = [
  {
    id: "fb_001",
    title: "Promotion été — Réduction 20%",
    body: "Profitez de -20% ! Livraison gratuite dès 50 000 Ar.",
    photos: ["p1", "p2"],
    date: "Il y a 2h",
    likes: 47,
    comments: 12,
    url: "https://facebook.com/post/001",
  },
  {
    id: "fb_002",
    title: "Nouveau produit : T-shirt Premium",
    body: "Notre T-shirt Premium est arrivé ! Coton bio.",
    photos: [],
    date: "Il y a 5h",
    likes: 23,
    comments: 8,
    url: "https://facebook.com/post/002",
  },
  {
    id: "fb_003",
    title: "Livraison gratuite dès 50 000 Ar",
    body: "Livraison offerte dès 50 000 Ar à Antananarivo !",
    photos: ["p3"],
    date: "Il y a 1j",
    likes: 31,
    comments: 5,
    url: "https://facebook.com/post/003",
  },
];

const INITIAL_POSTS: Post[] = [
  {
    id: 1,
    accountPageKey: "1_1",
    name: "Promotion été — Réduction 20%",
    body: "Profitez de -20% sur tous nos articles ! Livraison offerte.",
    postId: "fb_001",
    photos: ["p1", "p2"],
    autoReply: true,
    comments: 12,
    dmEnabled: true,
    date: "Il y a 2h",
    dmMessage: "Bonjour ! Suite à votre commentaire :",
    aiDescription:
      "Post promotion été -20%. Mettre en avant la livraison gratuite.",
    templates: ["Merci ! Je vous envoie les détails en DM 😊"],
    templateInstructions:
      "Ton amical. Toujours proposer le DM pour les commandes.",
    likes: 47,
    authorName: "Ma Boutique Mode",
    authorAvatar: "MB",
    authorType: "Page",
    facebookUrl: "https://facebook.com/post/001",
    aiReplied: 10,
    totalComments: 12,
  },
  {
    id: 2,
    accountPageKey: "1_1",
    name: "Nouveau produit : T-shirt Premium",
    body: "Notre T-shirt Premium est arrivé !",
    postId: "fb_002",
    photos: [],
    autoReply: false,
    comments: 8,
    dmEnabled: false,
    date: "Il y a 5h",
    dmMessage: "",
    aiDescription: "",
    templates: [],
    templateInstructions: "",
    likes: 23,
    authorName: "Ma Boutique Mode",
    authorAvatar: "MB",
    authorType: "Page",
    facebookUrl: "https://facebook.com/post/002",
    aiReplied: 0,
    totalComments: 8,
  },
  {
    id: 3,
    accountPageKey: "1_2",
    name: "Vente flash 48h",
    body: "48h seulement ! -30% sur les jeans.",
    postId: "fb_003",
    photos: ["p3"],
    autoReply: true,
    comments: 19,
    dmEnabled: true,
    date: "Il y a 3h",
    dmMessage: "Détails de la vente flash :",
    aiDescription: "Vente flash jeans -30%. Insister sur l'urgence.",
    templates: ["Oui dispo ! En DM pour commander 🛍️"],
    templateInstructions: "Répondre rapidement.",
    likes: 62,
    authorName: "Ventes Privées",
    authorAvatar: "VP",
    authorType: "Page",
    facebookUrl: "https://facebook.com/post/003",
    aiReplied: 16,
    totalComments: 19,
  },
];

const TPLS = [
  "Merci ! Je vous envoie les détails en DM 😊",
  "Oui, disponible ! Envoyez-nous un message.",
  "Livraison 24-48h. 📦",
  "-10% avec le code PROMO10 ! 🎁",
];

const barConfig = {
  aiReplied: { label: "Réponses IA", color: "var(--color-chart-1)" },
  manual: { label: "Non répondu", color: "var(--color-chart-3)" },
};

function SepLine({ className = "" }: { className?: string }) {
  return <div className={`h-px bg-border/40 ${className}`} />;
}

/* ── Photo carousel — gradient tiles (no external images) ── */
function PhotoCarousel({ photos }: { photos: string[] }) {
  const [idx, setIdx] = useState(0);
  if (!photos.length) return null;
  const grad = PHOTO_GRADIENTS[idx % PHOTO_GRADIENTS.length];
  return (
    <div
      className="relative rounded-md overflow-hidden"
      style={{ aspectRatio: "16/9", background: grad }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-1 opacity-40">
          <ImageIcon className="h-8 w-8" />
          <span className="text-xs font-medium">Photo {idx + 1}</span>
        </div>
      </div>
      {photos.length > 1 && (
        <>
          <button
            onClick={() =>
              setIdx((i) => (i - 1 + photos.length) % photos.length)
            }
            className="absolute left-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-background/80 flex items-center justify-center hover:bg-background transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setIdx((i) => (i + 1) % photos.length)}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-background/80 flex items-center justify-center hover:bg-background transition-colors"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1">
            {photos.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={`h-1.5 rounded-full transition-all ${i === idx ? "w-4 bg-white" : "w-1.5 bg-white/60"}`}
              />
            ))}
          </div>
          <Badge
            variant="secondary"
            className="absolute top-2 right-2 text-xs bg-background/80"
          >
            {idx + 1}/{photos.length}
          </Badge>
        </>
      )}
    </div>
  );
}

/* ── Add Post Dialog ── */
function AddPostDialog({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (
    p: Omit<
      Post,
      | "id"
      | "autoReply"
      | "comments"
      | "dmEnabled"
      | "dmMessage"
      | "templates"
      | "templateInstructions"
      | "aiReplied"
      | "totalComments"
    >,
  ) => void;
}) {
  const [accountPage, setAccountPage] = useState("");
  const [selected, setSelected] = useState<(typeof MOCK_FB_POSTS)[0] | null>(
    null,
  );
  const [step, setStep] = useState<"select" | "configure">("select");
  const [search, setSearch] = useState("");
  const [aiDesc, setAiDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const ap = ACCOUNT_PAGES.find((a) => a.key === accountPage);
  const filteredPosts = MOCK_FB_POSTS.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase()),
  );
  const handleClose = () => {
    onClose();
    setStep("select");
    setSelected(null);
    setSearch("");
    setAccountPage("");
    setAiDesc("");
  };

  return (
    <>
      <AlertDialog open={open} onOpenChange={handleClose}>
        <AlertDialogContent
          className="max-w-lg"
          style={{
            maxHeight: "90vh",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <AlertDialogHeader className="shrink-0">
            <AlertDialogTitle className="flex items-center gap-2 text-base">
              <IconBrandFacebook className="h-5 w-5 text-[#1877F2]" />
              {step === "select"
                ? "Sélectionner un post"
                : "Configurer le post"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {step === "select"
                ? "Choisissez le compte, la page et le post à gérer."
                : "Ajoutez une description et reliez un produit."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {step === "select" ? (
            <div className="flex flex-col gap-4 overflow-hidden flex-1 min-h-0">
              <div className="shrink-0 space-y-2">
                <Label className="text-sm font-medium">Compte et page *</Label>
                <div className="grid gap-2">
                  {ACCOUNT_PAGES.map((a) => (
                    <button
                      key={a.key}
                      onClick={() => {
                        setAccountPage(a.key);
                        setSelected(null);
                      }}
                      className={`flex items-center gap-3 rounded-md border p-2.5 transition-all text-left ${accountPage === a.key ? "border-primary/40 bg-primary/5" : "border-border/50 hover:border-border"}`}
                    >
                      <div
                        className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${a.color}`}
                      >
                        {a.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold">{a.pageName}</p>
                          <Badge
                            variant="outline"
                            className="text-[10px] h-4 px-1 font-normal"
                          >
                            {a.type}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {a.accountName}
                        </p>
                      </div>
                      {accountPage === a.key && (
                        <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                          <IconCheck className="h-3 w-3 text-primary-foreground" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              {accountPage && (
                <>
                  <div className="relative shrink-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Rechercher…"
                      className="pl-9 h-9 text-sm"
                    />
                  </div>
                  <div className="overflow-y-auto flex-1 min-h-0 space-y-2">
                    {filteredPosts.map((post) => (
                      <button
                        key={post.id}
                        onClick={() => setSelected(post)}
                        className={`w-full text-left rounded-md border transition-all ${selected?.id === post.id ? "border-primary/50 bg-primary/5" : "border-border/60 hover:border-border bg-card"}`}
                      >
                        <div className="flex items-center gap-2.5 p-3 pb-2">
                          <div
                            className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${ap?.color ?? ""}`}
                          >
                            {ap?.avatar}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold">
                              {ap?.pageName}
                            </p>
                            <div className="flex items-center gap-1">
                              <Globe className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">
                                {post.date}
                              </span>
                            </div>
                          </div>
                          {selected?.id === post.id && (
                            <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                              <IconCheck className="h-3 w-3 text-primary-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="px-3 pb-2">
                          <p className="text-sm font-medium">{post.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {post.body}
                          </p>
                        </div>
                        {post.photos.length > 0 && (
                          <div className="px-3 pb-2">
                            <div
                              className={`grid gap-1 rounded-md overflow-hidden ${post.photos.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}
                            >
                              {post.photos
                                .slice(0, post.photos.length === 3 ? 3 : 4)
                                .map((_, i) => {
                                  const grad =
                                    PHOTO_GRADIENTS[i % PHOTO_GRADIENTS.length];
                                  const isLast =
                                    i === 3 && post.photos.length > 4;
                                  return (
                                    <div
                                      key={i}
                                      className="relative overflow-hidden rounded-sm"
                                      style={{
                                        height:
                                          post.photos.length === 1 ? 100 : 70,
                                        background: grad,
                                      }}
                                    >
                                      <div className="absolute inset-0 flex items-center justify-center opacity-30">
                                        <ImageIcon className="h-5 w-5" />
                                      </div>
                                      {isLast && (
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                          <span className="text-white text-sm font-bold">
                                            +{post.photos.length - 4}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              {post.photos.length === 3 && (
                                <div className="col-span-2 grid grid-cols-2 gap-1">
                                  {/* handled above */}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-4 px-3 py-2 border-t border-border/30 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <ThumbsUp className="h-3 w-3" />
                            {post.likes}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            {post.comments}
                          </span>
                          {post.photos.length > 0 && (
                            <span className="flex items-center gap-1">
                              <ImageIcon className="h-3 w-3" />
                              {post.photos.length} photo
                              {post.photos.length > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
              <div className="flex gap-3 shrink-0 pt-1">
                <AlertDialogCancel className="flex-1 h-9 text-sm">
                  Annuler
                </AlertDialogCancel>
                <Button
                  className="flex-1 h-9 text-sm"
                  disabled={!selected || !accountPage}
                  onClick={() => setStep("configure")}
                >
                  Continuer
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-y-auto flex-1 min-h-0 space-y-4 pr-0.5">
              {selected && (
                <div className="rounded-md border border-primary/25 bg-primary/5 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${ap?.color}`}
                    >
                      {ap?.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{ap?.pageName}</p>
                      <p className="text-xs text-muted-foreground">
                        {selected.date}
                      </p>
                    </div>
                    <button
                      onClick={() => setStep("select")}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="text-sm font-medium">{selected.title}</p>
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Description pour l&apos;IA
                </Label>
                <Textarea
                  value={aiDesc}
                  onChange={(e) => setAiDesc(e.target.value)}
                  rows={3}
                  className="text-sm resize-none"
                  placeholder="Décrivez ce post pour guider les réponses…"
                />
              </div>
              <div className="space-y-2"></div>
              <div className="flex gap-3 pb-2">
                <Button
                  variant="outline"
                  className="flex-1 h-9 text-sm"
                  onClick={() => setStep("select")}
                >
                  Retour
                </Button>
                <Button
                  className="flex-1 h-9 text-sm"
                  disabled={saving}
                  onClick={() => {
                    setSaving(true);
                    setTimeout(() => {
                      onAdd({
                        accountPageKey: ap!.key,
                        name: selected!.title,
                        body: selected!.body,
                        postId: selected!.id,
                        photos: selected!.photos,
                        date: selected!.date,
                        aiDescription: aiDesc,
                        likes: selected!.likes,
                        authorName: ap!.pageName,
                        authorAvatar: ap!.avatar,
                        authorType: ap!.type,
                        facebookUrl: selected!.url,
                      });
                      setSaving(false);
                      handleClose();
                    }, 700);
                  }}
                >
                  {saving ? (
                    <>
                      <div className="h-4 w-4 rounded-full border-2 border-transparent border-t-current animate-spin" />
                      Ajout…
                    </>
                  ) : (
                    "Ajouter"
                  )}
                </Button>
              </div>
            </div>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ── Configure Dialog ── */
function ConfigureDialog({
  open,
  onClose,
  post,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  post: Post | null;
  onSave: (p: Post) => void;
}) {
  const [form, setForm] = useState<Post | null>(post);
  const [saving, setSaving] = useState(false);
  const [newTpl, setNewTpl] = useState("");

  // Sync form when post changes (fix for dialog not showing content)
  if (!form && post) {
    setForm(post);
    return null;
  }
  if (!form) return null;

  const ap = ACCOUNT_PAGES.find((a) => a.key === form.accountPageKey);

  return (
    <>
      <AlertDialog open={open} onOpenChange={onClose}>
        <AlertDialogContent
          className="max-w-lg"
          style={{
            maxHeight: "90vh",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <AlertDialogHeader className="shrink-0">
            <AlertDialogTitle className="truncate text-base">
              Configurer — {post?.name}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Paramètres IA, templates et règles de réponse pour ce post.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="overflow-y-auto flex-1 min-h-0 space-y-4 pr-0.5 py-1">
            <div className="rounded-md border border-border/50 bg-secondary/20 p-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${ap?.color}`}
                >
                  {ap?.avatar}
                </div>
                <div>
                  <p className="text-sm font-semibold">{ap?.pageName}</p>
                  <div className="flex items-center gap-1.5">
                    <Globe className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {form.date}
                    </span>
                    <Badge variant="outline" className="text-[10px] h-4 px-1">
                      {ap?.type}
                    </Badge>
                  </div>
                </div>
              </div>
              <p className="text-sm font-medium mt-1 truncate">{form.name}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Description pour l&apos;IA
              </Label>
              <Textarea
                value={form.aiDescription}
                onChange={(e) =>
                  setForm((p) =>
                    p ? { ...p, aiDescription: e.target.value } : p,
                  )
                }
                rows={2}
                className="text-sm resize-none"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Message DM</Label>
              <Textarea
                value={form.dmMessage}
                onChange={(e) =>
                  setForm((p) => (p ? { ...p, dmMessage: e.target.value } : p))
                }
                rows={2}
                className="text-sm resize-none"
                placeholder="Message DM après commentaire…"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  Templates
                </Label>
                <span className="text-xs text-muted-foreground">
                  {form.templates.length}/4 (exemples)
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {TPLS.filter((s) => !form.templates.includes(s))
                  .slice(0, 3)
                  .map((s) => (
                    <button
                      key={s}
                      onClick={() =>
                        setForm((p) =>
                          p ? { ...p, templates: [...p.templates, s] } : p,
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-md border border-border/50 bg-secondary px-2 py-1 text-xs hover:border-primary/50 transition-colors"
                    >
                      <Zap className="h-3 w-3 text-primary shrink-0" />
                      {s.slice(0, 25)}…
                    </button>
                  ))}
              </div>
              {form.templates.map((t, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 rounded-md border border-border/40 bg-secondary/40 px-3 py-2"
                >
                  <p className="text-xs flex-1">{t}</p>
                  <button
                    onClick={() =>
                      setForm((p) =>
                        p
                          ? {
                              ...p,
                              templates: p.templates.filter((_, j) => j !== i),
                            }
                          : p,
                      )
                    }
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {form.templates.length < 4 && (
                <div className="flex gap-2">
                  <Input
                    value={newTpl}
                    onChange={(e) => setNewTpl(e.target.value)}
                    placeholder="Ajouter un template… (max 4)"
                    className="h-9 text-sm flex-1"
                  />
                  <Button
                    size="sm"
                    className="h-9 px-3 shrink-0"
                    disabled={!newTpl.trim()}
                    onClick={() => {
                      if (newTpl.trim() && form.templates.length < 4) {
                        setForm((p) =>
                          p
                            ? {
                                ...p,
                                templates: [...p.templates, newTpl.trim()],
                              }
                            : p,
                        );
                        setNewTpl("");
                      }
                    }}
                  >
                    <IconPlus className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Instructions</Label>
              <Textarea
                value={form.templateInstructions}
                onChange={(e) =>
                  setForm((p) =>
                    p ? { ...p, templateInstructions: e.target.value } : p,
                  )
                }
                rows={2}
                className="text-sm resize-none"
              />
            </div>
            <div className="space-y-3 border-t border-border/40 pt-3">
              {[
                {
                  key: "autoReply" as const,
                  label: "Répondre automatiquement aux commentaires",
                },
                {
                  key: "dmEnabled" as const,
                  label: "Envoyer un DM automatique",
                },
              ].map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between"
                >
                  <Label className="text-sm font-normal cursor-pointer">
                    {item.label}
                  </Label>
                  <Switch
                    checked={form[item.key] as boolean}
                    onCheckedChange={(v) =>
                      setForm((p) => (p ? { ...p, [item.key]: v } : p))
                    }
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-3 border-t border-border/40 shrink-0">
            <AlertDialogCancel className="flex-1 h-9 text-sm">
              Annuler
            </AlertDialogCancel>
            <Button
              className="flex-1 h-9 text-sm"
              disabled={saving}
              onClick={() => {
                setSaving(true);
                setTimeout(() => {
                  onSave(form);
                  setSaving(false);
                  onClose();
                }, 600);
              }}
            >
              {saving ? (
                <>
                  <div className="h-4 w-4 rounded-full border-2 border-transparent border-t-current animate-spin" />
                  Enregistrement…
                </>
              ) : (
                "Sauvegarder"
              )}
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ── Post Card ── */
function PostCard({
  post,
  onConfigure,
  onToggle,
  onInfo,
}: {
  post: Post;
  onConfigure: () => void;
  onToggle: (v: boolean) => void;
  onInfo: () => void;
}) {
  const ap = ACCOUNT_PAGES.find((a) => a.key === post.accountPageKey);
  return (
    <Card
      className={`border-border/50 transition-opacity ${post.autoReply ? "border-primary/25" : "opacity-60"}`}
    >
      <CardContent className="p-0">
        <div className="flex items-center gap-2.5 p-3 pb-2">
          <div
            className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${ap?.color}`}
          >
            {post.authorAvatar}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{post.authorName}</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Globe className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground">{post.date}</span>
              <Badge
                variant="outline"
                className="text-[10px] h-4 px-1 font-normal"
              >
                {post.authorType}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Switch checked={post.autoReply} onCheckedChange={onToggle} />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-primary"
              title="Infos IA"
              onClick={onInfo}
            >
              <IconInfoCircle className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 gap-1 text-xs"
              onClick={onConfigure}
            >
              <IconSettings className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Config.</span>
            </Button>
            <a
              href={post.facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-[#1877F2] hover:bg-[#1877F2]/10"
              >
                <IconExternalLink className="h-3.5 w-3.5" />
              </Button>
            </a>
          </div>
        </div>
        <div className="px-3 pb-2">
          <p className="text-sm font-medium">{post.name}</p>
          {post.body && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {post.body}
            </p>
          )}
        </div>
        {post.photos.length > 0 && (
          <div className="px-3 pb-2">
            <PhotoCarousel photos={post.photos} />
          </div>
        )}
        <div className="flex items-center gap-2.5 px-3 py-2 border-t border-border/30 flex-wrap">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <ThumbsUp className="h-3 w-3 text-primary" />
            {post.likes}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <IconMessage className="h-3.5 w-3.5" />
            {post.totalComments}
          </span>
          {post.autoReply && (
            <Badge variant="secondary" className="text-xs h-5 gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {post.aiReplied}/{post.totalComments} IA
            </Badge>
          )}
          {post.dmEnabled && (
            <Badge variant="secondary" className="text-xs h-5 gap-1">
              <IconMessageForward className="h-3 w-3 text-primary" />
              DM
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Main Page ── */
export default function PostsCommentsPage() {
  const [posts, setPosts] = useState(INITIAL_POSTS);
  const [addDialog, setAddDialog] = useState(false);
  const [configPost, setConfigPost] = useState<Post | null>(null);
  const [infoPost, setInfoPost] = useState<Post | null>(null);
  const [filter, setFilter] = useState<string>(ACCOUNT_PAGES[0].key);

  const filtered = posts.filter((p) => p.accountPageKey === filter);
  const ap = ACCOUNT_PAGES.find((a) => a.key === filter);

  const avgAiRate =
    filtered.length > 0
      ? Math.round(
          filtered.reduce(
            (a, p) =>
              a +
              (p.totalComments > 0 ? (p.aiReplied / p.totalComments) * 100 : 0),
            0,
          ) / filtered.length,
        )
      : 0;
  const avgLikes =
    filtered.length > 0
      ? Math.round(filtered.reduce((a, p) => a + p.likes, 0) / filtered.length)
      : 0;
  const avgComments =
    filtered.length > 0
      ? Math.round(
          filtered.reduce((a, p) => a + p.totalComments, 0) / filtered.length,
        )
      : 0;
  const barData = filtered.map((p) => ({
    name: p.name.slice(0, 12) + (p.name.length > 12 ? "…" : ""),
    aiReplied: p.aiReplied,
    manual: p.totalComments - p.aiReplied,
  }));
  const pieData = [
    {
      name: "Réponses IA",
      value: filtered.reduce((a, p) => a + p.aiReplied, 0),
      color: "oklch(0.52 0.24 256)",
    },
    {
      name: "Non répondu",
      value: filtered.reduce(
        (a, p) => a + Math.max(0, p.totalComments - p.aiReplied),
        0,
      ),
      color: "oklch(0.35 0.05 258)",
    },
  ];
  const totalInteractions = pieData.reduce((a, d) => a + d.value, 0);

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Posts &amp; Commentaires
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Réponses automatiques à vos publications Facebook
          </p>
        </div>
        <Button
          size="sm"
          className="h-9 gap-2 shrink-0"
          onClick={() => setAddDialog(true)}
        >
          <IconPlus className="h-4 w-4" />
          <span className="hidden sm:inline">Ajouter un post</span>
        </Button>
      </div>

      {/* Account filter */}
      <div className="px-5 pb-3 shrink-0">
        <div
          className="flex gap-2 overflow-x-auto pb-1"
          style={{ scrollbarWidth: "none" }}
        >
          {ACCOUNT_PAGES.map((a) => (
            <button
              key={a.key}
              onClick={() => setFilter(a.key)}
              className={`flex items-center gap-2.5 rounded-md border px-3 py-2 transition-all shrink-0 ${filter === a.key ? "border-primary/40 bg-primary/8" : "border-border/50 hover:border-border bg-card"}`}
            >
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${a.color}`}
              >
                {a.avatar}
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold whitespace-nowrap">
                  {a.pageName}
                </p>
                <p className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {a.type} · {a.accountName}
                </p>
              </div>
              {filter === a.key && (
                <div className="h-4 w-4 rounded-full bg-primary flex items-center justify-center ml-0.5 shrink-0">
                  <IconCheck className="h-2.5 w-2.5 text-primary-foreground" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      <SepLine />

      {/* ── Split layout ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* LEFT — scrollable feed */}
        <div className="flex-1 min-w-0 overflow-y-auto p-4 md:p-5 space-y-4 border-r border-border/40">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-14 border-2 border-dashed border-border/40 rounded-md max-w-lg mx-auto">
              <div className="h-12 w-12 rounded-md bg-[#1877F2]/10 flex items-center justify-center">
                <IconBrandFacebook className="h-6 w-6 text-[#1877F2]/50" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">
                  Aucun post sur {ap?.pageName}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Ajoutez des publications pour activer les réponses.
                </p>
              </div>
              <Button
                size="sm"
                className="gap-2"
                onClick={() => setAddDialog(true)}
              >
                <IconPlus className="h-4 w-4" />
                Ajouter un post
              </Button>
            </div>
          ) : (
            <div className="space-y-4 max-w-xl mx-auto">
              {filtered.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onConfigure={() => setConfigPost(post)}
                  onInfo={() => setInfoPost(post)}
                  onToggle={(v) =>
                    setPosts((p) =>
                      p.map((x) =>
                        x.id === post.id ? { ...x, autoReply: v } : x,
                      ),
                    )
                  }
                />
              ))}
            </div>
          )}
        </div>

        {/* RIGHT — sticky stats, no scroll */}
        <div className="w-64 xl:w-72 shrink-0 hidden md:flex flex-col overflow-hidden">
          {/* Sticky inner wrapper */}
          <div
            className="sticky top-0 h-full flex flex-col p-4 gap-4 overflow-y-auto"
            style={{ maxHeight: "100%" }}
          >
            <div className="shrink-0">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Engagement
                </h2>
                <Badge variant="secondary" className="text-xs shrink-0">
                  {filtered.length} post{filtered.length !== 1 ? "s" : ""}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground/60 mt-0.5 truncate">
                {ap?.pageName}
              </p>
            </div>

            {/* Donut chart */}
            {totalInteractions > 0 && (
              <Card className="border-border/50 shrink-0">
                <CardContent className="p-3">
                  <div
                    className="relative flex items-center justify-center"
                    style={{ height: 120 }}
                  >
                    <ChartContainer
                      config={{
                        aiReplied: { color: "oklch(0.52 0.24 256)" },
                        manual: { color: "oklch(0.35 0.05 258)" },
                      }}
                      className="absolute inset-0"
                    >
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={36}
                          outerRadius={52}
                          dataKey="value"
                          strokeWidth={0}
                        >
                          {pieData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <ChartTooltip content={<ChartTooltipContent />} />
                      </PieChart>
                    </ChartContainer>
                    <div className="relative flex flex-col items-center pointer-events-none">
                      <span className="text-2xl font-bold tabular-nums text-emerald-600">
                        {avgAiRate}%
                      </span>
                      <span className="text-[10px] text-muted-foreground font-medium">
                        Taux IA
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-3 justify-center mt-1">
                    {pieData.map((d) => (
                      <div
                        key={d.name}
                        className="flex items-center gap-1 text-[10px] text-muted-foreground"
                      >
                        <span
                          className="h-2 w-2 rounded-sm shrink-0"
                          style={{ background: d.color }}
                        />
                        {d.name}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* KPI cards */}
            <div className="grid gap-2 shrink-0">
              {[
                {
                  label: "Likes moy.",
                  value: avgLikes,
                  color: "text-primary",
                  bg: "bg-primary/5 border-primary/15",
                },
                {
                  label: "Commentaires moy.",
                  value: avgComments,
                  color: "text-violet-600",
                  bg: "bg-violet-500/5 border-violet-500/15",
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className={`rounded-md border ${s.bg} px-3 py-2.5 flex items-center gap-3`}
                >
                  <p className={`text-2xl font-bold tabular-nums ${s.color}`}>
                    {s.value}
                  </p>
                  <p className="text-xs text-muted-foreground leading-snug">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>

            {/* Bar chart */}
            {barData.length > 0 && (
              <Card className="border-border/50 shrink-0">
                <CardHeader className="pb-1 pt-3 px-3">
                  <CardTitle className="text-xs font-semibold">
                    Par post
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-2 pb-3">
                  <ChartContainer config={barConfig} className="h-32 w-full">
                    <BarChart
                      data={barData}
                      layout="vertical"
                      margin={{ left: 0, right: 4 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="currentColor"
                        strokeOpacity={0.05}
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        tick={{
                          fontSize: 8,
                          fill: "currentColor",
                          opacity: 0.4,
                        }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{
                          fontSize: 8,
                          fill: "currentColor",
                          opacity: 0.5,
                        }}
                        axisLine={false}
                        tickLine={false}
                        width={48}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar
                        dataKey="aiReplied"
                        fill="var(--color-aiReplied)"
                        radius={[0, 2, 2, 0]}
                        stackId="a"
                      />
                      <Bar
                        dataKey="manual"
                        fill="var(--color-manual)"
                        radius={[0, 2, 2, 0]}
                        stackId="a"
                      />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Dialogs — key prop forces remount when configPost changes */}
      <AddPostDialog
        open={addDialog}
        onClose={() => setAddDialog(false)}
        onAdd={(data) =>
          setPosts((p) => [
            ...p,
            {
              ...data,
              id: Date.now(),
              autoReply: false,
              comments: 0,
              dmEnabled: false,
              dmMessage: "",
              templates: [],
              templateInstructions: "",
              aiReplied: 0,
              totalComments: 0,
            },
          ])
        }
      />
      <ConfigureDialog
        key={configPost?.id ?? "none"}
        open={!!configPost}
        onClose={() => setConfigPost(null)}
        post={configPost}
        onSave={(u) => {
          setPosts((p) => p.map((x) => (x.id === u.id ? u : x)));
          setConfigPost(null);
        }}
      />

      {/* AI Info Dialog */}
      <AlertDialog open={!!infoPost} onOpenChange={() => setInfoPost(null)}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-base">
              <IconInfoCircle className="h-5 w-5 text-primary" />
              Paramètres IA
            </AlertDialogTitle>
            <AlertDialogDescription className="truncate">
              {infoPost?.name}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-1">
            {infoPost &&
              (() => {
                return (
                  <>
                    {infoPost.aiDescription && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                          Description
                        </p>
                        <div className="rounded-md border border-border/40 bg-secondary/30 px-3 py-2">
                          <p className="text-sm">{infoPost.aiDescription}</p>
                        </div>
                      </div>
                    )}
                    {infoPost.templates.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                          Templates ({infoPost.templates.length})
                        </p>
                        <div className="space-y-1">
                          {infoPost.templates.map((t, i) => (
                            <div
                              key={i}
                              className="rounded-md border border-border/40 bg-secondary/30 px-3 py-1.5"
                            >
                              <p className="text-xs">{t}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2 border-t border-border/40 pt-3">
                      {[
                        { l: "Réponses auto", on: infoPost.autoReply },
                        { l: "DM auto", on: infoPost.dmEnabled },
                      ].map((x) => (
                        <div
                          key={x.l}
                          className={`flex-1 rounded-md px-3 py-2 text-center border ${x.on ? "border-emerald-500/20 bg-emerald-500/5" : "border-border/40 bg-secondary/20"}`}
                        >
                          <p
                            className={`text-xs font-semibold ${x.on ? "text-emerald-600" : "text-muted-foreground"}`}
                          >
                            {x.on ? "✓" : "—"}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {x.l}
                          </p>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              className="h-9 px-5"
              onClick={() => setInfoPost(null)}
            >
              Fermer
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
