"use client";

import type { CartQuoteDTO } from "@dimsum/types";
import { CircleCheck, TicketPercent, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { useCart } from "@/lib/stores/cart";

/** "Codice promozionale" + Applica (reference screen 5). Validation happens in the server quote. */
export function CouponField({ quote, loading }: { quote: CartQuoteDTO | undefined; loading: boolean }) {
  const code = useCart((s) => s.couponCode);
  const setCoupon = useCart((s) => s.setCoupon);
  const [draft, setDraft] = useState(code ?? "");
  const applied = quote?.coupon;
  const error = code ? quote?.couponError : null;

  return (
    <div className="space-y-2">
      {applied ? (
        <div className="flex items-center gap-3 rounded-xl bg-success-soft px-3.5 py-3">
          <CircleCheck className="size-5 shrink-0 text-success" aria-hidden />
          <p className="min-w-0 flex-1 text-body-sm">
            <span className="font-semibold text-success">{applied.name}</span>
            <span className="block text-caption text-fg-muted">
              {applied.automatic ? "Promozione applicata automaticamente" : `Codice ${applied.code}`}
            </span>
          </p>
          {!applied.automatic ? (
            <button
              type="button"
              aria-label="Rimuovi codice"
              className="grid size-8 place-items-center rounded-full hover:bg-white/60"
              onClick={() => {
                setCoupon(null);
                setDraft("");
              }}
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
      ) : null}
      {!applied || applied.automatic ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setCoupon(draft.trim() || null);
          }}
        >
          <label className="relative flex-1">
            <span className="sr-only">Codice promozionale</span>
            <TicketPercent
              className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-fg-subtle"
              aria-hidden
            />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value.toUpperCase())}
              placeholder="Codice promozionale"
              autoCapitalize="characters"
              autoComplete="off"
              className={cn(
                "h-11 w-full rounded-md bg-surface pr-3 pl-10 text-body-sm font-semibold tracking-wide uppercase ring-1 ring-line outline-none placeholder:font-normal placeholder:tracking-normal placeholder:normal-case focus:ring-2 focus:ring-ink-900",
                error && "ring-2 ring-danger",
              )}
              aria-invalid={!!error}
            />
          </label>
          <Button
            type="submit"
            variant="dark"
            size="md"
            loading={loading && !!draft && draft === code}
            disabled={!draft.trim()}
          >
            Applica
          </Button>
        </form>
      ) : null}
      {error ? (
        <p role="alert" className="text-caption font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
