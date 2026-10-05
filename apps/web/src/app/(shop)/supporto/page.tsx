import { ALLERGEN_DISCLAIMER } from "@dimsum/domain";
import { ChevronDown, Mail, Phone } from "lucide-react";
import type { Metadata } from "next";
import { SupportForm } from "@/components/support/support-form";
import { getRestaurantConfig } from "@/server/services/restaurant";

export const metadata: Metadata = {
  title: "Assistenza",
  description:
    "Domande frequenti su ordini, consegna, pagamenti e allergeni. Scrivici o chiamaci: ti rispondiamo il prima possibile.",
  alternates: { canonical: "/supporto" },
};

export default async function SupportPage() {
  const config = await getRestaurantConfig();
  const faqs: { q: string; a: string }[] = [
    {
      q: "Ho un problema con un ordine: cosa faccio?",
      a: "Apri la pagina dell'ordine dal link nell'e-mail di conferma (o da “I miei ordini” se hai un account) e tocca “Contatta assistenza”: la richiesta arriva già collegata all'ordine. Per un ordine in corso il modo più rapido è chiamare il ristorante.",
    },
    {
      q: "Posso annullare un ordine?",
      a: `Sì, dalla pagina dell'ordine, finché la cucina non lo ha confermato ed entro ${config.customerCancelWindowMinutes} minuti dall'invio. Se la cucina ha già iniziato a prepararlo, chiamaci.`,
    },
    {
      q: "Quando arriva il mio ordine?",
      a: "La stima è calcolata in tempo reale in base agli ordini in cucina, al tempo di preparazione e alla distanza. La vedi prima di pagare e la segui minuto per minuto dalla pagina dell'ordine, con la posizione del rider quando è in viaggio.",
    },
    {
      q: "Consegnate al mio indirizzo?",
      a: "Inserisci l'indirizzo nella barra in alto: ti diciamo subito se rientra nella zona di consegna, con il costo e l'ordine minimo. Puoi sempre scegliere il ritiro al locale.",
    },
    {
      q: "Come funzionano i rimborsi?",
      a: "Se un ordine pagato online viene annullato o rimborsato, l'importo torna sullo stesso metodo di pagamento. I tempi di accredito dipendono dalla tua banca, di solito 5–10 giorni lavorativi.",
    },
    {
      q: "Allergie e intolleranze",
      a: ALLERGEN_DISCLAIMER,
    },
  ];

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-5 pt-6 pb-16 lg:grid-cols-[1fr_440px] lg:gap-14 lg:px-8 lg:pt-12">
      <div className="space-y-8">
        <header>
          <p className="text-caption font-semibold tracking-widest text-brand uppercase">Assistenza</p>
          <h1 className="mt-2 text-display font-extrabold text-balance">Come possiamo aiutarti?</h1>
        </header>

        <div className="grid gap-3 sm:grid-cols-2">
          {config.phone ? (
            <a
              href={`tel:${config.phone}`}
              className="flex tap items-center gap-3.5 rounded-2xl bg-ink-950 p-4 text-white"
            >
              <span className="grid size-11 place-items-center rounded-full bg-red-500">
                <Phone className="size-5" />
              </span>
              <span>
                <span className="block text-caption text-white/70">Chiamaci</span>
                <span className="block font-bold tabular-nums">{config.phone}</span>
              </span>
            </a>
          ) : null}
          {(config.supportEmail ?? config.email) ? (
            <a
              href={`mailto:${config.supportEmail ?? config.email}`}
              className="flex tap items-center gap-3.5 rounded-2xl bg-surface p-4 ring-1 ring-line"
            >
              <span className="grid size-11 place-items-center rounded-full bg-surface-2">
                <Mail className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-caption text-fg-muted">Scrivici</span>
                <span className="block truncate font-bold">{config.supportEmail ?? config.email}</span>
              </span>
            </a>
          ) : null}
        </div>

        <section aria-labelledby="faq-title" className="space-y-3">
          <h2 id="faq-title" className="text-title-lg font-extrabold">
            Domande frequenti
          </h2>
          <div className="divide-y divide-line rounded-2xl bg-surface ring-1 ring-line">
            {faqs.map((f) => (
              <details key={f.q} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 font-semibold [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <ChevronDown className="size-5 shrink-0 text-fg-muted transition-transform group-open:rotate-180" />
                </summary>
                <p className="-mt-1 px-5 pb-5 text-body-sm text-fg-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>

      <section aria-labelledby="contact-title" className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-3xl bg-surface p-5 ring-1 ring-line sm:p-7">
          <h2 id="contact-title" className="text-title-lg mb-6 font-extrabold">
            Scrivici
          </h2>
          <SupportForm backHref="/menu" />
        </div>
      </section>
    </div>
  );
}
