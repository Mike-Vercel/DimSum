"use client";

import {
  Bell,
  Headset,
  Heart,
  LayoutGrid,
  MapPin,
  ReceiptText,
  ShieldCheck,
  TicketPercent,
  UserRoundPen,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ListRow } from "@/components/ui/misc";
import { useSession } from "@/lib/auth-client";
import { cn } from "@/lib/cn";

interface Section {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Visible to guests too (works without an account). */
  public?: boolean;
}

export const ACCOUNT_SECTIONS: Section[] = [
  { href: "/account", label: "Panoramica", icon: LayoutGrid, public: true },
  { href: "/account/ordini", label: "I miei ordini", icon: ReceiptText, public: true },
  { href: "/account/indirizzi", label: "Indirizzi", icon: MapPin },
  { href: "/account/preferiti", label: "Preferiti", icon: Heart },
  { href: "/offerte", label: "Offerte e coupon", icon: TicketPercent, public: true },
  { href: "/account/notifiche", label: "Notifiche", icon: Bell },
  { href: "/account/profilo", label: "Dati personali", icon: UserRoundPen },
  { href: "/account/privacy", label: "Privacy e dati", icon: ShieldCheck },
  { href: "/supporto", label: "Assistenza", icon: Headset, public: true },
];

/** Desktop side navigation of the account area. */
export function AccountSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const sections = ACCOUNT_SECTIONS.filter((s) => session || s.public);
  return (
    <nav aria-label="Il mio account" className="sticky top-24 hidden self-start lg:block">
      <ul className="space-y-1">
        {sections.map(({ href, label, icon: Icon }) => {
          const active = href === "/account" ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-body-sm font-semibold transition-colors",
                  active
                    ? "bg-surface text-fg shadow-xs ring-1 ring-line"
                    : "text-fg-muted hover:bg-surface hover:text-fg",
                )}
              >
                <Icon className={cn("size-4.5", active && "text-brand")} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** The same sections as a settings list (phones, reference screen "Profilo"). */
export function AccountMenuList({ signedIn }: { signedIn: boolean }) {
  const sections = ACCOUNT_SECTIONS.filter((s) => s.href !== "/account" && (signedIn || s.public));
  return (
    <div className="divide-y divide-line overflow-hidden rounded-2xl bg-surface ring-1 ring-line lg:hidden">
      {sections.map(({ href, label, icon: Icon }) => (
        <ListRow key={href} href={href} label={label} icon={<Icon className="size-4.5" />} />
      ))}
    </div>
  );
}
