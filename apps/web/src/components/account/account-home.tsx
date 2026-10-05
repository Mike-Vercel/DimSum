"use client";

import type { LoyaltySummaryDTO, MeDTO, OrderSummaryDTO } from "@dimsum/types";
import { Bike, ChefHat, LogOut, MailWarning, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Seal } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/feedback";
import { Avatar, ListRow } from "@/components/ui/misc";
import { toast } from "@/components/ui/toaster";
import { authClient } from "@/lib/auth-client";
import { signOutAndForget } from "@/lib/sign-out";
import { AccountMenuList } from "./account-nav";
import { OrderCard } from "./order-card";

function ClubCard({ loyalty }: { loyalty: LoyaltySummaryDTO }) {
  const target = loyalty.nextReward;
  const progress = target ? Math.min(100, Math.round((loyalty.points / target.pointsCost) * 100)) : 100;
  return (
    <Link
      href="/club"
      className="relative block tap overflow-hidden rounded-3xl bg-red-500 p-5 text-white shadow-cta"
    >
      <Seal className="absolute -right-3 -bottom-6 h-36 text-white/12" />
      <p className="text-caption font-bold tracking-[0.2em] uppercase">{loyalty.programName}</p>
      <p className="mt-3 text-display font-extrabold tabular-nums">
        {loyalty.points.toLocaleString("it-IT")} <span className="text-title font-bold">punti</span>
      </p>
      {loyalty.tier ? <p className="text-body-sm text-white/80">Livello {loyalty.tier.name}</p> : null}
      {target ? (
        <div className="mt-4">
          <div
            className="h-2 overflow-hidden rounded-full bg-white/25"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Verso ${target.name}`}
          >
            <div className="h-full rounded-full bg-white" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-caption text-white/85">
            Ancora {target.pointsNeeded.toLocaleString("it-IT")} punti per {target.name}
          </p>
        </div>
      ) : null}
    </Link>
  );
}

export function AccountHome({
  me,
  loyalty,
  activeOrders,
}: {
  me: MeDTO;
  loyalty: LoyaltySummaryDTO | null;
  activeOrders: OrderSummaryDTO[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [sending, setSending] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const staff = me.role === "STAFF" || me.role === "ADMIN" || me.role === "SUPER_ADMIN";

  useEffect(() => {
    if (params.get("verificata")) {
      toast.success("Indirizzo e-mail confermato", { description: "Grazie! Il tuo account è completo." });
      window.history.replaceState(null, "", "/account");
    }
  }, [params]);

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-4">
        <Avatar name={me.name} src={me.image} className="size-16 text-title" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-headline font-extrabold">Ciao, {me.firstName}</h1>
          <p className="truncate text-body-sm text-fg-muted">{me.email}</p>
        </div>
        <Button asChild variant="secondary" size="sm" className="hidden sm:inline-flex">
          <Link href="/account/profilo">Modifica</Link>
        </Button>
      </header>

      {!me.emailVerified ? (
        <InlineAlert
          tone="warning"
          title="Conferma il tuo indirizzo e-mail"
          action={
            <Button
              size="sm"
              variant="secondary"
              loading={sending}
              onClick={async () => {
                setSending(true);
                const res = await authClient.sendVerificationEmail({
                  email: me.email,
                  callbackURL: "/account?verificata=1",
                });
                setSending(false);
                if (res.error)
                  toast.error("Invio non riuscito", { description: "Riprova tra qualche minuto." });
                else toast.success("E-mail inviata", { description: `Controlla la casella ${me.email}.` });
              }}
            >
              <MailWarning className="size-4" /> Invia di nuovo
            </Button>
          }
        >
          Ti abbiamo mandato un link: confermando, gli ordini fatti come ospite con questa e-mail si
          aggiungono al tuo storico.
        </InlineAlert>
      ) : null}

      {staff || me.role === "RIDER" ? (
        <div className="overflow-hidden rounded-2xl bg-ink-950 text-white">
          <ListRow
            href={staff ? "/admin" : "/rider"}
            icon={staff ? <ChefHat className="size-4.5" /> : <Bike className="size-4.5" />}
            label={<span className="text-white">{staff ? "Apri il gestionale" : "Apri l'app rider"}</span>}
            description={
              <span className="text-white/60">
                {staff ? "Ordini, cucina, menu e impostazioni" : "Le tue consegne di oggi"}
              </span>
            }
          />
        </div>
      ) : null}

      {activeOrders.length ? (
        <section className="space-y-3">
          <h2 className="text-title font-bold">In corso</h2>
          {activeOrders.map((o) => (
            <OrderCard key={o.id} order={o} />
          ))}
        </section>
      ) : null}

      {loyalty ? <ClubCard loyalty={loyalty} /> : null}

      <AccountMenuList signedIn />

      <Button
        variant="ghost"
        block
        className="text-danger"
        loading={signingOut}
        onClick={async () => {
          setSigningOut(true);
          await signOutAndForget();
          toast("Sei uscito dal tuo account");
          router.replace("/");
          router.refresh();
        }}
      >
        <LogOut className="size-4.5" /> Esci
      </Button>
    </div>
  );
}

/** Profile tab without an account: everything that works as a guest, and why an account helps. */
export function GuestHome({ loyaltyName }: { loyaltyName: string | null }) {
  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-ink-950 p-6 text-white">
        <Seal className="absolute -top-4 -right-4 h-40 text-red-500/25" />
        <h1 className="relative text-headline font-extrabold text-balance">Il tuo DIMSUM, sempre con te</h1>
        <p className="relative mt-2 max-w-md text-body-sm text-white/70">
          Ordini, indirizzi e preferiti su tutti i tuoi dispositivi. Puoi sempre ordinare anche senza account.
        </p>
        {loyaltyName ? (
          <p className="relative mt-3 flex items-center gap-2 text-body-sm font-semibold text-red-300">
            <Sparkles className="size-4" /> {loyaltyName}: punti su ogni ordine
          </p>
        ) : null}
        <div className="relative mt-5 grid gap-2.5 sm:flex">
          <Button asChild size="lg">
            <Link href="/login">Accedi</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="text-white ring-white/30">
            <Link href="/registrati">Crea un account</Link>
          </Button>
        </div>
      </section>
      <AccountMenuList signedIn={false} />
    </div>
  );
}
