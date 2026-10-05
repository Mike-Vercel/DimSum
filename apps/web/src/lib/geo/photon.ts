import type { GeocodedAddressDTO, GeoPoint } from "@dimsum/types";
import { provinceCode } from "./italy";

/**
 * Photon (komoot): OpenStreetMap geocoding. Shared by the server provider and the address search
 * that runs on the customer's device (the public instance does not answer cloud servers).
 */
export interface PhotonProps {
  name?: string;
  housenumber?: string;
  street?: string;
  postcode?: string;
  city?: string;
  town?: string;
  village?: string;
  district?: string;
  county?: string;
  state?: string;
  countrycode?: string;
  type?: string;
  osm_key?: string;
}

export interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: PhotonProps;
}

export interface PhotonResponse {
  features: PhotonFeature[];
}

export function photonSuggestUrl(base: string, query: string, near: GeoPoint): string {
  const pad = 0.25;
  const bbox = [near.lng - pad, near.lat - pad, near.lng + pad, near.lat + pad]
    .map((n) => n.toFixed(4))
    .join(",");
  return `${base}/api/?q=${encodeURIComponent(query)}&limit=8&lat=${near.lat}&lon=${near.lng}&bbox=${bbox}&location_bias_scale=0.6&zoom=14`;
}

export function photonReverseUrl(base: string, point: GeoPoint): string {
  return `${base}/reverse?lat=${point.lat}&lon=${point.lng}&limit=1&radius=0.08`;
}

export function photonToAddress(f: PhotonFeature): GeocodedAddressDTO {
  const p = f.properties;
  const [lng, lat] = f.geometry.coordinates;
  const street = p.street ?? (p.osm_key === "highway" ? (p.name ?? "") : "");
  const city = p.city ?? p.town ?? p.village ?? "";
  const number = p.housenumber ?? "";
  const precision: GeocodedAddressDTO["precision"] = number ? "rooftop" : street ? "street" : "approximate";
  const province = provinceCode(p.county ?? p.state);
  return {
    street: street || p.name || "",
    streetNumber: number,
    postalCode: p.postcode ?? "",
    city,
    province,
    country: (p.countrycode ?? "IT").toUpperCase(),
    formatted: [
      street ? `${street}${number ? ` ${number}` : ""}` : p.name,
      [p.postcode, city].filter(Boolean).join(" "),
      province,
    ]
      .filter(Boolean)
      .join(", "),
    location: { lat, lng },
    placeId: null,
    precision,
  };
}

export interface PhotonMatch {
  primaryText: string;
  secondaryText: string;
  address: GeocodedAddressDTO;
}

/** Distinct Italian street addresses, in Photon's order. */
export function photonMatches(data: PhotonResponse, limit = 6): PhotonMatch[] {
  const seen = new Set<string>();
  const out: PhotonMatch[] = [];
  for (const f of data.features) {
    const address = photonToAddress(f);
    if (!address.street || address.country !== "IT") continue;
    const primaryText = `${address.street}${address.streetNumber ? ` ${address.streetNumber}` : ""}`;
    const secondaryText = [address.postalCode, address.city, address.province].filter(Boolean).join(" ");
    const key = `${primaryText}|${secondaryText}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ primaryText, secondaryText, address });
  }
  return out.slice(0, limit);
}

/** The pin the customer chose wins over the snapped OpenStreetMap node. */
export function photonReverseAddress(data: PhotonResponse, point: GeoPoint): GeocodedAddressDTO | null {
  const f = data.features[0];
  return f ? { ...photonToAddress(f), location: point } : null;
}
