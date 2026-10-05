"use client";

import type { LoyaltySummaryDTO } from "@dimsum/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gift, Sparkles } from "lucide-react";
import Link from "next/link";
import { Seal } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { ApiError, api } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { useCart } from "@/lib/stores/cart";

interface PublicReward {
  id: string;
  name: string;
  description: string | null;
  pointsCost: number;
}

/** Live Club: rules for everyone, balance and rewards for members. */
export function ClubView({
  programName,
  pointsPerEuro,
  rewards,
}: {
  programName: string;
  pointsPerEuro: number;
  rewards: PublicReward[];
}) {
  const qc = useQueryClient();
  const { data: session } = useSession();
  const setCoupon = useCart((s) => s.setCoupon);
  const me = useQuery({ queryKey: ["me", "loyalty"], queryFn: () => api.me.loyalty(), enabled: !!session });
  const redeem = useMutation({
    mutationFn: (rewardId: string) => api.me.redeemReward(rewardId),
    onSuccess: ({ coupon }) => {
      void qc.invalidateQueries({ queryKey: ["me"] });
      if (coupon.code) setCoupon(coupon.code);
      toast.success("Premio riscattato", {
        description: coupon.code ? `Il codice ${coupon.code} è già nel tuo carrello.` : undefined,
      });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Riscatto non riuscito."),
  });
  const loyalty: LoyaltySummaryDTO | undefined = me.data;

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-red-500 p-6 text-white shadow-cta sm:p-8">
        <Seal className="absolute -right-6 -bottom-10 h-52 text-white/12" />
        <p className="text-caption font-bold tracking-[0.2em] uppercase">{programName}</p>
        {loyalty ? (
          <>
            <p className="mt-3 text-hero font-extrabold tabular-nums">
              {loyalty.points.toLocaleString("it-IT")}
            </p>
            <p className="text-body text-white/85">
              punti disponibili{loyalty.tier ? ` · livello ${loyalty.tier.name}` : ""}
            </p>
            {loyalty.nextReward ? (
              <p className="mt-3 text-body-sm">
                Ancora {loyalty.nextReward.pointsNeeded} punti per “{loyalty.nextReward.name}”.
              </p>
            ) : null}
          </>
        ) : (
          <>
            <h1 className="mt-3 max-w-lg text-display font-extrabold text-balance">
              Ogni ordine ti avvicina a un premio
            </h1>
            <p className="mt-2 max-w-md text-body text-white/85">
              {pointsPerEuro === 1 ? "1 punto" : `${pointsPerEuro} punti`} per ogni euro speso nei piatti,
              sugli ordini consegnati o ritirati.
            </p>
            {!session ? (
              <div className="mt-5 flex flex-wrap gap-2.5">
                <Button asChild variant="white">
                  <Link href="/registrati?next=/club">Iscriviti gratis</Link>
                </Button>
                <Button asChild variant="outline" className="text-white ring-white/40">
                  <Link href="/login?next=/club">Accedi</Link>
                </Button>
              </div>
            ) : null}
          </>
        )}
      </section>

      <section aria-labelledby="premi" className="space-y-3">
        <h2 id="premi" className="text-title-lg font-extrabold">
          Premi
        </h2>
        {rewards.length === 0 ? (
          <p className="text-body-sm text-fg-muted">I premi saranno disponibili a breve.</p>
        ) : null}
        <ul className="grid gap-3 sm:grid-cols-2">
          {rewards.map((r) => {
            const canRedeem = loyalty?.rewards.find((x) => x.id === r.id)?.canRedeem ?? false;
            return (
              <li key={r.id} className="flex items-center gap-4 rounded-2xl bg-surface p-4 ring-1 ring-line">
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-ink">
                  <Gift className="size-5.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{r.name}</span>
                  <span className="block text-body-sm text-fg-muted">
                    {r.description ?? `${r.pointsCost} punti`}
                  </span>
                </span>
                {loyalty ? (
                  <Button
                    size="sm"
                    variant={canRedeem ? "primary" : "secondary"}
                    disabled={!canRedeem}
                    loading={redeem.isPending && redeem.variables === r.id}
                    onClick={() => redeem.mutate(r.id)}
                  >
                    {r.pointsCost} pt
                  </Button>
                ) : (
                  <span className="text-body-sm font-semibold tabular-nums">{r.pointsCost} pt</span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {loyalty?.history.length ? (
        <section aria-labelledby="movimenti" className="space-y-3">
          <h2 id="movimenti" className="text-title-lg font-extrabold">
            Movimenti
          </h2>
          <ul className="divide-y divide-line rounded-2xl bg-surface ring-1 ring-line">
            {loyalty.history.map((h) => (
              <li key={h.id} className="flex justify-between gap-3 px-4 py-3 text-body-sm">
                <span>{h.description}</span>
                <span className={h.points > 0 ? "font-semibold text-success" : "font-semibold text-fg-muted"}>
                  {h.points > 0 ? "+" : ""}
                  {h.points}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/** Before launch: honest "coming soon", no sign-up pressure. */
export function ClubComingSoon({ programName }: { programName: string }) {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-ink-950 p-8 text-white">
      <Seal className="absolute -top-6 -right-6 h-56 text-red-500/20" />
      <p className="flex items-center gap-2 text-caption font-bold tracking-[0.2em] text-red-300 uppercase">
        <Sparkles className="size-4" /> In arrivo
      </p>
      <h1 className="mt-3 max-w-xl text-display font-extrabold text-balance">
        {programName} sta per arrivare
      </h1>
      <p className="mt-3 max-w-lg text-body text-white/75">
        Stiamo preparando il programma fedeltà di DIMSUM: punti sugli ordini e premi per chi ci sceglie
        spesso. Quando sarà attivo lo troverai qui.
      </p>
      <Button asChild size="lg" className="mt-6">
        <Link href="/menu">Intanto, ordina dal menu</Link>
      </Button>
    </section>
  );
}
