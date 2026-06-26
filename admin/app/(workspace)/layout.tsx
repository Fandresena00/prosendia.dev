"use client";

import { ThemeToggle } from "@/components/shared/theme-toggle";
// app/(workspace)/layout.tsx
//
// Sidebar 240px fixe. Tokens shadcn natifs + next-themes.
// ThemeToggle intégré dans le footer de la sidebar.

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { adminAuthApi, type AdminMe } from "@/lib/admin-api";
import { cn } from "@/lib/utils";
import {
  Activity,
  Crown,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// ─── Navigation items ─────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/users", label: "Utilisateurs", icon: Users },
  {
    href: "/admins",
    label: "Administrateurs",
    icon: Settings,
    superAdminOnly: true,
  },
];

// ─── NavItem ──────────────────────────────────────────────────────────────────

function NavItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-150",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0 transition-colors",
          active
            ? "text-primary"
            : "text-muted-foreground/50 group-hover:text-foreground",
        )}
      />
      {label}
    </Link>
  );
}

// ─── Logo ─────────────────────────────────────────────────────────────────────

function VendeoLogo({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
        stroke="hsl(var(--primary))"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminMe | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (pathname === "/") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setChecked(true);
      return;
    }
    adminAuthApi
      .me()
      .then(({ admin }) => setAdmin(admin))
      .catch(() => router.replace("/"))
      .finally(() => setChecked(true));
  }, [pathname, router]);

  if (pathname === "/") return <>{children}</>;
  if (!checked || !admin) return null;

  const visibleNav = NAV_ITEMS.filter(
    (item) => !item.superAdminOnly || admin.role === "SUPER_ADMIN",
  );

  const currentNav = visibleNav.find((n) => pathname.startsWith(n.href));

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex h-screen overflow-hidden bg-background">
        {/* ── Sidebar ─────────────────────────────────────────────────── */}
        <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-card/50 backdrop-blur-sm">
          {/* Brand */}
          <div className="flex h-14 items-center gap-3 border-b border-border px-4">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
              <VendeoLogo size={14} />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-tight">VendeoAI</p>
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/50">
                Admin
              </p>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-4">
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/40">
              Navigation
            </p>
            {visibleNav.map((item) => (
              <NavItem
                key={item.href}
                {...item}
                active={pathname.startsWith(item.href)}
              />
            ))}
          </nav>

          <Separator />

          {/* Footer */}
          <div className="p-3 space-y-1">
            {/* User info */}
            <div className="flex items-center gap-2.5 rounded-md px-2 py-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary ring-1 ring-primary/20">
                {admin.email[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium leading-tight">
                  {admin.email}
                </p>
                {admin.role === "SUPER_ADMIN" ? (
                  <Badge
                    variant="outline"
                    className="mt-0.5 h-4 gap-1 border-yellow-500/30 bg-yellow-500/5 px-1.5 text-[9px] text-yellow-500"
                  >
                    <Crown className="h-2.5 w-2.5" />
                    Super admin
                  </Badge>
                ) : (
                  <p className="mt-0.5 text-[10px] text-muted-foreground/60">
                    Administrateur
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 justify-start gap-2 text-xs text-muted-foreground hover:text-destructive"
                    onClick={async () => {
                      await adminAuthApi.logout();
                      router.push("/");
                    }}
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Se déconnecter
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  Terminer la session
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </aside>

        {/* ── Main ────────────────────────────────────────────────────── */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top bar */}
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/30 px-6">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground/50">Admin</span>
              {currentNav && (
                <>
                  <span className="text-muted-foreground/30">/</span>
                  <span className="font-medium text-foreground">
                    {currentNav.label}
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1">
                <Activity className="h-3 w-3 text-emerald-500" />
                <span className="text-[11px] font-medium text-muted-foreground">
                  Système opérationnel
                </span>
              </div>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto">
            <div className="p-6">{children}</div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
