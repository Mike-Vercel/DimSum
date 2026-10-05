#!/usr/bin/env node
/**
 * Builds the street index used by the address search: every named street and every house number
 * inside the delivery area (plus a margin), from OpenStreetMap via the Overpass API. The result is
 * committed as src/server/maps/street-index.json, so searching never depends on an external
 * service at runtime. Data © OpenStreetMap contributors, ODbL 1.0.
 *
 *   node apps/web/scripts/build-street-index.mjs                  # area from the delivery zones
 *   node apps/web/scripts/build-street-index.mjs --bbox=s,w,n,e   # explicit area
 *
 * Re-run it whenever the delivery zones grow beyond the indexed area.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = path.resolve(web, "../..");
const OUT = path.join(web, "src/server/maps/street-index.json");
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];
const MARGIN_METERS = 1500;

function zonesBbox() {
  const catalog = JSON.parse(
    fs.readFileSync(path.join(root, "packages/db/data/brenvo/catalog.json"), "utf8"),
  );
  const points = [];
  for (const z of catalog.deliveryZones) {
    if (z.polygon) points.push(...z.polygon);
    if (z.center) {
      const dLat = (z.radiusMeters ?? 0) / 111_320;
      const dLng = dLat / Math.cos((z.center.lat * Math.PI) / 180);
      points.push({ lat: z.center.lat - dLat, lng: z.center.lng - dLng });
      points.push({ lat: z.center.lat + dLat, lng: z.center.lng + dLng });
    }
  }
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const mLat = MARGIN_METERS / 111_320;
  const mLng = mLat / Math.cos((((Math.min(...lats) + Math.max(...lats)) / 2) * Math.PI) / 180);
  return [
    Math.min(...lats) - mLat,
    Math.min(...lngs) - mLng,
    Math.max(...lats) + mLat,
    Math.max(...lngs) + mLng,
  ];
}

const arg = process.argv.find((a) => a.startsWith("--bbox="));
const bbox = (arg ? arg.slice(7).split(",").map(Number) : zonesBbox()).map((n) => Number(n.toFixed(4)));
const area = bbox.join(",");

async function overpass(query) {
  for (const url of ENDPOINTS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "DIMSUM-Ordering/1.0 (street index)",
          },
          body: new URLSearchParams({ data: query }),
          signal: AbortSignal.timeout(180_000),
        });
        const text = await res.text();
        if (res.ok && text.startsWith("{")) return JSON.parse(text);
        console.warn(`[streets] ${url} → HTTP ${res.status}, retry`);
      } catch (error) {
        console.warn(`[streets] ${url} → ${error.message}, retry`);
      }
      await new Promise((r) => setTimeout(r, 5_000 * attempt));
    }
  }
  throw new Error("Overpass non disponibile: riprova più tardi.");
}

const SKIP_HIGHWAYS = new Set([
  "platform",
  "bus_stop",
  "elevator",
  "corridor",
  "proposed",
  "construction",
  "raceway",
]);
const round = (n) => Math.round(n * 1e5) / 1e5;

console.log(`[streets] area ${area}`);
const ways = await overpass(`[out:json][timeout:170];way["highway"]["name"](${area});out tags geom;`);
const houses = await overpass(
  `[out:json][timeout:170];nwr["addr:housenumber"]["addr:street"](${area});out tags center;`,
);

/** @type {Map<string, {name: string, alt: Set<string>, postcodes: Map<string, number>, cities: Map<string, number>, lines: number[][][]}>} */
const streets = new Map();
const street = (name) => {
  let s = streets.get(name);
  if (!s)
    streets.set(name, (s = { name, alt: new Set(), postcodes: new Map(), cities: new Map(), lines: [] }));
  return s;
};
const count = (map, key) => key && map.set(key, (map.get(key) ?? 0) + 1);

for (const w of ways.elements) {
  if (SKIP_HIGHWAYS.has(w.tags.highway) || !w.geometry?.length) continue;
  const s = street(w.tags.name.trim());
  for (const k of ["alt_name", "old_name", "official_name", "loc_name", "short_name"]) {
    for (const n of (w.tags[k] ?? "").split(";")) if (n.trim() && n.trim() !== s.name) s.alt.add(n.trim());
  }
  count(s.postcodes, w.tags["addr:postcode"] ?? w.tags.postal_code);
  const line = [];
  for (const p of w.geometry) {
    const point = [round(p.lat), round(p.lon)];
    const last = line.at(-1);
    if (!last || last[0] !== point[0] || last[1] !== point[1]) line.push(point);
  }
  s.lines.push(line);
}

const numbers = [];
for (const h of houses.elements) {
  const lat = h.lat ?? h.center?.lat;
  const lng = h.lon ?? h.center?.lon;
  if (lat == null) continue;
  const s = street(h.tags["addr:street"].trim());
  // House numbers on a street missing from the ways still make it searchable.
  if (!s.lines.length) s.lines.push([[round(lat), round(lng)]]);
  count(s.postcodes, h.tags["addr:postcode"]);
  count(s.cities, h.tags["addr:city"]);
  for (const n of h.tags["addr:housenumber"].split(/[;,]/)) {
    const number = n.trim().toUpperCase().replace(/\s+/g, "");
    if (number)
      numbers.push({
        name: s.name,
        number,
        postcode: h.tags["addr:postcode"] ?? null,
        lat: round(lat),
        lng: round(lng),
      });
  }
}

const top = (map) => [...map.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
const list = [...streets.values()].sort((a, b) => a.name.localeCompare(b.name, "it"));
const index = new Map(list.map((s, i) => [s.name, i]));
const withPostcode = numbers.filter((n) => n.postcode);

// Streets without their own postcode take the one of the nearest house number.
const near = (line) => {
  const [lat, lng] = line[Math.floor(line.length / 2)];
  let best = null;
  let bestD = Infinity;
  for (const n of withPostcode) {
    const d = (n.lat - lat) ** 2 + ((n.lng - lng) * Math.cos((lat * Math.PI) / 180)) ** 2;
    if (d < bestD) [best, bestD] = [n.postcode, d];
  }
  return Math.sqrt(bestD) * 111_320 < 600 ? best : null;
};

const out = {
  v: 1,
  source: {
    provider: "OpenStreetMap",
    license: "ODbL 1.0",
    attribution: "© OpenStreetMap contributors",
    fetchedAt: new Date().toISOString(),
    bbox,
  },
  streets: list.map((s) => ({
    name: s.name,
    ...(s.alt.size ? { alt: [...s.alt] } : {}),
    postcode: top(s.postcodes) ?? near(s.lines[0]),
    ...(top(s.cities) && top(s.cities) !== "Palermo" ? { city: top(s.cities) } : {}),
    lines: s.lines,
  })),
  numbers: numbers.map((n) => [index.get(n.name), n.number, n.postcode, n.lat, n.lng]),
};

fs.writeFileSync(OUT, `${JSON.stringify(out)}\n`);
const kb = Math.round(fs.statSync(OUT).size / 1024);
console.log(
  `[streets] ${out.streets.length} vie, ${out.numbers.length} civici → ${path.relative(root, OUT)} (${kb} KB)`,
);
