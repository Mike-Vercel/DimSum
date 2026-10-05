"use client";

import { can, type Permission } from "@dimsum/domain";
import type { Role } from "@dimsum/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bike,
  ChartColumn,
  ChefHat,
  Clock,
  ExternalLink,
  Headset,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Menu,
  ReceiptText,
  ScrollText,
  Settings,
  Sparkles,
  TicketPercent,
  Users,
  UtensilsCrossed,
  UserCog,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Logo, Seal } from "@/components/brand/logo";
import { Avatar } from "@/components/ui/misc";
import { api } from "@/lib/api";
import { signOut } from "@/lib/auth-client";
import { cn } from "@/lib/cn";
import { useRealtime } from "@/lib/realtime";

export interface AdminViewer {
  userId: string;
  name: string;
  email: string;
  role: Role;
}

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permission: Permission;
  badge?: "kitchen" | "support";
}

const NAV: { title: string; items: NavItem[] }[] = [
  {
    title: "Servizio",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard, permission: "orders:read" },
      {
        href: "/admin/cucina",
        label: "Cucina",
        icon: ChefHat,
        permission: "orders:manage",
        badge: "kitchen",
      },
      { href: "/admin/ordini", label: "Ordini", icon: ReceiptText, permission: "orders:read" },
      { href: "/admin/rider", label: "Rider", icon: Bike, permission: "riders:assign" },
      {
        href: "/admin/assistenza",
        label: "Assistenza",
        icon: Headset,
        permission: "support:manage",
        badge: "support",
      },
    ],
  },
  {
    title: "Menu e locale",
    items: [
      { href: "/admin/menu", label: "Menu", icon: UtensilsCrossed, permission: "catalog:availability" },
      { href: "/admin/orari", label: "Orari e chiusure", icon: Clock, permission: "hours:edit" },
      { href: "/admin/zone", label: "Zone di consegna", icon: MapPinned, permission: "zones:edit" },
      { href: "/admin/impostazioni", label: "Impostazioni", icon: Settings, permission: "settings:edit" },
    ],
  },
  {
    title: "Clienti e crescita",
    items: [
      { href: "/admin/statistiche", label: "Statistiche", icon: ChartColumn, permission: "analytics:read" },
      { href: "/admin/clienti", label: "Clienti", icon: Users, permission: "customers:read" },
      { href: "/admin/coupon", label: "Coupon e offerte", icon: TicketPercent, permission: "coupons:manage" },
      { href: "/admin/club", label: "Dimsum Club", icon: Sparkles, permission: "loyalty:manage" },
    ],
  },
  {
    title: "Sistema",
    items: [
      { href: "/admin/team", label: "Team", icon: UserCog, permission: "staff:manage" },
      { href: "/admin/registro", label: "Registro attività", icon: ScrollText, permission: "audit:read" },
    ],
  },
];

function useBadges(role: Role) {
  const qc = useQueryClient();
  const kitchen = useQuery({
    queryKey: ["admin", "kitchen"],
    queryFn: ({ signal }) => api.admin.kitchen(signal),
    enabled: can(role, "orders:read"),
    refetchInterval: 30_000,
  });
  const support = useQuery({
    queryKey: ["admin", "support", "open-count"],
    queryFn: () => api.admin.support.list("open"),
    enabled: can(role, "support:manage"),
    refetchInterval: 120_000,
    select: (d) => d.openCount,
  });
  useRealtime(can(role, "orders:read") ? ["kitchen"] : [], (event) => {
    if (event.type.startsWith("order.") || event.type === "delivery.assigned")
      void qc.invalidateQueries({ queryKey: ["admin", "kitchen"] });
    if (event.type === "support.created") void qc.invalidateQueries({ queryKey: ["admin", "support"] });
  });
  return {
    kitchen: kitchen.data?.orders.filter((o) => o.status === "RECEIVED").length ?? 0,
    support: support.data ?? 0,
  };
}

function NavList({
  role,
  onNavigate,
  rail = false,
}: {
  role: Role;
  onNavigate?: () => void;
  rail?: boolean;
}) {
  const pathname = usePathname();
  const badges = useBadges(role);
  return (
    <nav aria-label="Gestionale" className={rail ? "space-y-3" : "space-y-6"}>
      {NAV.map((group) => {
        const items = group.items.filter((i) => can(role, i.permission));
        if (!items.length) return null;
        return (
          <div key={group.title}>
            {rail ? (
              <hr className="mx-3 mb-3 border-white/10" />
            ) : (
              <p className="px-3 pb-2 text-micro font-semibold tracking-[0.14em] text-white/40 uppercase">
                {group.title}
              </p>
            )}
            <ul className="space-y-0.5">
              {items.map(({ href, label, icon: Icon, badge }) => {
                const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
                const count = badge ? badges[badge] : 0;
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      aria-label={rail ? label : undefined}
                      title={rail ? label : undefined}
                      className={cn(
                        "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-body-sm font-semibold transition-colors",
                        rail && "justify-center px-0",
                        active ? "bg-white text-ink-950" : "text-white/70 hover:bg-white/8 hover:text-white",
                      )}
                    >
                      <Icon className={cn("size-4.5", active && "text-red-500")} />
                      {rail ? null : <span className="flex-1">{label}</span>}
                      {count > 0 ? (
                        <span
                          className={cn(
                            "grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-micro font-bold",
                            badge === "kitchen"
                              ? "animate-pulse bg-red-500 text-white"
                              : "bg-white/15 text-white",
                            rail && "absolute -top-1 -right-1",
                          )}
                        >
                          {count}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function AccountFooter({ viewer }: { viewer: AdminViewer }) {
  const router = useRouter();
  return (
    <div className="space-y-1 border-t border-white/10 pt-4">
      <div className="flex items-center gap-3 px-3 pb-2">
        <Avatar name={viewer.name} className="size-9 bg-white/10 text-caption text-white" />
        <div className="min-w-0">
          <p className="truncate text-body-sm font-semibold text-white">{viewer.name}</p>
          <p className="truncate text-caption text-white/50">{viewer.email}</p>
        </div>
      </div>
      <Link
        href="/"
        className="flex items-center gap-3 rounded-xl px-3 py-2 text-body-sm text-white/70 hover:bg-white/8 hover:text-white"
      >
        <ExternalLink className="size-4" /> Vai al sito
      </Link>
      <button
        type="button"
        onClick={async () => {
          await signOut();
          router.replace("/login");
          router.refresh();
        }}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-body-sm text-white/70 hover:bg-white/8 hover:text-white"
      >
        <LogOut className="size-4" /> Esci
      </button>
    </div>
  );
}

/** Staff area frame: dark sidebar on desktop, drawer on tablets and phones. */
export function AdminShell({ viewer, children }: { viewer: AdminViewer; children: ReactNode }) {
  const pathname = usePathname();
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (value: boolean) => setOpenOn(value ? pathname : null);
  // The kitchen display needs the whole width: the sidebar shrinks to an icon rail there.
  const rail = pathname.startsWith("/admin/cucina");

  return (
    <div
      className={cn(
        "min-h-dvh bg-canvas lg:grid",
        rail ? "lg:grid-cols-[72px_minmax(0,1fr)]" : "lg:grid-cols-[256px_minmax(0,1fr)]",
      )}
    >
      <aside
        data-theme="dark"
        className={cn(
          "sticky top-0 hidden h-dvh flex-col gap-8 overflow-y-auto bg-ink-950 py-6 lg:flex",
          rail ? "px-2.5" : "px-3",
        )}
      >
        <Link href="/admin" className={rail ? "mx-auto" : "px-3"} aria-label="Gestionale DIMSUM">
          {rail ? (
            <Seal className="h-8 text-red-500" />
          ) : (
            <>
              <Logo className="h-5 text-white" />
              <span className="mt-1.5 block text-micro font-semibold tracking-[0.2em] text-white/40 uppercase">
                Gestionale
              </span>
            </>
          )}
        </Link>
        <div className="flex-1">
          <NavList role={viewer.role} rail={rail} />
        </div>
        {rail ? null : <AccountFooter viewer={viewer} />}
      </aside>

      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-canvas/90 px-4 pt-safe backdrop-blur-md lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Apri il menu"
          className="-ml-1 grid size-11 tap place-items-center rounded-full"
        >
          <Menu className="size-5.5" />
        </button>
        <Link href="/admin" className="py-3.5" aria-label="Gestionale DIMSUM">
          <Logo className="h-4 text-fg" />
        </Link>
      </header>

      {open ? (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menu del gestionale"
        >
          <button
            type="button"
            aria-label="Chiudi il menu"
            className="absolute inset-0 bg-overlay"
            onClick={() => setOpen(false)}
          />
          <div
            data-theme="dark"
            className="absolute inset-y-0 left-0 flex w-[min(300px,86vw)] flex-col gap-6 overflow-y-auto bg-ink-950 px-3 pt-[calc(var(--safe-top)+16px)] pb-[calc(var(--safe-bottom)+16px)] shadow-sheet"
          >
            <div className="flex items-center justify-between px-3">
              <Logo className="h-4.5 text-white" />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Chiudi"
                className="grid size-10 place-items-center rounded-full text-white hover:bg-white/10"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1">
              <NavList role={viewer.role} onNavigate={() => setOpen(false)} />
            </div>
            <AccountFooter viewer={viewer} />
          </div>
        </div>
      ) : null}

      <main id="contenuto" className="min-w-0">
        {children}
      </main>
    </div>
  );
}
