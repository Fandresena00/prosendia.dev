/**
 * @file components/sidebar-nav.tsx
 * @description Renders the full navigation from NAV_GROUPS config.
 * Handles active state, plan gating, badges, and disabled items.
 * Completely isolated from layout concerns.
 */

"use client";

import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Plan } from "@/features/auth/schemas/user.schema";
import { useCurrentUser } from "@/features/auth/store/auth.store";
import { useInboxUnreadCount } from "@/features/inbox/store/inbox.store";
import { IconLock } from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_GROUPS, NavGroup, NavItem } from "../_config/nav.config";

// ─── Plan gate helper ──────────────────────────────────────────────────────────

const PLAN_RANK: Record<Plan, number> = {
  FREE: 0,
  PRO: 1,
  ENTERPRISE: 2,
};

function hasAccess(userPlan: Plan, requiredPlan?: Plan): boolean {
  if (!requiredPlan) return true;
  return PLAN_RANK[userPlan] >= PLAN_RANK[requiredPlan];
}

// ─── Single nav item ───────────────────────────────────────────────────────────

function NavItemRow({
  item,
  active,
  locked,
  inboxUnread,
}: {
  item: NavItem;
  active: boolean;
  locked: boolean;
  inboxUnread: number;
}) {
  const {
    icon: Icon,
    title,
    url,
    badge,
    dynamicBadge,
    external,
    disabled,
  } = item;
  const isInert = disabled || locked;

  // Resolve badge value: dynamic takes precedence over static
  const badgeValue: string | null =
    dynamicBadge === "inbox_unread" && inboxUnread > 0
      ? inboxUnread > 99
        ? "99+"
        : String(inboxUnread)
      : (badge ?? null);

  const button = (
    <SidebarMenuButton
      asChild={!isInert}
      isActive={active}
      disabled={isInert}
      className={`relative h-9 rounded-lg px-3 text-[12px] font-medium transition-all
        ${
          active
            ? "bg-primary/12 text-primary"
            : isInert
              ? "cursor-not-allowed opacity-40 text-muted-foreground"
              : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
        }`}
    >
      {isInert ? (
        <span className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">{title}</span>
          {locked && <IconLock className="h-3 w-3 shrink-0 opacity-60" />}
        </span>
      ) : (
        <Link
          href={url}
          {...(external
            ? { target: "_blank", rel: "noopener noreferrer" }
            : {})}
        >
          {active && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-primary rounded-r-full" />
          )}
          <Icon className="h-3.5 w-3.5 shrink-0" />
          <span>{title}</span>
        </Link>
      )}
    </SidebarMenuButton>
  );

  return (
    <SidebarMenuItem>
      {locked ? (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              Plan {item.plan} requis
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        button
      )}

      {badgeValue && !isInert && (
        <SidebarMenuBadge
          className="bg-primary text-primary-foreground text-[9px] h-4 min-w-4 rounded-full px-1 flex items-center justify-center"
          style={{ top: "50%", transform: "translateY(-50%)" }}
        >
          {badgeValue}
        </SidebarMenuBadge>
      )}
    </SidebarMenuItem>
  );
}

// ─── Group ─────────────────────────────────────────────────────────────────────

function NavGroupSection({
  group,
  pathname,
  userPlan,
  inboxUnread,
}: {
  group: NavGroup;
  pathname: string;
  userPlan: Plan;
  inboxUnread: number;
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/55 px-3 h-8">
        {group.label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5">
          {group.items.map((item) => (
            <NavItemRow
              key={item.url}
              item={item}
              active={pathname === item.url}
              locked={!hasAccess(userPlan, item.plan)}
              inboxUnread={inboxUnread}
            />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

// ─── Public export ─────────────────────────────────────────────────────────────

export function SidebarNav() {
  const pathname = usePathname();
  const user = useCurrentUser();
  const userPlan: Plan = user?.activePlan ?? "FREE";
  const inboxUnread = useInboxUnreadCount();

  return (
    <SidebarContent className="px-2 gap-0">
      {NAV_GROUPS.map((group) => (
        <NavGroupSection
          key={group.label}
          group={group}
          pathname={pathname}
          userPlan={userPlan}
          inboxUnread={inboxUnread}
        />
      ))}
    </SidebarContent>
  );
}
