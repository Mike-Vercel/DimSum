import "server-only";
import type { CatalogDTO } from "@dimsum/types";
import { appUrl } from "./env";
import type { RestaurantConfig } from "./services/restaurant";

const DAY = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** schema.org Restaurant (rich results: hours, address, map, menu). */
export function restaurantJsonLd(c: RestaurantConfig, catalog: CatalogDTO) {
  const image = catalog.categories[0]?.image?.url;
  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    "@id": appUrl("/#restaurant"),
    name: c.name,
    url: appUrl("/"),
    telephone: c.phone ?? undefined,
    image: image ? appUrl(image) : undefined,
    logo: appUrl("/icons/icon-512.png"),
    servesCuisine: ["Cinese", "Dim sum", "Street food asiatico"],
    priceRange: c.priceRange ?? "€€",
    acceptsReservations: false,
    hasMenu: appUrl("/menu"),
    address: {
      "@type": "PostalAddress",
      streetAddress: `${c.address.street} ${c.address.streetNumber}`,
      postalCode: c.address.postalCode,
      addressLocality: c.address.city,
      addressRegion: c.address.province,
      addressCountry: c.address.country,
    },
    geo: { "@type": "GeoCoordinates", latitude: c.location.lat, longitude: c.location.lng },
    openingHoursSpecification: c.hours.venue.map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: `https://schema.org/${DAY[h.weekday - 1]}`,
      opens: h.opensAt,
      closes: h.closesAt,
    })),
    potentialAction: {
      "@type": "OrderAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: appUrl("/menu"),
        actionPlatform: ["https://schema.org/DesktopWebPlatform", "https://schema.org/MobileWebPlatform"],
      },
      deliveryMethod: [
        "http://purl.org/goodrelations/v1#DeliveryModeOwnFleet",
        "http://purl.org/goodrelations/v1#DeliveryModePickUp",
      ],
    },
  };
}

/** schema.org Menu with sections and items (prices as Offers). */
export function menuJsonLd(c: RestaurantConfig, catalog: CatalogDTO) {
  return {
    "@context": "https://schema.org",
    "@type": "Menu",
    name: `Menu ${c.name}`,
    url: appUrl("/menu"),
    inLanguage: "it",
    hasMenuSection: catalog.categories.map((cat) => ({
      "@type": "MenuSection",
      name: cat.name,
      hasMenuItem: cat.productIds
        .map((id) => catalog.products[id])
        .filter((p) => p !== undefined)
        .map((p) => ({
          "@type": "MenuItem",
          name: p.name,
          description: p.description ?? undefined,
          url: appUrl(`/product/${p.slug}`),
          image: p.image ? appUrl(p.image.url) : undefined,
          suitableForDiet: p.tags.includes("VEGETARIAN") ? "https://schema.org/VegetarianDiet" : undefined,
          offers: {
            "@type": "Offer",
            price: (p.priceCents / 100).toFixed(2),
            priceCurrency: "EUR",
            availability: "https://schema.org/InStock",
          },
        })),
    })),
  };
}

/** Serializes JSON-LD safely inside a <script> tag. */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
