/**
 * @file components/sidebar-user-menu.tsx
 * @description User avatar + dropdown in the sidebar footer.
 * Reads user data from the auth store — no props needed.
 */

"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentUser } from "@/features/auth/store/auth.store";
import {
  IconChevronDown,
  IconCreditCard,
  IconLogout,
  IconUser,
} from "@tabler/icons-react";
import Link from "next/link";

interface SidebarUserMenuProps {
  onSignOut: () => void;
}

export function SidebarUserMenu({ onSignOut }: SidebarUserMenuProps) {
  const user = useCurrentUser();

  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : "??";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full items-center gap-2.5 rounded-xl p-2.5 text-left hover:bg-accent/60 transition-colors group">
          <Avatar className="h-10 w-10 shrink-0 border border-primary/20">
            {user?.avatarUrl && (
              <AvatarImage src={user.avatarUrl} alt={user.username} />
            )}
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-none truncate">
              {user?.username ?? "—"}
            </p>
            <p className="text-xs text-muted-foreground leading-none mt-1 truncate">
              {user?.email ?? "—"}
            </p>
          </div>

          <IconChevronDown className="h-3 w-3 text-muted-foreground shrink-0 transition-transform group-data-[state=open]:rotate-180" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" side="top" className="w-52 mb-1">
        <DropdownMenuItem asChild className="gap-2 text-sm">
          <Link href="/settings">
            <IconUser className="h-4 w-4" />
            Mon profil
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild className="gap-2 text-sm">
          <Link href="/billing">
            <IconCreditCard className="h-4 w-4" />
            Facturation
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="gap-2 text-sm text-destructive focus:text-destructive cursor-pointer"
          onClick={onSignOut}
        >
          <IconLogout className="h-4 w-4" />
          Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
