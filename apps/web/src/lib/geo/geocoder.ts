"use client";

import type { AddressSuggestionDTO, GeocodedAddressDTO, GeoPoint } from "@dimsum/types";
import type { RestaurantInfo } from "@/components/shop/restaurant-context";
import { api } from "@/lib/api";
import {
  nominatimMatches,
  nominatimReverseUrl,
  nominatimSearchUrl,
  nominatimToAddress,
  type NominatimPlace,
} from "./nominatim";

/** Address search for the address picker, wherever it runs (device or server). */
export interface Geocoder {
  /** Suggestions while typing; otherwise the customer submits the search ("Cerca"). */
  autocomplete: boolean;
  suggest(query: string, session: string, signal?: AbortSignal): Promise<AddressSuggestionDTO[]>;
  details(id: string, session: string): Promise<GeocodedAddressDTO>;
  reverse(point: GeoPoint): Promise<GeocodedAddressDTO | null>;
}

/** Customer-facing failure, worded like the server's own errors. */
export class GeocodingError extends Error {}

const TIMEOUT_MS = 8_000;
const MIN_INTERVAL_MS = 1_000;
let nextSlot = 0;

function withTimeout(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  return signal && typeof AbortSignal.any === "function"
    ? AbortSignal.any([signal, timeout])
    : (signal ?? timeout);
}

/** At most one request per second from this device, as the Nominatim usage policy asks. */
async function nominatim<T>(url: string, signal?: AbortSignal): Promise<T> {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + MIN_INTERVAL_MS;
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
  const res = await fetch(url, { signal: withTimeout(signal), headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
  return (await res.json()) as T;
}

/**
 * OpenStreetMap search from the customer's device: the free public services do not answer cloud
 * servers reliably. Suggestions carry the whole address, so "details" needs no call.
 */
function deviceGeocoder(base: string, near: GeoPoint): Geocoder {
  const found = new Map<string, GeocodedAddressDTO>();
  return {
    autocomplete: false,
    async suggest(query, _session, signal) {
      let places: NominatimPlace[];
      try {
        places = await nominatim<NominatimPlace[]>(nominatimSearchUrl(base, query, near), signal);
      } catch (error) {
        if (signal?.aborted) throw error;
        throw new GeocodingError("La ricerca degli indirizzi non risponde. Riprova o usa la tua posizione.");
      }
      return nominatimMatches(places).map(({ primaryText, secondaryText, address }) => {
        const id = `${address.location.lat},${address.location.lng}|${primaryText}|${secondaryText}`;
        found.set(id, address);
        return { id, primaryText, secondaryText };
      });
    },
    async details(id) {
      const address = found.get(id);
      if (!address) throw new GeocodingError("Indirizzo non trovato. Cercalo di nuovo.");
      return address;
    },
    async reverse(point) {
      try {
        const place = await nominatim<NominatimPlace & { error?: string }>(nominatimReverseUrl(base, point));
        const address = place.error ? null : nominatimToAddress(place);
        // The pin the customer chose wins over the snapped OpenStreetMap node.
        return address ? { ...address, location: point } : null;
      } catch {
        throw new GeocodingError(
          "Non riusciamo a trovare l'indirizzo di questa posizione. Inseriscilo a mano.",
        );
      }
    },
  };
}

const serverGeocoder: Geocoder = {
  autocomplete: true,
  suggest: async (query, session, signal) => (await api.geo.suggest(query, session, signal)).suggestions,
  details: async (id, session) => (await api.geo.details(id, session)).address,
  reverse: async (point) => (await api.geo.reverse(point.lat, point.lng)).address,
};

export function createGeocoder(restaurant: Pick<RestaurantInfo, "geocoding" | "location">): Geocoder {
  const { mode, nominatimUrl } = restaurant.geocoding;
  return mode === "device" && nominatimUrl
    ? deviceGeocoder(nominatimUrl, restaurant.location)
    : serverGeocoder;
}
