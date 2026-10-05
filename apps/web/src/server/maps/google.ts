import "server-only";
import type { AddressSuggestionDTO, GeocodedAddressDTO, GeoPoint } from "@dimsum/types";
import { env } from "../env";
import { provinceCode } from "@/lib/geo/italy";
import { GeoProviderError, type GeoProvider, type RouteResult } from "./types";

/** Google Maps Platform: Places API (New) autocomplete/details, Geocoding API, Routes API. */

interface AddressComponent {
  longText?: string;
  shortText?: string;
  long_name?: string;
  short_name?: string;
  types: string[];
}

function key() {
  const k = env().GOOGLE_MAPS_API_KEY;
  if (!k) throw new GeoProviderError("google", "GOOGLE_MAPS_API_KEY missing");
  return k;
}

async function call<T>(url: string, init: RequestInit & { fieldMask?: string } = {}): Promise<T> {
  const { fieldMask, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key(),
      ...(fieldMask ? { "X-Goog-FieldMask": fieldMask } : {}),
      ...(rest.headers ?? {}),
    },
    signal: AbortSignal.timeout(6_000),
    cache: "no-store",
  });
  if (!res.ok)
    throw new GeoProviderError(
      "google",
      `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`,
      res.status,
    );
  return (await res.json()) as T;
}

function fromComponents(
  components: AddressComponent[],
  location: GeoPoint,
  formatted: string,
  placeId: string | null,
): GeocodedAddressDTO {
  const get = (type: string, short = false) => {
    const c = components.find((x) => x.types.includes(type));
    return (short ? (c?.shortText ?? c?.short_name) : (c?.longText ?? c?.long_name)) ?? "";
  };
  const number = get("street_number");
  const street = get("route");
  return {
    street,
    streetNumber: number,
    postalCode: get("postal_code"),
    city: get("locality") || get("administrative_area_level_3") || get("postal_town"),
    province: provinceCode(get("administrative_area_level_2", true) || get("administrative_area_level_2")),
    country: (get("country", true) || "IT").toUpperCase(),
    formatted,
    location,
    placeId,
    precision: number ? "rooftop" : street ? "street" : "approximate",
  };
}

export const googleProvider: GeoProvider = {
  name: "google",

  async suggest(query, { near, sessionToken }): Promise<AddressSuggestionDTO[]> {
    const data = await call<{
      suggestions?: {
        placePrediction?: {
          placeId: string;
          structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } };
          text?: { text: string };
        };
      }[];
    }>("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      body: JSON.stringify({
        input: query,
        sessionToken,
        languageCode: "it",
        regionCode: "it",
        includedRegionCodes: ["it"],
        locationBias: { circle: { center: { latitude: near.lat, longitude: near.lng }, radius: 25_000 } },
      }),
    });
    return (data.suggestions ?? [])
      .map((s) => s.placePrediction)
      .filter((p): p is NonNullable<typeof p> => !!p)
      .slice(0, 6)
      .map((p) => ({
        id: p.placeId,
        primaryText: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
        secondaryText: p.structuredFormat?.secondaryText?.text ?? "",
      }));
  },

  async details(id, sessionToken) {
    const params = new URLSearchParams({ languageCode: "it" });
    if (sessionToken) params.set("sessionToken", sessionToken);
    const p = await call<{
      id: string;
      formattedAddress: string;
      location: { latitude: number; longitude: number };
      addressComponents: AddressComponent[];
    }>(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}?${params}`, {
      fieldMask: "id,formattedAddress,location,addressComponents",
    });
    return fromComponents(
      p.addressComponents ?? [],
      { lat: p.location.latitude, lng: p.location.longitude },
      p.formattedAddress,
      p.id,
    );
  },

  async reverse(point) {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${point.lat},${point.lng}&language=it&result_type=street_address|premise&key=${key()}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6_000), cache: "no-store" });
    const data = (await res.json()) as {
      status: string;
      results: { formatted_address: string; place_id: string; address_components: AddressComponent[] }[];
    };
    const r = data.results[0];
    if (data.status !== "OK" || !r) return null;
    return fromComponents(r.address_components, point, r.formatted_address, r.place_id);
  },

  async route(from, to, options = {}): Promise<RouteResult | null> {
    const body = (mode: string) =>
      JSON.stringify({
        origin: { location: { latLng: { latitude: from.lat, longitude: from.lng } } },
        destination: { location: { latLng: { latitude: to.lat, longitude: to.lng } } },
        travelMode: mode,
        ...(mode === "DRIVE" ? { routingPreference: "TRAFFIC_AWARE" } : {}),
        languageCode: "it",
        units: "METRIC",
      });
    const mask = `routes.duration,routes.distanceMeters${options.geometry ? ",routes.polyline.geoJsonLinestring" : ""}`;
    const extra = options.geometry ? { polylineEncoding: "GEO_JSON_LINESTRING" } : {};
    let data: {
      routes?: {
        duration: string;
        distanceMeters: number;
        polyline?: { geoJsonLinestring?: { coordinates: [number, number][] } };
      }[];
    };
    try {
      // Scooters: TWO_WHEELER where available, otherwise driving.
      data = await call("https://routes.googleapis.com/directions/v2:computeRoutes", {
        method: "POST",
        fieldMask: mask,
        body: JSON.stringify({ ...JSON.parse(body("TWO_WHEELER")), ...extra }),
      });
      if (!data.routes?.length) throw new Error("no two-wheeler route");
    } catch {
      data = await call("https://routes.googleapis.com/directions/v2:computeRoutes", {
        method: "POST",
        fieldMask: mask,
        body: JSON.stringify({ ...JSON.parse(body("DRIVE")), ...extra }),
      });
    }
    const r = data.routes?.[0];
    if (!r) return null;
    return {
      distanceMeters: r.distanceMeters,
      durationSeconds: Number.parseInt(r.duration, 10),
      geometry: r.polyline?.geoJsonLinestring?.coordinates ?? null,
    };
  },
};
