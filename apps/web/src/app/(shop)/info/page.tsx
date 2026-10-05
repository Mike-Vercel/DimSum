import { ALLERGEN_DISCLAIMER } from "@dimsum/domain";
import { Bike, Clock, CreditCard, Mail, MapPin, Phone, Star } from "lucide-react";
import type { Metadata } from "next";
import { DeliveryAreaMap } from "@/components/address/delivery-area-map";
import { InstagramIcon } from "@/components/brand/provider-icons";
import { RestaurantMap } from "@/components/shop/restaurant-map";
import { summarizeHours } from "@/lib/hours";
import { features } from "@/server/env";
import { getRestaurantConfig, toRestaurantInfo } from "@/server/services/restaurant";

export const metadata: Metadata = {
  title: "Il locale: orari, indirizzo e contatti",
  description:
    "DIMSUM, asian street food a Palermo: dove siamo, orari del locale e degli ordini online, contatti.",
  alternates: { canonical: "/info" },
};

export default async function InfoPage() {
  const config = await getRestaurantConfig();
  const info = toRestaurantInfo(config);
  const blocks = [
    { title: "Locale", rows: summarizeHours(info.venueHours) },
    { title: "Consegna a domicilio", rows: summarizeHours(info.deliveryHours) },
    { title: "Ritiro al locale", rows: summarizeHours(info.pickupHours) },
  ];
  const payments = [
    info.checkout.paymentMethods.online
      ? features().paymentProvider === "stripe"
        ? "Carta, Apple Pay e Google Pay online"
        : "Pagamento online"
      : null,
    info.checkout.paymentMethods.cashOnDelivery ? "Contanti alla consegna" : null,
    info.checkout.paymentMethods.cashOnPickup ? "Contanti al ritiro" : null,
  ].filter(Boolean);
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${config.location.lat},${config.location.lng}`;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 pb-16 lg:px-8 lg:pt-12">
      <h1 className="text-display font-extrabold">{config.name}</h1>
      {config.tagline ? <p className="mt-1 text-body text-fg-muted">{config.tagline}</p> : null}
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-8">
          <div className="h-80 overflow-hidden rounded-3xl ring-1 ring-line">
            <RestaurantMap location={config.location} name={config.name} />
          </div>
          <section aria-labelledby="orari" className="space-y-4">
            <h2 id="orari" className="text-title-lg flex items-center gap-2 font-extrabold">
              <Clock className="size-5" /> Orari
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {blocks.map((b) => (
                <div key={b.title} className="rounded-2xl bg-surface p-4 ring-1 ring-line">
                  <h3 className="font-bold">{b.title}</h3>
                  <dl className="mt-2 space-y-1 text-body-sm">
                    {b.rows.map((r) => (
                      <div key={r.days}>
                        <dt className="text-fg-muted">{r.days}</dt>
                        <dd className="tabular-nums">{r.ranges}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          </section>
          <section aria-labelledby="zone" className="space-y-4">
            <h2 id="zone" className="text-title-lg flex items-center gap-2 font-extrabold">
              <Bike className="size-5" /> Dove consegniamo
            </h2>
            <DeliveryAreaMap />
          </section>
          <section aria-labelledby="allergeni" className="rounded-2xl bg-warning-soft p-5">
            <h2 id="allergeni" className="font-bold">
              Allergeni
            </h2>
            <p className="mt-1 text-body-sm">{ALLERGEN_DISCLAIMER}</p>
          </section>
        </div>
        <aside className="space-y-4">
          <a
            href={directions}
            target="_blank"
            rel="noopener noreferrer"
            className="flex tap items-start gap-3 rounded-2xl bg-ink-950 p-5 text-white"
          >
            <MapPin className="mt-0.5 size-5 shrink-0 text-red-400" />
            <span>
              <span className="block font-bold">{config.address.formatted}</span>
              <span className="block text-body-sm text-white/70">Indicazioni stradali</span>
            </span>
          </a>
          <div className="space-y-1 rounded-2xl bg-surface p-2 ring-1 ring-line">
            {config.phone ? (
              <a
                href={`tel:${config.phone}`}
                className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-surface-2"
              >
                <Phone className="size-5 text-fg-muted" /> {config.phone}
              </a>
            ) : null}
            {config.email ? (
              <a
                href={`mailto:${config.email}`}
                className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-surface-2"
              >
                <Mail className="size-5 text-fg-muted" /> {config.email}
              </a>
            ) : null}
            {config.instagramUrl ? (
              <a
                href={config.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-surface-2"
              >
                <InstagramIcon className="size-5 text-fg-muted" /> Instagram
              </a>
            ) : null}
            {config.googleReviewUrl ? (
              <a
                href={config.googleReviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-surface-2"
              >
                <Star className="size-5 text-fg-muted" /> Lascia una recensione
              </a>
            ) : null}
          </div>
          {payments.length ? (
            <div className="rounded-2xl bg-surface p-5 ring-1 ring-line">
              <h2 className="flex items-center gap-2 font-bold">
                <CreditCard className="size-5" /> Pagamenti
              </h2>
              <ul className="mt-2 space-y-1 text-body-sm text-fg-muted">
                {payments.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {config.legalName || config.vatNumber ? (
            <p className="px-1 text-caption text-fg-subtle">
              {[config.legalName, config.vatNumber ? `P.IVA ${config.vatNumber}` : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
