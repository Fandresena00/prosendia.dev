// (workspace)/layout.tsx

"use client";

import { adminAuthApi, type AdminMe } from "@/lib/admin-api";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/users", label: "Utilisateurs" },
  { href: "/plans", label: "Plans" },
  { href: "/admins", label: "Administrateurs", superAdminOnly: true },
];

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
  if (!checked) return null;
  if (!admin) return null;

  async function handleLogout() {
    await adminAuthApi.logout();
    router.push("/");
  }

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100">
      <aside className="flex w-60 flex-col border-r border-zinc-800 bg-zinc-925 px-4 py-6">
        <div className="mb-8 flex items-center gap-2 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-semibold">
            V
          </div>
          <span className="text-sm font-semibold">VendeoAI Admin</span>
        </div>

        <nav className="flex-1 space-y-0.5">
          {NAV_ITEMS.filter(
            (item) => !item.superAdminOnly || admin.role === "SUPER_ADMIN",
          ).map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-lg px-3 py-2 text-sm transition ${
                  active
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-zinc-800 pt-4">
          <p className="truncate px-2 text-xs text-zinc-500">{admin.email}</p>
          <p className="px-2 text-[10px] uppercase tracking-wide text-zinc-600">
            {admin.role === "SUPER_ADMIN" ? "Super admin" : "Admin"}
          </p>
          <button
            onClick={handleLogout}
            className="mt-3 w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-400 transition hover:bg-zinc-900 hover:text-red-400"
          >
            Se déconnecter
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto px-8 py-8">{children}</main>
    </div>
  );
}
