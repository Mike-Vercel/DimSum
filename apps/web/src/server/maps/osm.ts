import "server-only";
import type { AddressSuggestionDTO, GeocodedAddressDTO, GeoPoint } from "@dimsum/types";
import { env } from "../env";
import { provinceCode } from "./italy";
import { GeoProviderError, type GeoProvider, type RouteResult } from "./types";

/**
 * OpenStreetMap provider: Photon (komoot) for autocomplete/reverse geocoding and OSRM for routes.
 * Free and key-less — ideal for development. Production traffic should use Google or Mapbox, or
 * self-hosted Photon/OSRM instances (PHOTON_URL / OSRM_URL), per the public servers' fair-use rules.
 */
interface PhotonProps {
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

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: PhotonProps;
}

function headers(): HeadersInit {
  const contact = env().GEO_CONTACT_EMAIL ?? "dev@localhost";
  return {
    "User-Agent": `DIMSUM-Ordering/1.0 (${contact})`,
    Accept: "application/json",
    "Accept-Language": "it",
  };
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: headers(), signal: AbortSignal.timeout(6_000), cache: "no-store" });
  if (!res.ok)
    throw new GeoProviderError("osm", `HTTP ${res.status} for ${new URL(url).pathname}`, res.status);
  return (await res.json()) as T;
}

function toAddress(f: PhotonFeature): GeocodedAddressDTO {
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

const encodeId = (a: GeocodedAddressDTO) => Buffer.from(JSON.stringify(a), "utf8").toString("base64url");
const decodeId = (id: string): GeocodedAddressDTO | null => {
  try {
    return JSON.parse(Buffer.from(id, "base64url").toString("utf8")) as GeocodedAddressDTO;
  } catch {
    return null;
  }
};

export const osmProvider: GeoProvider = {
  name: "osm",

  async suggest(query, { near }): Promise<AddressSuggestionDTO[]> {
    const e = env();
    const pad = 0.25;
    const bbox = [near.lng - pad, near.lat - pad, near.lng + pad, near.lat + pad]
      .map((n) => n.toFixed(4))
      .join(",");
    const url = `${e.PHOTON_URL}/api/?q=${encodeURIComponent(query)}&limit=8&lat=${near.lat}&lon=${near.lng}&bbox=${bbox}&location_bias_scale=0.6&zoom=14`;
    const data = await getJson<{ features: PhotonFeature[] }>(url);
    const seen = new Set<string>();
    const out: AddressSuggestionDTO[] = [];
    for (const f of data.features) {
      const a = toAddress(f);
      if (!a.street || a.country !== "IT") continue;
      const primary = `${a.street}${a.streetNumber ? ` ${a.streetNumber}` : ""}`;
      const secondary = [a.postalCode, a.city, a.province].filter(Boolean).join(" ");
      const k = `${primary}|${secondary}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ id: encodeId(a), primaryText: primary, secondaryText: secondary });
    }
    return out.slice(0, 6);
  },

  async details(id) {
    // Photon suggestions carry the full result: the id is the encoded address.
    return decodeId(id);
  },

  async reverse(point) {
    const e = env();
    const data = await getJson<{ features: PhotonFeature[] }>(
      `${e.PHOTON_URL}/reverse?lat=${point.lat}&lon=${point.lng}&limit=1&radius=0.08`,
    );
    const f = data.features[0];
    if (!f) return null;
    const a = toAddress(f);
    // Keep the exact pin the customer chose, not the snapped OSM node.
    return { ...a, location: point };
  },

  async route(from: GeoPoint, to: GeoPoint, options = {}): Promise<RouteResult | null> {
    const e = env();
    const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
    const overview = options.geometry ? "full&geometries=geojson" : "false";
    const data = await getJson<{
      code: string;
      routes: { distance: number; duration: number; geometry?: { coordinates: [number, number][] } }[];
    }>(`${e.OSRM_URL}/route/v1/driving/${coords}?overview=${overview}&alternatives=false&steps=false`);
    const r = data.code === "Ok" ? data.routes[0] : undefined;
    if (!r) return null;
    return {
      distanceMeters: Math.round(r.distance),
      durationSeconds: Math.round(r.duration),
      geometry: r.geometry?.coordinates ?? null,
    };
  },
};
