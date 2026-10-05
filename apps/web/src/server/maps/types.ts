import type { AddressSuggestionDTO, GeocodedAddressDTO, GeoPoint } from "@dimsum/types";

export interface RouteResult {
  distanceMeters: number;
  durationSeconds: number;
  /** [lng, lat] pairs, only when requested. */
  geometry: [number, number][] | null;
}

export interface SuggestOptions {
  sessionToken?: string;
  near: GeoPoint;
}

/** Geocoding + routing provider (OpenStreetMap, Google Maps Platform or Mapbox). */
export interface GeoProvider {
  readonly name: "osm" | "google" | "mapbox";
  suggest(query: string, options: SuggestOptions): Promise<AddressSuggestionDTO[]>;
  details(id: string, sessionToken?: string): Promise<GeocodedAddressDTO | null>;
  reverse(point: GeoPoint): Promise<GeocodedAddressDTO | null>;
  route(from: GeoPoint, to: GeoPoint, options?: { geometry?: boolean }): Promise<RouteResult | null>;
}

export class GeoProviderError extends Error {
  constructor(
    readonly provider: string,
    message: string,
    readonly status?: number,
  ) {
    super(`${provider}: ${message}`);
  }
}
