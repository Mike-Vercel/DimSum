import "server-only";
import type { AddressSuggestionDTO, GeocodedAddressDTO, GeoPoint } from "@dimsum/types";
import { env } from "../env";
import { provinceCode } from "./italy";
import { GeoProviderError, type GeoProvider, type RouteResult } from "./types";

/** Mapbox: Search Box API (suggest/retrieve), Geocoding v6 (reverse), Directions API. */

interface MapboxContext {
  address?: { address_number?: string; street_name?: string };
  street?: { name?: string };
  postcode?: { name?: string };
  place?: { name?: string };
  locality?: { name?: string };
  region?: { name?: string; region_code?: string };
  district?: { name?: string };
  country?: { country_code?: string };
}

function token() {
  const t = env().MAPBOX_ACCESS_TOKEN;
  if (!t) throw new GeoProviderError("mapbox", "MAPBOX_ACCESS_TOKEN missing");
  return t;
}

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(6_000), cache: "no-store" });
  if (!res.ok) throw new GeoProviderError("mapbox", `HTTP ${res.status}`, res.status);
  return (await res.json()) as T;
}

function fromContext(
  ctx: MapboxContext,
  coords: [number, number],
  formatted: string,
  id: string | null,
): GeocodedAddressDTO {
  const number = ctx.address?.address_number ?? "";
  const street = ctx.address?.street_name ?? ctx.street?.name ?? "";
  return {
    street,
    streetNumber: number,
    postalCode: ctx.postcode?.name ?? "",
    city: ctx.place?.name ?? ctx.locality?.name ?? "",
    province: provinceCode(ctx.district?.name ?? ctx.region?.name),
    country: (ctx.country?.country_code ?? "IT").toUpperCase(),
    formatted,
    location: { lat: coords[1], lng: coords[0] },
    placeId: id,
    precision: number ? "rooftop" : street ? "street" : "approximate",
  };
}

export const mapboxProvider: GeoProvider = {
  name: "mapbox",

  async suggest(query, { near, sessionToken }): Promise<AddressSuggestionDTO[]> {
    const params = new URLSearchParams({
      q: query,
      access_token: token(),
      session_token: sessionToken ?? crypto.randomUUID(),
      language: "it",
      country: "it",
      proximity: `${near.lng},${near.lat}`,
      types: "address,street",
      limit: "6",
    });
    const data = await get<{
      suggestions: { mapbox_id: string; name: string; full_address?: string; place_formatted?: string }[];
    }>(`https://api.mapbox.com/search/searchbox/v1/suggest?${params}`);
    return data.suggestions.map((s) => ({
      id: s.mapbox_id,
      primaryText: s.name,
      secondaryText: s.place_formatted ?? "",
    }));
  },

  async details(id, sessionToken) {
    const params = new URLSearchParams({
      access_token: token(),
      session_token: sessionToken ?? crypto.randomUUID(),
    });
    const data = await get<{
      features: {
        geometry: { coordinates: [number, number] };
        properties: { full_address?: string; mapbox_id: string; context: MapboxContext };
      }[];
    }>(`https://api.mapbox.com/search/searchbox/v1/retrieve/${encodeURIComponent(id)}?${params}`);
    const f = data.features[0];
    if (!f) return null;
    return fromContext(
      f.properties.context,
      f.geometry.coordinates,
      f.properties.full_address ?? "",
      f.properties.mapbox_id,
    );
  },

  async reverse(point) {
    const params = new URLSearchParams({
      longitude: String(point.lng),
      latitude: String(point.lat),
      language: "it",
      types: "address",
      access_token: token(),
    });
    const data = await get<{
      features: { properties: { full_address?: string; mapbox_id: string; context: MapboxContext } }[];
    }>(`https://api.mapbox.com/search/geocode/v6/reverse?${params}`);
    const f = data.features[0];
    if (!f) return null;
    return fromContext(
      f.properties.context,
      [point.lng, point.lat],
      f.properties.full_address ?? "",
      f.properties.mapbox_id,
    );
  },

  async route(from: GeoPoint, to: GeoPoint, options = {}): Promise<RouteResult | null> {
    const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
    const params = new URLSearchParams({
      access_token: token(),
      overview: options.geometry ? "full" : "false",
      geometries: "geojson",
    });
    const data = await get<{
      routes: { distance: number; duration: number; geometry?: { coordinates: [number, number][] } }[];
    }>(`https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?${params}`);
    const r = data.routes[0];
    if (!r) return null;
    return {
      distanceMeters: Math.round(r.distance),
      durationSeconds: Math.round(r.duration),
      geometry: r.geometry?.coordinates ?? null,
    };
  },
};
