"use client";

import { House, ReceiptText, UserRound, UtensilsCrossed } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";
import { resetScrollDirection, useScrollDirection } from "@/lib/scroll-direction";

const ITEMS = [
  { href: "/", label: "Home", icon: House, match: (p: string) => p === "/" },
  {
    href: "/menu",
    label: "Menu",
    icon: UtensilsCrossed,
    match: (p: string) => p.startsWith("/menu") || p.startsWith("/product"),
  },
  {
    href: "/account/ordini",
    label: "Ordini",
    icon: ReceiptText,
    match: (p: string) => p.startsWith("/account/ordini") || p.startsWith("/order"),
  },
  {
    href: "/account",
    label: "Profilo",
    icon: UserRound,
    match: (p: string) =>
      p === "/account" ||
      (p.startsWith("/account") && !p.startsWith("/account/ordini")) ||
      p.startsWith("/login"),
  },
] as const;

const HIDDEN_ON = ["/cart", "/checkout", "/order/"];

/**
 * App-style tab bar for phones (reference: Home, Menu, Ordini, Profilo). It slides away while the
 * customer scrolls down through the content and comes back as soon as they scroll up.
 */
export function BottomNav() {
  const pathname = usePathname();
  const reading = useScrollDirection() === "down";
  useEffect(() => {
    resetScrollDirection();
  }, [pathname]);
  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;
  return (
    <nav
      aria-label="Navigazione app"
      inert={reading}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-line/80 bg-canvas/90 pb-safe backdrop-blur-xl transition-transform duration-300 ease-out motion-reduce:transition-none lg:hidden",
        reading && "translate-y-full",
      )}
    >
      <ul className="mx-auto grid h-16 max-w-lg grid-cols-4">
        {ITEMS.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-full tap flex-col items-center justify-center gap-1 text-micro font-semibold",
                  active ? "text-brand" : "text-fg-muted",
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="tab-dot"
                    transition={spring.snappy}
                    className="absolute top-0 h-0.5 w-8 rounded-full bg-brand"
                  />
                ) : null}
                <Icon className="size-[22px]" strokeWidth={active ? 2.3 : 1.8} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
