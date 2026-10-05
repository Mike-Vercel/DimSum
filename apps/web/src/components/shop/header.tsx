"use client";

import { formatEuro } from "@dimsum/domain";
import { ShoppingBag, UserRound } from "lucide-react";
import { motion, useAnimate } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { Logo } from "@/components/brand/logo";
import { Avatar } from "@/components/ui/misc";
import { useSession } from "@/lib/auth-client";
import { cn } from "@/lib/cn";
import { selectEstimatedSubtotal, selectItemCount, useCart } from "@/lib/stores/cart";
import { useScrollDirection } from "@/lib/scroll-direction";
import { useHydrated } from "@/lib/stores/hydration";
import { LocationButton } from "./location-button";
import { SearchOverlayTrigger } from "./search/search-trigger";

const NAV = [
  { href: "/menu", label: "Menu" },
  { href: "/offerte", label: "Offerte" },
  { href: "/club", label: "Dimsum Club" },
] as const;

function AccountButton({ className }: { className?: string }) {
  const { data: session, isPending } = useSession();
  if (session) {
    return (
      <Link href="/account" aria-label="Il mio profilo" className={cn("tap rounded-full", className)}>
        <Avatar name={session.user.name} src={session.user.image} className="size-10 text-caption" />
      </Link>
    );
  }
  return (
    <Link
      href="/login"
      aria-label="Accedi"
      className={cn(
        "grid size-10 tap place-items-center rounded-full bg-surface ring-1 ring-line",
        isPending && "opacity-60",
        className,
      )}
    >
      <UserRound className="size-5" />
    </Link>
  );
}

export function CartButton() {
  const hydrated = useHydrated();
  const count = useCart(selectItemCount);
  const subtotal = useCart(selectEstimatedSubtotal);
  const pulse = useCart((s) => s.pulse);
  const [scope, animate] = useAnimate();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    void animate(scope.current, { scale: [1, 1.12, 0.96, 1] }, { duration: 0.45 });
  }, [pulse, animate, scope]);

  const items = hydrated ? count : 0;
  return (
    <Link
      ref={scope}
      href="/cart"
      aria-label={`Carrello, ${items} articoli`}
      className={cn(
        // Never squeezed or wrapped, and as wide when empty as with a 3-digit total: adding a dish
        // never moves the rest of the bar.
        "inline-flex h-11 min-w-42 shrink-0 tap items-center justify-center gap-2.5 rounded-full px-4 font-semibold whitespace-nowrap transition-colors",
        items ? "bg-brand text-white shadow-cta" : "bg-surface text-fg ring-1 ring-line",
      )}
    >
      <ShoppingBag className="size-5" />
      {items ? (
        <>
          <span className="tabular-nums">{formatEuro(subtotal)}</span>
          <motion.span
            key={items}
            initial={{ scale: 0.6 }}
            animate={{ scale: 1 }}
            className="grid h-6 min-w-6 place-items-center rounded-full bg-white px-1.5 text-caption text-brand-ink"
          >
            {items}
          </motion.span>
        </>
      ) : (
        <span>Carrello</span>
      )}
    </Link>
  );
}

export function ShopHeader() {
  const pathname = usePathname();
  const ref = useRef<HTMLElement>(null);
  // Phones: while the customer scrolls down, the brand row (logo, search, profile) folds away and
  // "Consegna a" takes its place; scrolling up brings it back, like the tab bar at the bottom.
  const compact = useScrollDirection() === "down";

  // Bars that stick below the header (menu categories) attach to its real height, whatever the
  // device, safe area or font: no gap where the content shows through.
  useEffect(() => {
    const header = ref.current;
    if (!header) return;
    const root = document.documentElement;
    const update = () => root.style.setProperty("--shop-header-h", `${header.offsetHeight}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(header);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--shop-header-h");
    };
  }, []);

  return (
    <header
      ref={ref}
      className={cn(
        "sticky top-0 z-40 border-b border-transparent bg-canvas/85 pt-safe backdrop-blur-xl supports-[backdrop-filter]:bg-canvas/75",
        // The folded row becomes margin below the header: the page underneath never moves.
        "transition-[margin-bottom] duration-300 ease-out motion-reduce:transition-none",
        compact && "mb-[29px] lg:mb-0",
      )}
    >
      {/* Mobile */}
      <div className="flex items-center gap-3 px-4 py-2.5 lg:hidden">
        <div className="min-w-0 flex-1">
          <div
            inert={compact}
            className={cn(
              "h-[29px] overflow-hidden transition-[height,opacity] duration-300 ease-out motion-reduce:transition-none",
              compact && "h-0 opacity-0",
            )}
          >
            <Link href="/" aria-label="DIMSUM, home" className="block w-fit">
              <Logo className="h-[18px] text-fg" />
            </Link>
          </div>
          <LocationButton />
        </div>
        {/* Room for focus rings inside the clipping box (-m-1 p-1). */}
        <div
          inert={compact}
          className={cn(
            "-m-1 flex max-w-[100px] items-center gap-3 overflow-hidden p-1 transition-[max-width,opacity] duration-300 ease-out motion-reduce:transition-none",
            compact && "max-w-0 opacity-0",
          )}
        >
          <SearchOverlayTrigger variant="icon" />
          <AccountButton />
        </div>
      </div>

      {/* Tablet & desktop */}
      <div className="mx-auto hidden h-18 max-w-7xl items-center gap-3 px-6 lg:flex xl:gap-6 xl:px-8">
        <Link href="/" aria-label="DIMSUM, home" className="shrink-0">
          <Logo className="h-5 text-fg xl:h-6" />
        </Link>
        <nav aria-label="Principale" className="flex shrink-0 items-center gap-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "rounded-full px-3 py-2 text-body-sm font-semibold whitespace-nowrap transition-colors hover:bg-surface",
                pathname.startsWith(n.href) ? "text-fg" : "text-fg-muted",
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        {/* The only flexible item: a long address truncates, the bar never wraps or overflows. */}
        <LocationButton compact className="max-w-64 xl:max-w-72" />
        <div className="ml-auto flex shrink-0 items-center gap-3">
          <SearchOverlayTrigger variant="icon" className="xl:hidden" />
          <SearchOverlayTrigger variant="field" className="hidden xl:flex" />
          <AccountButton />
          <CartButton />
        </div>
      </div>
    </header>
  );
}
