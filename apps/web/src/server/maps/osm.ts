import "server-only";
import type { AddressSuggestionDTO, GeocodedAddressDTO, GeoPoint } from "@dimsum/types";
import {
  photonMatches,
  photonReverseAddress,
  photonReverseUrl,
  photonSuggestUrl,
  type PhotonResponse,
} from "@/lib/geo/photon";
import { env } from "../env";
import { GeoProviderError, type GeoProvider, type RouteResult } from "./types";

/**
 * OpenStreetMap provider: Photon (komoot) for autocomplete/reverse geocoding and OSRM for routes.
 * Free and key-less — ideal for development. Production traffic should use Google or Mapbox, or
 * self-hosted Photon/OSRM instances (PHOTON_URL / OSRM_URL), per the public servers' fair-use rules.
 */
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
    const data = await getJson<PhotonResponse>(photonSuggestUrl(env().PHOTON_URL, query, near));
    return photonMatches(data).map(({ primaryText, secondaryText, address }) => ({
      id: encodeId(address),
      primaryText,
      secondaryText,
    }));
  },

  async details(id) {
    // Photon suggestions carry the full result: the id is the encoded address.
    return decodeId(id);
  },

  async reverse(point) {
    const data = await getJson<PhotonResponse>(photonReverseUrl(env().PHOTON_URL, point));
    return photonReverseAddress(data, point);
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
