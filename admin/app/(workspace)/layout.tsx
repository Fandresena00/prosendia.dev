"use client";

import { ThemeToggle } from "@/components/shared/theme-toggle";
// app/(workspace)/layout.tsx
// Plans Custom retiré de la nav — tout est dans /users/[id]

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";
import { adminAuthApi, type AdminMe } from "@/lib/admin-api";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  LayoutDashboard,
  LogOut,
  ScrollText,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/users", label: "Utilisateurs", icon: Users },
  {
    href: "/admins",
    label: "Administrateurs",
    icon: Settings,
    superAdminOnly: true,
  },
  {
    href: "/logs",
    label: "Audit logs",
    icon: ScrollText,
    superAdminOnly: true,
  },
];

function NavLink({
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
        "group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-all duration-100",
        active
          ? "bg-emerald-500/10 text-emerald-500"
          : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
      )}
    >
      <Icon
        className={cn(
          "h-[15px] w-[15px] shrink-0 transition-colors",
          active
            ? "text-emerald-500"
            : "text-muted-foreground/40 group-hover:text-muted-foreground",
        )}
      />
      {label}
      {active && (
        <ChevronRight className="ml-auto h-3 w-3 text-emerald-500/50" />
      )}
    </Link>
  );
}

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

  const visibleNav = NAV.filter(
    (n) => !n.superAdminOnly || admin.role === "SUPER_ADMIN",
  );
  const currentNav = visibleNav.find((n) => pathname.startsWith(n.href));

  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex h-screen overflow-hidden bg-background">
        {/* ── Sidebar ──────────────────────────────────────────────── */}
        <aside className="flex w-[220px] shrink-0 flex-col border-r border-border">
          {/* Brand */}
          <div className="flex h-[52px] items-center gap-2.5 border-b border-border px-4">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/15">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                  stroke="oklch(0.70 0.18 162)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span className="text-[13px] font-semibold tracking-tight">
              VendeoAI
            </span>
            <span className="ml-auto rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-500">
              ADMIN
            </span>
          </div>

          {/* Nav */}
          <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
            <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/30">
              Navigation
            </p>
            {visibleNav.map((item) => (
              <NavLink
                key={item.href}
                {...item}
                active={pathname.startsWith(item.href)}
              />
            ))}
          </nav>

          <Separator />

          {/* Footer */}
          <div className="p-2 space-y-1">
            <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-[10px] font-bold text-emerald-500">
                {admin.email[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-medium leading-tight">
                  {admin.email}
                </p>
                {admin.role === "SUPER_ADMIN" ? (
                  <p className="text-[9px] font-semibold text-yellow-500">
                    SUPER ADMIN
                  </p>
                ) : (
                  <p className="text-[9px] text-muted-foreground/40">ADMIN</p>
                )}
              </div>
              <ThemeToggle />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 h-7 text-[12px] text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10"
              onClick={async () => {
                await adminAuthApi.logout();
                router.push("/");
              }}
            >
              <LogOut className="h-3.5 w-3.5" />
              Déconnexion
            </Button>
          </div>
        </aside>

        {/* ── Main ───────────────────────────────────────────────── */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Topbar */}
          <header className="flex h-[52px] shrink-0 items-center gap-2 border-b border-border px-6">
            <span className="text-xs text-muted-foreground/30">Admin</span>
            {currentNav && (
              <>
                <span className="text-muted-foreground/20">/</span>
                <span className="text-xs font-medium text-foreground">
                  {currentNav.label}
                </span>
              </>
            )}
            {/* Breadcrumb pour /users/[id] */}
            {pathname.match(/^\/users\/[^/]+$/) && (
              <>
                <span className="text-muted-foreground/20">/</span>
                <span className="text-xs font-medium text-foreground">
                  Détail
                </span>
              </>
            )}
            <div className="ml-auto flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] text-emerald-500/70">
                Opérationnel
              </span>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto">
            <div className="p-6">{children}</div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
