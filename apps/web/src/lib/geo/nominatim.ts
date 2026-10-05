import type { GeocodedAddressDTO, GeoPoint } from "@dimsum/types";
import { provinceCode } from "./italy";

/**
 * Nominatim (OpenStreetMap Foundation) from the customer's device. Usage policy: explicit searches
 * only (no search-as-you-type), at most one request per second, browser Referer identifies the
 * site. https://operations.osmfoundation.org/policies/nominatim/
 */
interface NominatimAddress {
  road?: string;
  pedestrian?: string;
  square?: string;
  house_number?: string;
  postcode?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  state?: string;
  country_code?: string;
  "ISO3166-2-lvl6"?: string;
}

export interface NominatimPlace {
  lat: string;
  lon: string;
  name?: string;
  address?: NominatimAddress;
}

/** Search within the delivery area around the restaurant (about 25 km). */
export function nominatimSearchUrl(base: string, query: string, near: GeoPoint): string {
  const pad = 0.25;
  const viewbox = [near.lng - pad, near.lat + pad, near.lng + pad, near.lat - pad]
    .map((n) => n.toFixed(4))
    .join(",");
  return `${base}/search?format=jsonv2&addressdetails=1&countrycodes=it&accept-language=it&limit=8&bounded=1&viewbox=${viewbox}&q=${encodeURIComponent(query)}`;
}

export function nominatimReverseUrl(base: string, point: GeoPoint): string {
  return `${base}/reverse?format=jsonv2&addressdetails=1&accept-language=it&zoom=18&lat=${point.lat}&lon=${point.lng}`;
}

export function nominatimToAddress(place: NominatimPlace): GeocodedAddressDTO | null {
  const a = place.address ?? {};
  const street = a.road ?? a.pedestrian ?? a.square ?? "";
  if (!street) return null;
  const number = a.house_number?.split(/[;,]/)[0]?.trim() ?? "";
  const city = a.city ?? a.town ?? a.village ?? a.municipality ?? "";
  const iso = a["ISO3166-2-lvl6"];
  const province = iso?.startsWith("IT-") ? iso.slice(3) : provinceCode(a.county ?? a.state);
  return {
    street,
    streetNumber: number,
    postalCode: a.postcode ?? "",
    city,
    province,
    country: (a.country_code ?? "it").toUpperCase(),
    formatted: [
      `${street}${number ? ` ${number}` : ""}`,
      [a.postcode, city].filter(Boolean).join(" "),
      province,
    ]
      .filter(Boolean)
      .join(", "),
    location: { lat: Number(place.lat), lng: Number(place.lon) },
    placeId: null,
    precision: number ? "rooftop" : "street",
  };
}

/** Distinct street addresses, in Nominatim's order of relevance. */
export function nominatimMatches(places: NominatimPlace[], limit = 6) {
  const seen = new Set<string>();
  const out: { primaryText: string; secondaryText: string; address: GeocodedAddressDTO }[] = [];
  for (const place of places) {
    const address = nominatimToAddress(place);
    if (!address || address.country !== "IT") continue;
    const primaryText = `${address.street}${address.streetNumber ? ` ${address.streetNumber}` : ""}`;
    const secondaryText = [address.postalCode, address.city, address.province].filter(Boolean).join(" ");
    const key = `${primaryText}|${secondaryText}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ primaryText, secondaryText, address });
  }
  return out.slice(0, limit);
}
