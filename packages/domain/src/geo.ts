/** Geodesic helpers (WGS84). Distances in meters, angles in degrees. */

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_371_008.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

export function isValidLatLng(p: LatLng): boolean {
  return Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
}

/** Great-circle distance (straight line). Never used alone to decide deliverability. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing from a to b, 0–360° clockwise from north. */
export function bearingDegrees(a: LatLng, b: LatLng): number {
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const Δλ = toRad(b.lng - a.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Linear interpolation, accurate enough for the few hundred meters between rider pings. */
export function interpolate(a: LatLng, b: LatLng, t: number): LatLng {
  const k = Math.min(1, Math.max(0, t));
  return { lat: a.lat + (b.lat - a.lat) * k, lng: a.lng + (b.lng - a.lng) * k };
}

/** Ray casting point-in-polygon. Polygon vertices in order; closing vertex optional. */
export function pointInPolygon(point: LatLng, polygon: readonly LatLng[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i]!;
    const pj = polygon[j]!;
    const intersects =
      pi.lat > point.lat !== pj.lat > point.lat &&
      point.lng < ((pj.lng - pi.lng) * (point.lat - pi.lat)) / (pj.lat - pi.lat) + pi.lng;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Approximate polygon area in m² (equirectangular projection around the centroid). */
export function polygonAreaSqMeters(polygon: readonly LatLng[]): number {
  if (polygon.length < 3) return 0;
  const lat0 = polygon.reduce((s, p) => s + p.lat, 0) / polygon.length;
  const kx = toRad(1) * EARTH_RADIUS_M * Math.cos(toRad(lat0));
  const ky = toRad(1) * EARTH_RADIUS_M;
  let area = 0;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[j]!;
    const b = polygon[i]!;
    area += a.lng * kx * (b.lat * ky) - b.lng * kx * (a.lat * ky);
  }
  return Math.abs(area) / 2;
}

export function boundingBox(
  points: readonly LatLng[],
): { south: number; west: number; north: number; east: number } | null {
  if (points.length === 0) return null;
  let south = Infinity;
  let west = Infinity;
  let north = -Infinity;
  let east = -Infinity;
  for (const p of points) {
    south = Math.min(south, p.lat);
    north = Math.max(north, p.lat);
    west = Math.min(west, p.lng);
    east = Math.max(east, p.lng);
  }
  return { south, west, north, east };
}

/** Coarse position for privacy-preserving displays (≈ 110 m at 3 decimals). */
export function coarsen(p: LatLng, decimals = 3): LatLng {
  const f = 10 ** decimals;
  return { lat: Math.round(p.lat * f) / f, lng: Math.round(p.lng * f) / f };
}

/**
 * Rough urban travel time when no routing provider answers: straight line × detour factor at an
 * average scooter speed. Used only as a fallback and flagged as an estimate.
 */
export function estimateUrbanTravel(
  a: LatLng,
  b: LatLng,
  options: { detourFactor?: number; speedKmh?: number } = {},
) {
  const { detourFactor = 1.35, speedKmh = 18 } = options;
  const distanceMeters = Math.round(haversineMeters(a, b) * detourFactor);
  const durationSeconds = Math.round((distanceMeters / 1000 / speedKmh) * 3600);
  return { distanceMeters, durationSeconds };
}
