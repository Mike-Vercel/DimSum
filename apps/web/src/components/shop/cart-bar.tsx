"use client";

import { formatEuro } from "@dimsum/domain";
import { ArrowRight, ShoppingBag } from "lucide-react";
import { AnimatePresence, motion, useAnimate } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";
import { useScrollDirection } from "@/lib/scroll-direction";
import { selectEstimatedSubtotal, selectItemCount, useCart } from "@/lib/stores/cart";
import { useHydrated } from "@/lib/stores/hydration";

const HIDDEN_ON = ["/cart", "/checkout", "/order/", "/account", "/login", "/registrati"];

/**
 * Floating "Vai al carrello" bar above the tab bar on phones. While the customer scrolls down the
 * tab bar slides away and this bar takes its place at the bottom of the screen.
 */
export function CartBar() {
  const hydrated = useHydrated();
  const reading = useScrollDirection() === "down";
  const pathname = usePathname();
  const count = useCart(selectItemCount);
  const subtotal = useCart(selectEstimatedSubtotal);
  const pulse = useCart((s) => s.pulse);
  const [scope, animate] = useAnimate();
  const seen = useRef(pulse);

  useEffect(() => {
    if (pulse === seen.current || !scope.current) return;
    seen.current = pulse;
    void animate(scope.current, { y: [0, -6, 0], scale: [1, 1.02, 1] }, { duration: 0.42 });
  }, [pulse, animate, scope]);

  const visible = hydrated && count > 0 && !HIDDEN_ON.some((p) => pathname.startsWith(p));
  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          key="cart-bar"
          initial={{ y: 96, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 96, opacity: 0 }}
          transition={spring.sheet}
          className="fixed inset-x-0 bottom-[calc(var(--safe-bottom)+72px)] z-40 px-4 lg:hidden"
        >
          <div
            className={cn(
              "transition-transform duration-300 ease-out motion-reduce:transition-none",
              reading && "translate-y-[60px]",
            )}
          >
            <div ref={scope}>
              <Link
                href="/cart"
                className="mx-auto flex h-14 max-w-lg tap items-center gap-3 rounded-2xl bg-ink-900 pr-2 pl-4 text-white shadow-lg"
              >
                <span className="relative grid size-9 place-items-center rounded-full bg-white/10">
                  <ShoppingBag className="size-5" />
                  <span className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-micro font-bold">
                    <AnimatedNumber value={count} />
                  </span>
                </span>
                <span className="flex-1 text-body-sm font-semibold">Vai al carrello</span>
                <span className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-brand px-3.5 font-bold tabular-nums">
                  {formatEuro(subtotal)}
                  <ArrowRight className="size-4" />
                </span>
              </Link>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
