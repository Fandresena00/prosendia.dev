"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { IconChevronDown, IconSearch } from "@tabler/icons-react";
import { MoreHorizontal } from "lucide-react";
import { ACCOUNTS } from "../data/inbox.mock";
import type { Account, Conv } from "../types/inbox.types";

interface ConvListProps {
  activeAcc: Account;
  onChangeAcc: (acc: Account) => void;
  convs: Conv[];
  selected: Conv;
  onSelect: (c: Conv) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  className?: string;
}

export function ConvList({
  activeAcc, onChangeAcc,
  convs, selected, onSelect,
  searchQuery, onSearchChange,
  className = "",
}: ConvListProps) {
  return (
    <div className={`flex flex-col border-r border-border/40 bg-card/20 shrink-0 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-4 pt-4 pb-2 shrink-0 border-b border-border/40">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold">Messages</h2>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>

        {/* Account switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-2.5 rounded-xl border border-border/50 bg-secondary/30 px-3 py-2 hover:bg-accent/60 transition-colors">
              <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${activeAcc.color}`}>
                {activeAcc.initials}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-semibold truncate">{activeAcc.name}</p>
                <p className="text-[10px] text-muted-foreground">{activeAcc.pageType}</p>
              </div>
              {activeAcc.verified && (
                <svg className="h-3.5 w-3.5 text-primary shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                </svg>
              )}
              <IconChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[280px]">
            <DropdownMenuLabel className="text-xs text-muted-foreground">Comptes connectés</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {ACCOUNTS.map((acc) => (
              <DropdownMenuItem key={acc.id} onClick={() => onChangeAcc(acc)} className="gap-2.5 cursor-pointer">
                <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${acc.color}`}>
                  {acc.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{acc.name}</p>
                  <p className="text-xs text-muted-foreground">{acc.pageType}</p>
                </div>
                {activeAcc.id === acc.id && (
                  <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Search */}
      <div className="px-3 py-2 shrink-0">
        <div className="relative">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Rechercher…"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9 text-sm bg-secondary/40 border-0 rounded-full focus-visible:ring-1 focus-visible:ring-primary/50"
          />
        </div>
      </div>

      {/* Conversation list */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-2 py-1 space-y-0.5">
          {convs.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">Aucune conversation trouvée</p>
          )}
          {convs.map((c) => {
            const isSel = selected.id === c.id;
            return (
              <button
                key={c.id}
                onClick={() => onSelect(c)}
                className={`w-full text-left rounded-xl p-2.5 transition-all ${isSel ? "bg-primary/8" : "hover:bg-accent/60"}`}
              >
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <div className={`h-11 w-11 rounded-full flex items-center justify-center text-sm font-bold ${isSel ? "bg-primary/20 text-primary" : "bg-secondary text-foreground"}`}>
                      {c.initials}
                    </div>
                    {c.online && (
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 border-2 border-background" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-1">
                      <p className={`text-sm truncate ${c.unread > 0 ? "font-bold" : "font-medium"}`}>{c.client}</p>
                      <span className={`text-[11px] shrink-0 ${c.unread > 0 ? "text-primary font-semibold" : "text-muted-foreground"}`}>{c.time}</span>
                    </div>
                    <div className="flex items-center justify-between gap-1 mt-0.5">
                      <p className={`text-xs truncate flex-1 ${c.unread > 0 ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                        {c.lastMessage}
                      </p>
                      <div className="flex items-center gap-1.5 shrink-0 ml-1">
                        {c.unread > 0 && (
                          <span className="h-5 min-w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1">
                            {c.unread}
                          </span>
                        )}
                        <Badge
                          variant={c.mode === "ai" ? "default" : "outline"}
                          className={`text-[9px] h-4 px-1 ${c.mode === "human" ? "border-emerald-500/30 text-emerald-600 bg-emerald-500/5" : ""}`}
                        >
                          {c.mode === "ai" ? "IA" : "👤"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
