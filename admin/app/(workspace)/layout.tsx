"use client";

import { ThemeToggle } from "@/components/shared/theme-toggle";
// app/(workspace)/layout.tsx

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
        "group flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0",
          active ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground",
        )}
      />
      {label}
      {active && <ChevronRight className="ml-auto h-3.5 w-3.5 text-primary/70" />}
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
        <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-sidebar">
          <div className="flex h-16 items-center gap-2.5 border-b border-border px-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary text-white shadow-sm shadow-primary/20">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-tight">VendeoAI</p>
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Admin panel
              </p>
            </div>
            <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
              ADMIN
            </span>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
            <p className="text-label mb-1.5 px-2.5">Navigation</p>
            {visibleNav.map((item) => (
              <NavLink
                key={item.href}
                {...item}
                active={pathname.startsWith(item.href)}
              />
            ))}
          </nav>

          <Separator />

          <div className="space-y-2 p-2">
            <div className="glass-card flex items-center gap-2 px-2 py-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 text-[11px] font-bold text-primary">
                {admin.email[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium leading-tight">
                  {admin.email}
                </p>
                {admin.role === "SUPER_ADMIN" ? (
                  <p className="text-[11px] font-semibold text-warning">
                    SUPER ADMIN
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">ADMIN</p>
                )}
              </div>
              <ThemeToggle />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-full justify-start gap-2 text-[13px] text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
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

        <div className="admin-shell flex flex-1 flex-col overflow-hidden">
          <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-background/80 px-6 backdrop-blur-sm">
            <span className="text-sm font-medium text-muted-foreground">Admin</span>
            {currentNav && (
              <>
                <span className="text-muted-foreground/40">/</span>
                <span className="text-sm font-semibold text-foreground">
                  {currentNav.label}
                </span>
              </>
            )}
            {pathname.match(/^\/users\/[^/]+$/) && (
              <>
                <span className="text-muted-foreground/40">/</span>
                <span className="text-sm font-semibold text-foreground">Détail</span>
              </>
            )}
            <div className="ml-auto flex items-center gap-2 rounded-full border border-secondary/25 bg-secondary/10 px-3 py-1.5">
              <span
                className="h-1.5 w-1.5 rounded-full bg-secondary"
                style={{ boxShadow: "0 0 5px var(--secondary)" }}
              />
              <span className="text-xs font-medium text-secondary-foreground/80 dark:text-secondary">
                Opérationnel
              </span>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto">
            <div className="p-6 lg:p-8">{children}</div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
