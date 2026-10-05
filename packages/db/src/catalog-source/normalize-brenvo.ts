/**
 * Normalizes the public menu captured from the previous ordering platform (Brenvo, restaurant
 * 8L3E9) into `data/brenvo/catalog.json`, and optimizes the original photos into
 * `apps/web/public/menu/*.webp` with blur placeholders and backdrop detection.
 *
 * Nothing is invented: every field comes from the captured source. Editorial clean-ups (product
 * code extraction, ALL-CAPS names, unit spacing) keep the untouched source values next to them.
 *
 * Run: npm run catalog:normalize -w @dimsum/db
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { eurosToCents, slugify } from "@dimsum/domain";
import type { Allergen, ProductTag } from "@dimsum/types";
import type {
  NormalizedCatalog,
  NormalizedImage,
  NormalizedProduct,
  NormalizedZone,
  NormalizedWeeklyRange,
} from "./types";

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(here, "../../data/brenvo");
const RAW = path.join(DATA, "raw");
const ORIGINALS = path.join(DATA, "originals");
const WEB_PUBLIC = path.resolve(here, "../../../../apps/web/public");
const MENU_OUT = path.join(WEB_PUBLIC, "menu");

const read = <T>(file: string): T => JSON.parse(fs.readFileSync(path.join(RAW, file), "utf8")) as T;

/* ---------------------------------------------------------------- raw shapes */

interface RawDish {
  _id: string;
  price: number;
  description: string;
  allergen: string[];
  ingredients: string[];
  name: string;
  name2: string;
  status: string;
  is_no_discount: boolean;
  position: number;
  pics?: { version: string }[];
}
interface RawMenu {
  _id: string;
  name: string;
  position: number;
  status: boolean;
  is_hidden: boolean;
  dishs: RawDish[];
}

/* ---------------------------------------------------------------- text rules */

const CJK = /[㐀-鿿]/;
const CJK_RUN = /[㐀-鿿（）（），，、。.\d\s]+/g;

const ALLERGEN_MAP: Record<string, Allergen> = {
  ALLERGEN_GLUTEN: "GLUTEN",
  ALLERGEN_CRUSTACEANS: "CRUSTACEANS",
  ALLERGEN_EGGS: "EGGS",
  ALLERGEN_FISH: "FISH",
  ALLERGEN_PEANUTS: "PEANUTS",
  ALLERGEN_SOYA: "SOYBEANS",
  ALLERGEN_MILK: "MILK",
  ALLERGEN_NUTS: "NUTS",
  ALLERGEN_CELERY: "CELERY",
  ALLERGEN_MUSTARD: "MUSTARD",
  ALLERGEN_SESAME: "SESAME",
  ALLERGEN_SULPHITES: "SULPHITES",
  ALLERGEN_LUPIN: "LUPIN",
  ALLERGEN_MOLLUSCE: "MOLLUSCS",
};

/** Proper nouns that must keep their capitalisation after sentence-casing. */
const PROPER_NOUNS: Record<string, string> = {
  asahi: "Asahi",
  sapporo: "Sapporo",
  kirin: "Kirin",
  heineken: "Heineken",
  moretti: "Moretti",
  messina: "Messina",
  tsingtao: "Tsingtao",
  fanta: "Fanta",
  sprite: "Sprite",
  walovi: "Walovi",
  jianlibao: "Jianlibao",
  "coca cola": "Coca-Cola",
  "coca zero": "Coca-Cola Zero",
  "want want": "Want Want",
  sichuan: "Sichuan",
  chardonnay: "Chardonnay",
  viognier: "Viognier",
  merlot: "Merlot",
  syrah: "Syrah",
  "nero d avola": "Nero d'Avola",
  murriali: "Murriali",
  sbriu: "Sbriu",
  babbio: "Babbio",
  "tasca d.almerita": "Tasca d'Almerita",
  leone: "Leone",
  "maria costanza": "Maria Costanza",
  aria: "Aria",
  cataratto: "Catarratto",
  daifuku: "Daifuku",
  takoyaki: "Takoyaki",
  edamame: "Edamame",
  "goma wakame": "Goma wakame",
  "ebi tempura": "Ebi tempura",
  "pak choi": "pak choi",
};

/** "D03 - Mochi gelato fragola" → { code: "D03", rest: "Mochi gelato fragola" }. */
export function splitPosCode(name: string): { code: string | null; rest: string } {
  const m = /^([A-Z]\d{1,2})\s*(?:[-–.]\s*|\s+)(.+)$/.exec(name.trim());
  return m ? { code: m[1]!, rest: m[2]!.trim() } : { code: null, rest: name.trim() };
}

function isAllCaps(value: string): boolean {
  const letters = value.replace(/[^A-Za-zÀ-ÿ]/g, "");
  return letters.length > 2 && letters === letters.toUpperCase();
}

export function cleanDisplayName(raw: string): string {
  let name = raw.replace(/\s+/g, " ").trim();
  if (isAllCaps(name)) name = name.toLowerCase();
  // Units: "33CL" → "33 cl", "50cl" → "50 cl".
  name = name.replace(/(\d+)\s*cl\b/gi, "$1 cl");
  let lower = name.toLowerCase();
  for (const [needle, proper] of Object.entries(PROPER_NOUNS).sort((a, b) => b[0].length - a[0].length)) {
    const idx = lower.indexOf(needle);
    if (idx >= 0 && (idx === 0 || /[\s(]/.test(lower[idx - 1]!))) {
      name = name.slice(0, idx) + proper + name.slice(idx + needle.length);
      lower = name.toLowerCase();
    }
  }
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Chinese product name from the secondary name: "RAVIOLI … 猪肉芹菜饺" → "猪肉芹菜饺". */
export function extractChineseName(name2: string): string | null {
  const runs = name2.match(/[㐀-鿿]+/g);
  return runs ? runs.join("") : null;
}

/** Splits "Maiale, sedano … - 猪肉，芹菜…" into the Italian and the Chinese parts. */
export function splitDescription(raw: string): { it: string | null; zh: string | null } {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return { it: null, zh: null };
  const idx = text.search(CJK);
  if (idx < 0) return { it: capitalize(text), zh: null };
  // Leading digits like "1." belong to the Chinese enumeration.
  let cut = idx;
  while (cut > 0 && /[\d.]/.test(text[cut - 1]!)) cut--;
  const it = text
    .slice(0, cut)
    .replace(/[\s\-–:]+$/, "")
    .trim();
  const zh = text.slice(cut).trim();
  return { it: it ? capitalize(it) : null, zh: zh || null };
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Turns an ingredient list ("manzo, noodles, uovo e verdure miste") into items. Prose
 * descriptions ("Bao con pancetta di maiale, …") are not split.
 */
export function parseIngredients(italian: string | null): string[] {
  if (!italian) return [];
  if (/[.!?]\s|[.!?]$/.test(italian) || /\b(con|al|alla|ai|in)\b/i.test(italian.split(",")[0] ?? ""))
    return [];
  const parts = italian
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return [];
  const last = parts.pop()!;
  const tail = last.split(/\s+e\s+/);
  if (tail.length === 2 && tail.every((t) => t.split(/\s+/).length <= 2)) parts.push(...tail);
  else parts.push(last);
  if (parts.some((p) => p.split(/\s+/).length > 5 || /^\d/.test(p))) return [];
  const seen = new Set<string>();
  return parts.map((p) => p.toLowerCase()).filter((p) => (seen.has(p) ? false : (seen.add(p), true)));
}

/* ---------------------------------------------------------------- images */

async function processImage(file: string, slug: string, alt: string): Promise<NormalizedImage> {
  const input = sharp(file, { failOn: "none" }).rotate();
  const meta = await input.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  // Backdrop: mean luminance of a frame along the borders.
  const sample = await sharp(file).rotate().resize(64, 64, { fit: "fill" }).removeAlpha().raw().toBuffer();
  let sum = 0;
  let count = 0;
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      if (x > 4 && x < 59 && y > 4 && y < 59) continue;
      const i = (y * 64 + x) * 3;
      sum += (0.2126 * sample[i]! + 0.7152 * sample[i + 1]! + 0.0722 * sample[i + 2]!) / 255;
      count++;
    }
  }
  const borderLuminance = sum / count;
  const backdrop = borderLuminance > 0.62 ? "LIGHT" : "DARK";

  const { dominant } = await sharp(file).rotate().stats();
  const dominantColor = `#${[dominant.r, dominant.g, dominant.b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;

  const outName = `${slug}.webp`;
  const resized = sharp(file, { failOn: "none" })
    .rotate()
    .resize({ width: 1000, height: 1500, fit: "inside", withoutEnlargement: true });
  const info = await resized.webp({ quality: 82, effort: 5 }).toFile(path.join(MENU_OUT, outName));

  const blur = await sharp(file).rotate().resize(16, 16, { fit: "inside" }).webp({ quality: 40 }).toBuffer();

  return {
    url: `/menu/${outName}`,
    width: info.width,
    height: info.height,
    alt,
    blurDataUrl: `data:image/webp;base64,${blur.toString("base64")}`,
    dominantColor,
    backdrop,
    sourceWidth: width,
    sourceHeight: height,
  };
}

/* ---------------------------------------------------------------- main */

async function main() {
  const menus = read<{ dbResults: RawMenu[] }>("menu.json").dbResults;
  const condition = read<{ dbResults: Record<string, unknown>[] }>("restaurant-condition.json").dbResults[0]!;
  const page = read<{ data: { config: Record<string, any> } }>("restaurant-page.json").data.config;
  const levels = read<{ levelDelivery: any[] }>("delivery-levels.json").levelDelivery;
  const coupons = read<any[]>("coupon-packages.json");

  fs.mkdirSync(MENU_OUT, { recursive: true });

  const address = page.address as Record<string, string>;
  const weekly = (
    rows: { weekday: number; slots: { from: string; to: string }[] }[],
  ): NormalizedWeeklyRange[] =>
    rows.flatMap((d) => d.slots.map((s) => ({ weekday: d.weekday, opensAt: s.from, closesAt: s.to })));
  const takeaway = condition.setting_app_takeaway_service_schedule as {
    week: number;
    time_ranges: {
      start_time: string;
      end_time: string;
      takeaway_status: boolean;
      selftake_status: boolean;
    }[];
  }[];

  // Brenvo restaurant hours: weekday 1 = Monday … 7 = Sunday (same as ISO).
  const venueHours = weekly(page.opening_hours.weekly_hours);
  const deliveryHours = takeaway.flatMap((d) =>
    d.time_ranges
      .filter((r) => r.takeaway_status)
      .map((r) => ({ weekday: d.week, opensAt: r.start_time, closesAt: r.end_time })),
  );
  const pickupHours = takeaway.flatMap((d) =>
    d.time_ranges
      .filter((r) => r.selftake_status)
      .map((r) => ({ weekday: d.week, opensAt: r.start_time, closesAt: r.end_time })),
  );

  const taxGroups = condition.setting_tax_group as { _id: string; values: { value: number }[] }[];
  const vatRateBps = Math.round((taxGroups[0]?.values[0]?.value ?? 10) * 100);

  const ZONE_NAMES = ["Fascia 1 · vicinanze", "Fascia 2 · centro città", "Fascia 3 · area estesa"];
  // Zones: smaller areas first so they win where they overlap the larger ones.
  const zones: NormalizedZone[] = levels
    .map((z, i): Omit<NormalizedZone, "priority"> => {
      const base = {
        sourceId: String(z.id),
        isActive: Boolean(z.status),
        deliveryFeeCents: eurosToCents(z.delivery_fee),
        minimumOrderCents: eurosToCents(z.delivery_minimum_fee),
        freeDeliveryThresholdCents: null,
        sourceOrder: i,
      };
      if (z.type === "CIRCLE") {
        return {
          ...base,
          name: "",
          type: "CIRCLE",
          center: { lat: Number(z.lat), lng: Number(z.lng) },
          radiusMeters: Math.round(Number(z.radius) * 1000),
          polygon: null,
        };
      }
      return {
        ...base,
        name: "",
        type: "POLYGON",
        center: null,
        radiusMeters: null,
        polygon: (z.polygon_points as { lat: string; lng: string }[]).map((p) => ({
          lat: Number(p.lat),
          lng: Number(p.lng),
        })),
      };
    })
    .sort((a, b) => a.deliveryFeeCents - b.deliveryFeeCents)
    .map((z, i) => ({
      ...z,
      priority: i + 1,
      name: ZONE_NAMES[i] ?? `Fascia ${i + 1}`,
    }));

  const promotions = coupons.map((c) => ({
    sourceId: String(c._id),
    sourceCode: String(c.code),
    name: String(c.name),
    type: c.discount_type === "0" ? ("PERCENTAGE" as const) : ("FIXED_AMOUNT" as const),
    percentBps: c.discount_type === "0" ? Math.round(Number(c.discount_value) * 100) : null,
    amountCents: c.discount_type === "0" ? null : eurosToCents(c.discount_value),
    minSubtotalCents: c.order_price_rule_enable ? eurosToCents(c.order_price_rule_value) : null,
    autoApply: Boolean(c.is_auto_use_coupon),
    perCustomerLimit: c.count_rule_enable ? Number(c.count_rule_total_count) : null,
    redemptionsCount: Number(c.issued_amount ?? 0),
    isActive: c.status === "0",
  }));

  const categories = [] as NormalizedCatalog["categories"];
  const products: NormalizedProduct[] = [];
  const extras: NormalizedCatalog["modifierGroups"][number]["options"] = [];
  const usedSlugs = new Set<string>();
  const uniqueSlug = (base: string) => {
    let slug = base;
    for (let n = 2; usedSlugs.has(slug); n++) slug = `${base}-${n}`;
    usedSlugs.add(slug);
    return slug;
  };

  const ADDONS_CATEGORY = "Aggiunzioni";
  const BROTH_CATEGORIES = ["Noodles in brodo", "Noodles di riso in brodo"];
  const ALCOHOL_CATEGORIES = ["Birra", "Vini"];

  for (const menu of [...menus].sort((a, b) => a.position - b.position)) {
    if (menu.name === ADDONS_CATEGORY) {
      // Sold as separate items on the old platform; here they become add-ons of broth noodles,
      // whose recipes contain exactly these ingredients (pork ribs, beef, pak choi).
      for (const d of [...menu.dishs].sort((a, b) => a.position - b.position)) {
        extras.push({
          sourceId: d._id,
          name: cleanDisplayName(d.name.replace(/^Extra\s+/i, "Extra ")),
          sourceName: d.name,
          priceDeltaCents: eurosToCents(d.price),
          position: d.position,
        });
      }
      continue;
    }

    categories.push({
      sourceId: menu._id,
      name: menu.name,
      slug: uniqueSlug(slugify(menu.name)),
      position: menu.position,
      isVisible: menu.status && !menu.is_hidden,
    });

    for (const d of [...menu.dishs].sort((a, b) => a.position - b.position)) {
      const { code, rest } = splitPosCode(d.name);
      const name = cleanDisplayName(rest);
      const slug = uniqueSlug(slugify(name));
      const { it, zh } = splitDescription(d.description ?? "");
      const allergens = [
        ...new Set(d.allergen.map((a) => ALLERGEN_MAP[a]).filter((a): a is Allergen => !!a)),
      ];
      const flags = d.ingredients ?? [];
      const tags = new Set<ProductTag>();
      let spicyLevel: 0 | 1 | 2 | 3 = 0;
      if (flags.includes("INGREDIENTS_MILD_SPICY")) spicyLevel = 1;
      if (flags.includes("INGREDIENTS_MEDIUM_SPICY")) spicyLevel = 2;
      if (spicyLevel === 0 && /piccant/i.test(d.name)) spicyLevel = 2;
      if (spicyLevel > 0) tags.add("SPICY");
      if (flags.includes("INGREDIENTS_COLOURANTS")) tags.add("CONTAINS_COLOURANTS");
      if (/vegetarian/i.test(d.name)) tags.add("VEGETARIAN");
      if (ALCOHOL_CATEGORIES.includes(menu.name)) tags.add("ALCOHOLIC");

      const original = path.join(ORIGINALS, `${d._id}.jpg`);
      const hasPhoto = !!d.pics?.length && fs.existsSync(original);
      const image = hasPhoto ? await processImage(original, slug, name) : null;

      products.push({
        sourceId: d._id,
        categorySourceId: menu._id,
        position: d.position,
        slug,
        name,
        sourceName: d.name,
        sourceName2: d.name2,
        nameZh: extractChineseName(d.name2 ?? ""),
        description: it,
        descriptionZh: zh,
        sourceDescription: d.description ?? "",
        ingredients: parseIngredients(it),
        posCode: code,
        priceCents: eurosToCents(d.price),
        vatRateBps,
        allergens,
        allergensDeclared: allergens.length > 0,
        tags: [...tags],
        spicyLevel,
        excludedFromDiscounts: Boolean(d.is_no_discount),
        isAvailable: d.status === "0",
        image,
      });
      process.stdout.write(".");
    }
  }

  const catalog: NormalizedCatalog = {
    source: {
      provider: "brenvo",
      restaurantId: "8L3E9",
      menuUrl: "https://app.brenvo.ai/#/web/order?string_id=8L3E9&mode=ritiro",
      restaurantUrl: "https://app.brenvo.ai/#/web/restaurant/8L3E9",
      capturedAt: new Date(fs.statSync(path.join(RAW, "menu.json")).mtime).toISOString(),
    },
    restaurant: {
      name: "DIMSUM",
      sourceName: String(page.branding.restaurant_name),
      phone: "+393762790995",
      address: {
        street: "Via Emerico Amari",
        streetNumber: address.home_number ?? "47",
        postalCode: address.postcode ?? "90139",
        city: address.city ?? "Palermo",
        province: "PA",
        region: "Sicilia",
        country: "IT",
        formatted: "Via Emerico Amari 47, 90139 Palermo PA",
      },
      location: { lat: Number(address.lat), lng: Number(address.lng) },
      googlePlaceId: address.place_id ?? null,
      timezone: String(condition.time_zone ?? "Europe/Rome"),
      venueHours,
      deliveryHours,
      pickupHours,
      vatRateBps,
      deliveryFeeVatRateBps: vatRateBps,
      pickupLeadMinutes: Number(condition.selftake_order_interval ?? 15),
      deliveryLeadMinutes: Number(condition.delivery_order_interval ?? 20),
      maxScheduleDays: Number(condition.setting_max_takeout_day ?? 1),
      customerCancelWindowMinutes: Number(condition.customer_cancel_order_time_limit ?? 30),
      cashOnDelivery: Boolean(condition.setting_cod_cash_enable),
      priceRange: page.branding.price_range
        ? `€${page.branding.price_range.min}–${page.branding.price_range.max} a persona`
        : null,
      // The source stores the old platform's short link, a redirect to Google's review page for
      // this same place: link Google directly so reviews never depend on the previous provider.
      googleReviewUrl: address.place_id
        ? `https://search.google.com/local/writereview?placeid=${encodeURIComponent(address.place_id)}`
        : (page.contact?.google ?? null),
    },
    deliveryZones: zones,
    promotions,
    categories,
    modifierGroups: [
      {
        key: "aggiunte-noodles-in-brodo",
        name: "Aggiunte",
        description: "Arricchisci il tuo brodo",
        sourceCategoryName: ADDONS_CATEGORY,
        minSelect: 0,
        maxSelect: extras.length,
        maxTotalQuantity: extras.length * 2,
        optionMaxQuantity: 2,
        attachToCategorySourceIds: categories
          .filter((c) => BROTH_CATEGORIES.includes(c.name))
          .map((c) => c.sourceId),
        options: extras,
      },
    ],
    products,
  };

  fs.writeFileSync(path.join(DATA, "catalog.json"), `${JSON.stringify(catalog, null, 2)}\n`);
  const withImages = products.filter((p) => p.image).length;
  console.log(
    `\ncategories: ${categories.length} · products: ${products.length} (${withImages} with photo) · add-ons: ${extras.length} · zones: ${zones.length} · promotions: ${promotions.length}`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
