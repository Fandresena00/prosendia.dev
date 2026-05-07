'use client';

/**
 * @file features/inbox/components/ConvList.tsx
 *
 * CHANGES:
 *   - Account switcher: replaced color initials div with Avatar component
 *     to display the Facebook page profile picture when available.
 *   - Falls back to color + initials if avatarUrl is missing (new pages, etc.).
 */

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { IconChevronDown, IconSearch } from '@tabler/icons-react';
import { Bot, MoreHorizontal } from 'lucide-react';
import type { Account, Conv } from '../types/inbox.types';

interface ConvListProps {
  accounts:       Account[];
  activeAcc:      Account | null;
  onChangeAcc:    (acc: Account) => void;
  convs:          Conv[];
  loading:        boolean;
  selected:       Conv | null;
  onSelect:       (c: Conv) => void;
  searchQuery:    string;
  onSearchChange: (q: string) => void;
  className?:     string;
}

export function ConvList({
  accounts, activeAcc, onChangeAcc,
  convs, loading, selected, onSelect,
  searchQuery, onSearchChange,
  className = '',
}: ConvListProps) {
  return (
    <div
      className={`flex flex-col border-r border-border/40 bg-card/20 shrink-0 overflow-hidden ${className}`}
    >
      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-2 shrink-0 border-b border-border/40">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold">Messages</h2>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>

        {/* Account switcher */}
        {activeAcc && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-2.5 rounded-xl border border-border/50 bg-secondary/30 px-3 py-2 hover:bg-accent/60 transition-colors">
                {/* FIX: Show Facebook page avatar when available */}
                <PageAvatar
                  name={activeAcc.name}
                  initials={activeAcc.initials}
                  avatarUrl={activeAcc.avatarUrl}
                  colorClass={activeAcc.color}
                  size="sm"
                />
                <div className="flex-1 text-left min-w-0">
                  <p className="text-xs font-semibold truncate">{activeAcc.name}</p>
                  <p className="text-[10px] text-muted-foreground">{activeAcc.pageType}</p>
                </div>
                {activeAcc.verified && (
                  <VerifiedBadge />
                )}
                <IconChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="start" className="w-[280px]">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Pages connectées
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {accounts.map((acc) => (
                <DropdownMenuItem
                  key={acc.id}
                  onClick={() => onChangeAcc(acc)}
                  className="gap-2.5 cursor-pointer"
                >
                  <PageAvatar
                    name={acc.name}
                    initials={acc.initials}
                    avatarUrl={acc.avatarUrl}
                    colorClass={acc.color}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{acc.name}</p>
                    <p className="text-[10px] text-muted-foreground">{acc.pageType}</p>
                  </div>
                  {activeAcc.id === acc.id && (
                    <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* ── Search ── */}
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

      {/* ── Conversation list ── */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-2 py-1 space-y-0.5">
          {loading ? (
            <ConvListSkeleton />
          ) : convs.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">
              Aucune conversation trouvée
            </p>
          ) : (
            convs.map((conv) => {
              const isSelected = selected?.id === conv.id;
              return (
                <button
                  key={conv.id}
                  onClick={() => onSelect(conv)}
                  className={`w-full text-left rounded-xl p-2.5 transition-all ${
                    isSelected ? 'bg-primary/8' : 'hover:bg-accent/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Client avatar */}
                    <div className="relative shrink-0">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={conv.avatarUrl ?? undefined} alt={conv.client} />
                        <AvatarFallback
                          className={`text-sm font-bold ${
                            isSelected
                              ? 'bg-primary/20 text-primary'
                              : 'bg-secondary text-foreground'
                          }`}
                        >
                          {conv.initials}
                        </AvatarFallback>
                      </Avatar>
                      {conv.online && (
                        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 border-2 border-background" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-1">
                        <p className={`text-xs truncate ${conv.unread > 0 ? 'font-bold' : 'font-medium'}`}>
                          {conv.client}
                        </p>
                        <span className={`text-[10px] shrink-0 ${
                          conv.unread > 0 ? 'text-primary font-semibold' : 'text-muted-foreground'
                        }`}>
                          {conv.time}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-1 mt-0.5">
                        <p className={`text-[11px] truncate flex-1 ${
                          conv.unread > 0
                            ? 'text-foreground font-medium'
                            : 'text-muted-foreground'
                        }`}>
                          {conv.lastMessage}
                        </p>
                        <div className="flex items-center gap-1 shrink-0 ml-1">
                          {conv.unread > 0 && (
                            <span className="h-4 min-w-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center px-1">
                              {conv.unread}
                            </span>
                          )}
                          <Badge
                            variant={conv.mode === 'ai' ? 'default' : 'outline'}
                            className={`text-[9px] h-4 px-1 gap-0.5 ${
                              conv.mode === 'human'
                                ? 'border-emerald-500/30 text-emerald-600 bg-emerald-500/5'
                                : ''
                            }`}
                          >
                            {conv.mode === 'ai' ? (
                              <><Bot className="h-2.5 w-2.5" /> IA</>
                            ) : (
                              'Humain'
                            )}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

/**
 * Facebook page avatar — shows the page profile picture when available,
 * falls back to a color-coded initials div.
 */
function PageAvatar({
  name,
  initials,
  avatarUrl,
  colorClass,
  size = 'sm',
}: {
  name:        string;
  initials:    string;
  avatarUrl?:  string;
  colorClass:  string;
  size?:       'sm' | 'md';
}) {
  const dimension = size === 'sm' ? 'h-7 w-7' : 'h-9 w-9';
  const textSize  = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <Avatar className={`${dimension} shrink-0`}>
      <AvatarImage src={avatarUrl} alt={name} />
      <AvatarFallback
        className={`${textSize} font-bold ${colorClass}`}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}

function VerifiedBadge() {
  return (
    <svg
      className="h-3.5 w-3.5 text-primary shrink-0"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ConvListSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-2.5">
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
        </div>
      ))}
    </>
  );
}
