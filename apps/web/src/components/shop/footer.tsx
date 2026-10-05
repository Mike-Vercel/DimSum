import { MapPin, Phone } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { summarizeHours } from "@/lib/hours";
import type { RestaurantInfo } from "./restaurant-context";

export function ShopFooter({ restaurant }: { restaurant: RestaurantInfo }) {
  const venue = summarizeHours(restaurant.venueHours);
  const ordering = summarizeHours(restaurant.deliveryHours);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${restaurant.name} ${restaurant.address.formatted}`)}`;
  return (
    <footer data-theme="dark" className="mt-16 pb-[calc(var(--safe-bottom)+96px)] lg:pb-10">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 pt-14 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <div className="min-w-0 space-y-4">
          {/* Sized by the column width: the wordmark never spills into the next column. */}
          <Logo withTagline className="h-auto w-full max-w-60 text-white" />
          <p className="max-w-xs text-body-sm text-fg-muted">
            Ravioli, bao e noodles fatti a mano. Ordina direttamente da noi: consegna a domicilio o ritiro al
            locale.
          </p>
        </div>
        <div className="min-w-0 space-y-3 text-body-sm">
          <h2 className="text-caption font-semibold tracking-widest text-fg-subtle uppercase">Dove siamo</h2>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="-my-1.5 flex gap-2 py-1.5 hover:underline"
          >
            <MapPin className="mt-0.5 size-4 shrink-0 text-red-400" aria-hidden />
            <span>
              {restaurant.address.street} {restaurant.address.streetNumber}
              <br />
              {restaurant.address.postalCode} {restaurant.address.city} ({restaurant.address.province})
            </span>
          </a>
          {restaurant.phone ? (
            <a href={`tel:${restaurant.phone}`} className="-my-1.5 flex gap-2 py-1.5 hover:underline">
              <Phone className="mt-0.5 size-4 shrink-0 text-red-400" aria-hidden />
              {restaurant.phone.replace(/^\+39(\d{3})(\d{3})(\d+)$/, "+39 $1 $2 $3")}
            </a>
          ) : null}
        </div>
        <div className="min-w-0 space-y-3 text-body-sm">
          <h2 className="text-caption font-semibold tracking-widest text-fg-subtle uppercase">
            Orari del locale
          </h2>
          <dl className="space-y-1">
            {venue.map((g) => (
              <div key={g.days} className="flex justify-between gap-4">
                <dt className="whitespace-nowrap text-fg-muted">{g.days}</dt>
                <dd className="text-right tabular-nums">
                  {g.ranges.split(" · ").map((range) => (
                    <span key={range} className="block whitespace-nowrap">
                      {range}
                    </span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
          <h2 className="pt-2 text-caption font-semibold tracking-widest text-fg-subtle uppercase">
            Ordini online
          </h2>
          <dl className="space-y-1">
            {ordering.map((g) => (
              <div key={g.days} className="flex justify-between gap-4">
                <dt className="whitespace-nowrap text-fg-muted">{g.days}</dt>
                <dd className="text-right tabular-nums">
                  {g.ranges.split(" · ").map((range) => (
                    <span key={range} className="block whitespace-nowrap">
                      {range}
                    </span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <nav aria-label="Informazioni" className="min-w-0 space-y-3 text-body-sm">
          <h2 className="text-caption font-semibold tracking-widest text-fg-subtle uppercase">
            Informazioni
          </h2>
          <ul className="space-y-2">
            {[
              ["/menu", "Menu"],
              ["/offerte", "Offerte"],
              ["/club", "Dimsum Club"],
              ["/info", "Il locale"],
              ["/supporto", "Assistenza"],
              ["/privacy", "Privacy"],
              ["/cookie", "Cookie"],
              ["/termini", "Termini e condizioni"],
            ].map(([href, label]) => (
              <li key={href}>
                <Link href={href!} className="text-fg-muted hover:text-fg">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="mx-auto mt-12 flex max-w-7xl flex-col gap-2 border-t border-line px-5 pt-6 text-caption text-fg-subtle md:flex-row md:justify-between lg:px-8">
        <p>
          © {restaurant.name}
          {restaurant.legal.companyName ? ` · ${restaurant.legal.companyName}` : ""}
          {restaurant.legal.vatNumber ? ` · P.IVA ${restaurant.legal.vatNumber}` : ""}
        </p>
        <p>Prezzi IVA inclusa · Pagamenti sicuri</p>
      </div>
    </footer>
  );
}
