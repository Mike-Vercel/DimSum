import "server-only";
import { editDistance, haversineMeters, normalizeText, type LatLng } from "@dimsum/domain";
import type { AddressSuggestionDTO, GeocodedAddressDTO } from "@dimsum/types";
import json from "./street-index.json";

/**
 * Address search on our own street index (scripts/build-street-index.mjs): every named street and
 * house number of the delivery area, from OpenStreetMap. Instant, typo tolerant, and independent
 * from public geocoders, which do not answer cloud servers reliably and return shops for street
 * names. Data © OpenStreetMap contributors, ODbL 1.0.
 */

interface RawStreet {
  name: string;
  alt?: string[];
  postcode: string | null;
  city?: string;
  lines: number[][][];
}

interface Street {
  index: number;
  name: string;
  postcode: string;
  city: string;
  variants: { type: string | null; core: string[]; main: boolean }[];
  /** Points along the street, for distances and the default pin. */
  points: LatLng[];
  centre: LatLng;
}

interface HouseNumber {
  index: number;
  street: number;
  number: string;
  value: number;
  postcode: string;
  location: LatLng;
}

const TYPES = new Set([
  "via",
  "viale",
  "piazza",
  "piazzetta",
  "piazzale",
  "corso",
  "largo",
  "vicolo",
  "vico",
  "salita",
  "discesa",
  "cortile",
  "passaggio",
  "lungomare",
  "foro",
  "traversa",
  "contrada",
  "strada",
  "scalinata",
  "ronco",
  "baglio",
  "rotonda",
  "galleria",
  "molo",
  "banchina",
  "calata",
  "borgo",
  "rampa",
  "slargo",
  "spiazzo",
  "vanella",
  "sottopassaggio",
  "cavalcavia",
  "lungo",
  "circonvallazione",
  "rotatoria",
]);
const PARTICLES = new Set([
  "di",
  "del",
  "della",
  "dello",
  "dei",
  "degli",
  "delle",
  "da",
  "dal",
  "dalla",
  "d",
  "l",
  "e",
  "de",
  "la",
  "lo",
  "il",
  "le",
  "gli",
  "al",
  "alla",
  "allo",
  "ai",
  "agli",
  "alle",
  "san",
  "sant",
  "santa",
  "santo",
]);
const PLACE_WORDS = new Set(["palermo", "pa", "italia", "italy"]);

/** Common Italian abbreviations: "p.zza", "v.le", "c.so", "l.go", "v. roma". */
function expand(text: string): string {
  return text
    .toLowerCase()
    .replace(/\bp\.?\s?zz?a\b/g, "piazza")
    .replace(/\bp\.?\s?tta\b/g, "piazzetta")
    .replace(/\bv\.?\s?le\b/g, "viale")
    .replace(/\bc\.?\s?so\b/g, "corso")
    .replace(/\bl\.?\s?go\b/g, "largo")
    .replace(/\bv\.?\s?lo\b/g, "vicolo")
    .replace(/(^|\s)v\.?(?=\s)/g, "$1via")
    .replace(/(^|\s)s\.\s?/g, "$1san ");
}

function parseName(name: string, main: boolean) {
  const tokens = normalizeText(expand(name)).split(" ").filter(Boolean);
  const type = tokens[0] && TYPES.has(tokens[0]) ? tokens[0] : null;
  const core = (type ? tokens.slice(1) : tokens).filter((t) => !PARTICLES.has(t));
  return { type, core: core.length ? core : tokens, main };
}

const data = json as unknown as {
  streets: RawStreet[];
  numbers: [street: number, number: string, postcode: string | null, lat: number, lng: number][];
};

const toPoint = ([lat, lng]: number[]): LatLng => ({ lat: lat!, lng: lng! });

let built: { streets: Street[]; numbers: HouseNumber[]; byStreet: Map<number, HouseNumber[]> } | null = null;

function index() {
  if (built) return built;
  const raw = data;
  const numbers = raw.numbers.map(([street, number, postcode, lat, lng], i): HouseNumber => ({
    index: i,
    street,
    number,
    value: Number.parseInt(number, 10),
    postcode: postcode ?? raw.streets[street]?.postcode ?? "",
    location: { lat, lng },
  }));
  const byStreet = new Map<number, HouseNumber[]>();
  for (const n of numbers) byStreet.set(n.street, [...(byStreet.get(n.street) ?? []), n]);
  const streets = raw.streets.map((s, i): Street => {
    const points = s.lines.flat().map(toPoint);
    const mean = {
      lat: points.reduce((a, p) => a + p.lat, 0) / points.length,
      lng: points.reduce((a, p) => a + p.lng, 0) / points.length,
    };
    // The point of the street closest to its mean: always on the street, even when it curves.
    const centre = points.reduce((best, p) =>
      haversineMeters(p, mean) < haversineMeters(best, mean) ? p : best,
    );
    return {
      index: i,
      name: s.name,
      postcode: s.postcode ?? "",
      city: s.city ?? "Palermo",
      variants: [parseName(s.name, true), ...(s.alt ?? []).map((a) => parseName(a, false))],
      points,
      centre,
    };
  });
  built = { streets, numbers, byStreet };
  return built;
}

/** "via ruggero settimo 20, palermo" → street words and house number "20" ("12/B", "7A"). */
function parseQuery(query: string) {
  const head = expand(query.split(",")[0] ?? "").trim();
  const match = head.match(/(?:^|\s)(?:n\.?\s?|nr\.?\s?|civico\s)?(\d{1,4})\s*(?:\/\s*)?([a-z])?$/i);
  const number =
    match && head.slice(0, match.index).trim() ? `${match[1]}${match[2] ?? ""}`.toUpperCase() : null;
  const words = normalizeText(number && match ? head.slice(0, match.index) : head)
    .split(" ")
    .filter((t) => t && !PLACE_WORDS.has(t) && !/^\d{5}$/.test(t));
  const type = words[0] && TYPES.has(words[0]) ? words[0] : null;
  const core = (type ? words.slice(1) : words).filter((t) => !PARTICLES.has(t));
  return { type, core, number };
}

/** Penalty of a query word against the street words (Infinity = no match). */
function wordPenalty(q: string, words: string[], last: boolean): number {
  let best = Infinity;
  for (const w of words) {
    if (w === q) return 0;
    if (w.startsWith(q) && (q.length >= 2 || last)) best = Math.min(best, 0.3);
    // One typo from 4 letters, two from 8: "setimo" finds Settimo, "adragna" is not Aragona.
    const allowed = q.length >= 8 ? 2 : q.length >= 4 ? 1 : 0;
    if (allowed) {
      const d = Math.min(editDistance(q, w, allowed), editDistance(q, w.slice(0, q.length), allowed));
      if (d <= allowed) best = Math.min(best, 1 + d);
    }
  }
  return best;
}

const formatted = (a: Omit<GeocodedAddressDTO, "formatted">) =>
  [
    `${a.street}${a.streetNumber ? ` ${a.streetNumber}` : ""}`,
    [a.postalCode, a.city].filter(Boolean).join(" "),
    a.province,
  ]
    .filter(Boolean)
    .join(", ");

function address(
  s: Street,
  streetNumber: string,
  postcode: string,
  location: LatLng,
  precision: GeocodedAddressDTO["precision"],
): GeocodedAddressDTO {
  const a = {
    street: s.name,
    streetNumber,
    postalCode: postcode,
    city: s.city,
    province: "PA",
    country: "IT",
    location,
    placeId: null,
    precision,
  };
  return { ...a, formatted: formatted(a) };
}

/** A house number missing from the map: between its known neighbours on the same side of the street. */
function estimate(s: Street, number: string): LatLng {
  const value = Number.parseInt(number, 10);
  const known = (index().byStreet.get(s.index) ?? []).filter((n) => Number.isFinite(n.value));
  const side = known.filter((n) => n.value % 2 === value % 2);
  const pool = side.length ? side : known;
  if (!pool.length) return s.centre;
  const below = pool.filter((n) => n.value <= value).sort((a, b) => b.value - a.value)[0];
  const above = pool.filter((n) => n.value >= value).sort((a, b) => a.value - b.value)[0];
  if (below && above && above.value !== below.value) {
    const t = (value - below.value) / (above.value - below.value);
    return {
      lat: below.location.lat + (above.location.lat - below.location.lat) * t,
      lng: below.location.lng + (above.location.lng - below.location.lng) * t,
    };
  }
  return (below ?? above)!.location;
}

export function streetIndexAvailable(): boolean {
  return index().streets.length > 0;
}

export function searchStreets(query: string, near: LatLng, limit = 6): AddressSuggestionDTO[] {
  const { streets, byStreet } = index();
  const q = parseQuery(query);
  if (!q.core.length) return [];
  const scored: { street: Street; score: number }[] = [];
  for (const s of streets) {
    let best = -Infinity;
    for (const v of s.variants) {
      let penalty = 0;
      q.core.forEach((word, i) => {
        penalty += wordPenalty(word, v.core, i === q.core.length - 1);
      });
      if (!Number.isFinite(penalty)) continue;
      let score = 100 - penalty * 10 - Math.max(0, v.core.length - q.core.length) * 2;
      if (q.type) score += q.type === v.type ? 8 : -12;
      // Names are typed from the start: "via ruggero" means Ruggero Settimo before Conte Ruggero.
      if (v.core[0]?.startsWith(q.core[0]!)) score += 5;
      if (v.main) score += 1;
      best = Math.max(best, score);
    }
    if (best === -Infinity) continue;
    if (q.number && byStreet.get(s.index)?.some((n) => n.number === q.number)) best += 6;
    best -= (haversineMeters(near, s.centre) / 1000) * 1.5;
    scored.push({ street: s, score: best });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(({ street: s }) => {
    const exact = q.number ? byStreet.get(s.index)?.find((n) => n.number === q.number) : undefined;
    const postcode = exact?.postcode || s.postcode;
    return {
      id: exact ? `n:${exact.index}` : q.number ? `s:${s.index}:${q.number}` : `s:${s.index}`,
      primaryText: `${s.name}${q.number ? ` ${q.number}` : ""}`,
      secondaryText: [postcode, s.city, "PA"].filter(Boolean).join(" "),
    };
  });
}

export function streetAddress(id: string): GeocodedAddressDTO | null {
  const { streets, numbers } = index();
  const [kind, a, b] = id.split(":");
  if (kind === "n") {
    const n = numbers[Number(a)];
    const s = n && streets[n.street];
    return n && s ? address(s, n.number, n.postcode || s.postcode, n.location, "rooftop") : null;
  }
  const s = kind === "s" ? streets[Number(a)] : undefined;
  if (!s) return null;
  if (b) return address(s, b, s.postcode, estimate(s, b), "street");
  return address(s, "", s.postcode, s.centre, "street");
}

/** Distance in metres from p to the segment a–b (local flat projection, fine at street scale). */
function segmentDistance(p: LatLng, a: LatLng, b: LatLng): number {
  const k = Math.cos((p.lat * Math.PI) / 180);
  const [ax, ay, bx, by, px, py] = [a.lng * k, a.lat, b.lng * k, b.lat, p.lng * k, p.lat];
  const dx = bx - ax;
  const dy = by - ay;
  const t = dx || dy ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy)) * 111_320;
}

/** The address at a point: the house number within 30 m, otherwise the street within 120 m. */
export function streetAt(point: LatLng): GeocodedAddressDTO | null {
  const { streets, numbers } = index();
  let nearestNumber: HouseNumber | null = null;
  let numberDistance = Infinity;
  for (const n of numbers) {
    const d = haversineMeters(point, n.location);
    if (d < numberDistance) [nearestNumber, numberDistance] = [n, d];
  }
  if (nearestNumber && numberDistance <= 30) {
    const s = streets[nearestNumber.street]!;
    return address(s, nearestNumber.number, nearestNumber.postcode || s.postcode, point, "rooftop");
  }
  let nearestStreet: Street | null = null;
  let streetDistance = Infinity;
  const raw = data.streets;
  streets.forEach((s, i) => {
    for (const line of raw[i]!.lines) {
      for (let j = 0; j < line.length; j++) {
        const a = toPoint(line[j]!);
        const d =
          line.length === 1
            ? haversineMeters(point, a)
            : j
              ? segmentDistance(point, toPoint(line[j - 1]!), a)
              : Infinity;
        if (d < streetDistance) [nearestStreet, streetDistance] = [s, d];
      }
    }
  });
  if (!nearestStreet || streetDistance > 120) return null;
  const s: Street = nearestStreet;
  const postcode = s.postcode || (nearestNumber && numberDistance < 400 ? nearestNumber.postcode : "");
  return address(s, "", postcode, point, "street");
}
