"use client";

// app/(workspace)/layout.tsx

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
  BarChart3,
  Crown,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/users", label: "Utilisateurs", icon: Users },
  { href: "/plans", label: "Plans", icon: BarChart3 },
  {
    href: "/admins",
    label: "Administrateurs",
    icon: Settings,
    superAdminOnly: true,
  },
];

function NavItem({
  item,
  active,
}: {
  item: (typeof NAV_ITEMS)[number];
  active: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all",
        active
          ? "bg-zinc-800 text-zinc-100"
          : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200",
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0 transition-colors",
          active
            ? "text-emerald-400"
            : "text-zinc-600 group-hover:text-zinc-400",
        )}
      />
      {item.label}
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

  async function handleLogout() {
    await adminAuthApi.logout();
    router.push("/");
  }

  const visibleNav = NAV_ITEMS.filter(
    (item) => !item.superAdminOnly || admin!.role === "SUPER_ADMIN",
  );

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex min-h-screen bg-zinc-950">
        {/* Sidebar */}
        <aside className="flex w-55 shrink-0 flex-col border-r border-zinc-800/60 bg-zinc-950 px-3 py-5">
          {/* Brand */}
          <div className="mb-6 flex items-center gap-2.5 px-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                  stroke="#10b981"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <p className="text-[13px] font-semibold text-zinc-100">
                VendeoAI
              </p>
              <p className="text-[10px] tracking-wide text-zinc-600">ADMIN</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-0.5">
            {visibleNav.map((item) => (
              <NavItem
                key={item.href}
                item={item}
                active={pathname.startsWith(item.href)}
              />
            ))}
          </nav>

          <Separator className="my-3 bg-zinc-800/60" />

          {/* User footer */}
          <div className="space-y-2 px-1">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[11px] font-semibold text-zinc-300">
                {admin.email[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[12px] font-medium text-zinc-300">
                  {admin.email}
                </p>
                <div className="mt-0.5">
                  {admin.role === "SUPER_ADMIN" ? (
                    <Badge
                      variant="outline"
                      className="h-4 gap-1 border-amber-700/40 bg-amber-950/30 px-1.5 py-0 text-[10px] text-amber-400"
                    >
                      <Crown className="h-2.5 w-2.5" />
                      Super admin
                    </Badge>
                  ) : (
                    <span className="text-[10px] tracking-wide text-zinc-600">
                      Admin
                    </span>
                  )}
                </div>
              </div>
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="h-8 w-full justify-start gap-2 px-3 text-[12px] text-zinc-500 hover:bg-zinc-900 hover:text-red-400"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Se déconnecter
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">
                Terminer la session
              </TooltipContent>
            </Tooltip>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-8 py-8">{children}</div>
        </main>
      </div>
    </TooltipProvider>
  );
}
