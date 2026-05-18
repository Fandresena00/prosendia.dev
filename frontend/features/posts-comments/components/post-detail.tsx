"use client";
/**
 * @file features/posts-comments/components/post-detail.tsx
 * Config panel shown when a post is selected.
 */

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  IconExternalLink,
  IconMessage,
  IconMessageForward,
  IconPhotoFilled,
  IconPlus,
  IconRobot,
  IconX,
} from "@tabler/icons-react";
import { useState } from "react";
import { PHOTO_GRADIENTS, QUICK_TEMPLATES } from "../data/posts-comments.data";
import type { Post } from "../types/posts-comments.types";
import { PhotoCarousel } from "./photo-carousel";

interface PostDetailProps {
  post:     Post;
  onUpdate: (p: Post) => void;
}

export function PostDetail({ post, onUpdate }: PostDetailProps) {
  const [newTpl, setNewTpl] = useState("");

  const set = <K extends keyof Post>(k: K, v: Post[K]) =>
    onUpdate({ ...post, [k]: v });

  const addTemplate = (text: string) => {
    if (!text.trim()) return;
    set("templates", [...post.templates, text.trim()]);
  };

  return (
    <div className="flex flex-col h-full">

      {/* ── Post header ── */}
      <div className="shrink-0 px-6 pt-5 pb-4 border-b border-border/40">
        <div className="flex items-start gap-3">
          <div
            className="h-9 w-9 rounded-lg shrink-0 flex items-center justify-center"
            style={{ background: post.photos.length ? PHOTO_GRADIENTS[0] : "oklch(0.94 0.01 286 / 60%)" }}
          >
            {post.photos.length
              ? <IconPhotoFilled className="h-4 w-4 opacity-40" />
              : <IconMessage className="h-4 w-4 text-muted-foreground/40" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{post.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{post.date}</p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <a href={post.facebookUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="icon" className="h-7 w-7 text-[#1877F2] hover:bg-[#1877F2]/8">
                  <IconExternalLink className="h-3.5 w-3.5" />
                </Button>
              </a>
            </TooltipTrigger>
            <TooltipContent className="text-xs">Voir sur Facebook</TooltipContent>
          </Tooltip>
        </div>

        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{post.body}</p>

        {post.photos.length > 0 && (
          <div className="mt-3">
            <PhotoCarousel photos={post.photos} />
          </div>
        )}
      </div>

      {/* ── Scrollable config ── */}
      <ScrollArea className="flex-1">
        <div className="px-6 py-5 space-y-6">

          {/* Automation toggles */}
          <div className="space-y-2.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Automatisation
            </p>

            <div className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-colors ${
              post.autoReply
                ? "border-emerald-500/25 bg-emerald-500/5"
                : "border-border/40 bg-secondary/20"
            }`}>
              <div className="flex items-center gap-2.5">
                <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${
                  post.autoReply ? "bg-emerald-500/15" : "bg-secondary"
                }`}>
                  <IconRobot className={`h-3.5 w-3.5 ${post.autoReply ? "text-emerald-600" : "text-muted-foreground"}`} />
                </div>
                <div>
                  <p className="text-xs font-semibold">Réponses auto aux commentaires</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">L'IA répond automatiquement</p>
                </div>
              </div>
              <Switch
                checked={post.autoReply}
                onCheckedChange={(v) => set("autoReply", v)}
              />
            </div>

            <div className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-colors ${
              post.dmEnabled
                ? "border-primary/25 bg-primary/5"
                : "border-border/40 bg-secondary/20"
            }`}>
              <div className="flex items-center gap-2.5">
                <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${
                  post.dmEnabled ? "bg-primary/10" : "bg-secondary"
                }`}>
                  <IconMessageForward className={`h-3.5 w-3.5 ${post.dmEnabled ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <div>
                  <p className="text-xs font-semibold">DM automatique</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Envoyer un DM à chaque commentaire</p>
                </div>
              </div>
              <Switch
                checked={post.dmEnabled}
                onCheckedChange={(v) => set("dmEnabled", v)}
              />
            </div>

            {post.dmEnabled && (
              <div className="space-y-1.5 pl-1">
                <Label className="text-[11px] text-muted-foreground">Message DM automatique</Label>
                <Textarea
                  value={post.dmMessage}
                  onChange={(e) => set("dmMessage", e.target.value)}
                  rows={2}
                  className="text-xs resize-none bg-secondary/20"
                  placeholder="Bonjour ! Suite à votre commentaire…"
                />
              </div>
            )}
          </div>

          <Separator className="bg-border/40" />

          {/* AI description */}
          <div className="space-y-2">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Description pour l'IA
            </Label>
            <Textarea
              value={post.aiDescription}
              onChange={(e) => set("aiDescription", e.target.value)}
              rows={3}
              className="text-xs resize-none bg-secondary/20"
              placeholder="Décrivez ce post pour guider les réponses de l'IA…"
            />
            <p className="text-[10px] text-muted-foreground">
              L'IA utilise cette description pour contextualiser ses réponses.
            </p>
          </div>

          <Separator className="bg-border/40" />

          {/* Templates */}
          <div className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Templates de réponse
            </p>

            {/* Quick add pills */}
            <div className="flex flex-wrap gap-1.5">
              {QUICK_TEMPLATES.filter((t) => !post.templates.includes(t)).slice(0, 3).map((t) => (
                <button
                  key={t}
                  onClick={() => addTemplate(t)}
                  className="flex items-center gap-1 rounded-full border border-dashed border-border/60 bg-secondary/20 px-2.5 py-1 text-[10px] text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
                >
                  <IconPlus className="h-2.5 w-2.5" />
                  {t.slice(0, 28)}…
                </button>
              ))}
            </div>

            {/* Existing templates */}
            {post.templates.length > 0 && (
              <div className="space-y-1.5">
                {post.templates.map((t, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg border border-border/40 bg-secondary/20 px-3 py-2">
                    <p className="flex-1 text-xs leading-relaxed">{t}</p>
                    <button
                      onClick={() => set("templates", post.templates.filter((_, j) => j !== i))}
                      className="shrink-0 text-muted-foreground/40 hover:text-destructive transition-colors mt-0.5"
                    >
                      <IconX className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Custom input */}
            <div className="flex gap-2">
              <Input
                value={newTpl}
                onChange={(e) => setNewTpl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newTpl.trim()) {
                    addTemplate(newTpl);
                    setNewTpl("");
                  }
                }}
                placeholder="Ajouter un template… (Entrée pour valider)"
                className="h-8 text-xs bg-secondary/20 flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3"
                disabled={!newTpl.trim()}
                onClick={() => { addTemplate(newTpl); setNewTpl(""); }}
              >
                <IconPlus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <Separator className="bg-border/40" />

          {/* Instructions */}
          <div className="space-y-2">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Instructions spécifiques
            </Label>
            <Textarea
              value={post.templateInstructions}
              onChange={(e) => set("templateInstructions", e.target.value)}
              rows={2}
              className="text-xs resize-none bg-secondary/20"
              placeholder="Ex : Ton amical. Proposer le DM pour les commandes."
            />
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
