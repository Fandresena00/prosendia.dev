"use client";

// app/(workspace)/layout.tsx
//
// Principes :
// • Sidebar fixe 240px, main occupe tout le reste — pas de max-width
// • On utilise les variants natifs de shadcn (Button ghost, Badge outline, Separator)
//   sans surcharger leurs classes de couleur
// • Les tokens CSS (--primary, --muted-foreground, --border…) font le travail

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
import { Crown, LayoutDashboard, LogOut, Settings, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
        // On part du style shadcn Button ghost et on ajuste uniquement ce qui change
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0",
          active ? "text-primary" : "text-muted-foreground/60",
        )}
      />
      {label}
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

  const visibleNav = NAV_ITEMS.filter(
    (item) => !item.superAdminOnly || admin.role === "SUPER_ADMIN",
  );

  return (
    <TooltipProvider delayDuration={200}>
      {/* Root : plein écran, pas de max-width */}
      <div className="flex h-screen overflow-hidden bg-background">
        {/* ── Sidebar ───────────────────────────────────────────────── */}
        <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-card">
          {/* Brand */}
          <div className="flex h-14 items-center gap-3 border-b border-border px-4">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                  stroke="hsl(var(--primary))"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold">VendeoAI</p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
                Admin
              </p>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
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

          {/* User footer */}
          <div className="p-3">
            <div className="mb-2 flex items-center gap-2.5 rounded-md px-2 py-2">
              {/* Avatar initiale */}
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {admin.email[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{admin.email}</p>
                {admin.role === "SUPER_ADMIN" ? (
                  <Badge
                    variant="outline"
                    className="mt-0.5 h-4 gap-1 px-1.5 text-[10px]"
                  >
                    <Crown className="h-2.5 w-2.5" />
                    Super admin
                  </Badge>
                ) : (
                  <p className="text-[10px] text-muted-foreground">
                    Administrateur
                  </p>
                )}
              </div>
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive"
                  onClick={async () => {
                    await adminAuthApi.logout();
                    router.push("/");
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  Se déconnecter
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Terminer la session</TooltipContent>
            </Tooltip>
          </div>
        </aside>

        {/* ── Main content — plein écran, scroll vertical ────────────── */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top bar */}
          <header className="flex h-14 shrink-0 items-center border-b border-border bg-card/50 px-6">
            <p className="text-sm text-muted-foreground">
              {/* Breadcrumb minimal */}
              {visibleNav.find((n) => pathname.startsWith(n.href))?.label ??
                "Admin"}
            </p>
          </header>

          {/* Page area — overflow scroll, pas de max-width */}
          <main className="flex-1 overflow-y-auto">
            <div className="page-content">{children}</div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
