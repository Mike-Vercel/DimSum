import "server-only";
import { createHash } from "node:crypto";
import { estimateUrbanTravel, type RouteInfo } from "@dimsum/domain";
import type { AddressSuggestionDTO, GeocodedAddressDTO, GeoPoint } from "@dimsum/types";
import { db, Prisma } from "../db";
import { features } from "../env";
import { logger } from "../logger";
import { googleProvider } from "./google";
import { mapboxProvider } from "./mapbox";
import { osmProvider } from "./osm";
import { searchStreets, streetAddress, streetAt, streetIndexAvailable } from "./street-index";
import type { GeoProvider, RouteResult } from "./types";

/** OpenStreetMap: addresses come from our own street index of the delivery area (instant, no third party). */
const localStreets = () => features().mapsProvider === "osm" && streetIndexAvailable();

export function geoProvider(): GeoProvider {
  const p = features().mapsProvider;
  return p === "google" ? googleProvider : p === "mapbox" ? mapboxProvider : osmProvider;
}

const HOUR = 3600_000;

async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const id = createHash("sha256").update(key).digest("base64url");
  try {
    const hit = await db.geoCache.findUnique({ where: { key: id } });
    if (hit && hit.expiresAt > new Date()) return hit.value as T;
  } catch (error) {
    logger.warn("geo cache read failed", { error });
  }
  const value = await load();
  if (value !== null && value !== undefined) {
    const expiresAt = new Date(Date.now() + ttlMs);
    await db.geoCache
      .upsert({
        where: { key: id },
        create: { key: id, value: value as Prisma.InputJsonValue, expiresAt },
        update: { value: value as Prisma.InputJsonValue, expiresAt },
      })
      .catch((error: unknown) => logger.warn("geo cache write failed", { error }));
  }
  return value;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

export async function suggestAddresses(
  query: string,
  near: GeoPoint,
  sessionToken?: string,
): Promise<AddressSuggestionDTO[]> {
  if (localStreets()) return searchStreets(query, near);
  const p = geoProvider();
  return cached(
    `${p.name}:suggest:${norm(query)}:${round(near.lat, 2)},${round(near.lng, 2)}`,
    7 * 24 * HOUR,
    () => p.suggest(query, { near, ...(sessionToken ? { sessionToken } : {}) }),
  );
}

export async function placeDetails(id: string, sessionToken?: string): Promise<GeocodedAddressDTO | null> {
  if (localStreets()) return streetAddress(id);
  const p = geoProvider();
  return cached(`${p.name}:details:${id}`, 30 * 24 * HOUR, () => p.details(id, sessionToken));
}

export async function reverseGeocode(point: GeoPoint): Promise<GeocodedAddressDTO | null> {
  if (localStreets()) return streetAt(point);
  const p = geoProvider();
  const key = `${p.name}:reverse:${round(point.lat, 5)},${round(point.lng, 5)}`;
  const result = await cached(key, 30 * 24 * HOUR, () => p.reverse(point));
  return result ? { ...result, location: point } : null;
}

/**
 * Real route between two points. Falls back to a conservative urban estimate (flagged as such)
 * when the routing provider is unreachable, so ordering never stops because of a third party.
 */
export async function routeBetween(
  from: GeoPoint,
  to: GeoPoint,
  options: { geometry?: boolean } = {},
): Promise<RouteInfo & { geometry: RouteResult["geometry"] }> {
  const p = geoProvider();
  const key = `${p.name}:route:${round(from.lat, 4)},${round(from.lng, 4)}>${round(to.lat, 4)},${round(to.lng, 4)}:${options.geometry ? "g" : "n"}`;
  try {
    const r = await cached(key, 6 * HOUR, () => p.route(from, to, options));
    if (r)
      return {
        distanceMeters: r.distanceMeters,
        durationSeconds: r.durationSeconds,
        source: "routing",
        geometry: r.geometry,
      };
  } catch (error) {
    logger.warn("routing provider failed, using estimate", { error, provider: p.name });
  }
  return { ...estimateUrbanTravel(from, to), source: "estimate", geometry: null };
}

export async function purgeGeoCache(): Promise<number> {
  const { count } = await db.geoCache.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return count;
}
