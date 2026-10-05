/**
 * Money helpers. Amounts are integer euro cents everywhere; floats never leave this module.
 */

export type Cents = number;

export function assertCents(value: number, label = "amount"): Cents {
  if (!Number.isSafeInteger(value)) throw new RangeError(`${label} must be an integer number of cents`);
  return value;
}

/** Converts a decimal euro amount coming from an external source (e.g. 3.9) to cents. */
export function eurosToCents(euros: number | string): Cents {
  const n = typeof euros === "string" ? Number(euros.replace(",", ".")) : euros;
  if (!Number.isFinite(n)) throw new RangeError(`invalid euro amount: ${euros}`);
  // Work on the decimal string to avoid binary float drift (e.g. 8.9 * 100 = 890.0000000000001).
  const [whole, fraction = ""] = Math.abs(n).toFixed(2).split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0").slice(0, 2));
  return n < 0 ? -cents : cents;
}

/** Rounds half away from zero, the convention used on Italian receipts. */
export function roundHalfUp(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

/** Percentage expressed in basis points (1000 bps = 10%). */
export function applyBps(amount: Cents, bps: number): Cents {
  return roundHalfUp((amount * bps) / 10_000);
}

/** VAT contained in a VAT-inclusive gross amount ("scorporo IVA"). */
export function includedVat(gross: Cents, rateBps: number): Cents {
  if (rateBps <= 0) return 0;
  return roundHalfUp(gross - (gross * 10_000) / (10_000 + rateBps));
}

export function sumCents(values: readonly Cents[]): Cents {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

export function clampCents(value: Cents, min: Cents, max: Cents): Cents {
  return Math.min(Math.max(value, min), max);
}

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(locale: string, compact: boolean) {
  const key = `${locale}|${compact}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: compact ? 0 : 2,
      maximumFractionDigits: 2,
      // Italian CLDR skips grouping below 10.000; menus and receipts write "1.000,00".
      useGrouping: "always",
    });
    formatters.set(key, f);
  }
  return f;
}

/** "€ 9,90" — Italian formatting with the euro sign first, as on the restaurant menu. */
export function formatEuro(cents: Cents, options: { locale?: string; compact?: boolean } = {}): string {
  const { locale = "it-IT", compact = false } = options;
  const value = cents / 100;
  const useCompact = compact && cents % 100 === 0;
  const formatted = formatter(locale, useCompact).format(value);
  // it-IT renders "9,90 €"; the brand uses "€ 9,90" consistently across apps.
  if (locale.startsWith("it")) {
    const sign = value < 0 ? "−" : "";
    return `${sign}€ ${formatted
      .replace(/[\s ]*€/, "")
      .replace("-", "")
      .trim()}`;
  }
  return formatted;
}

/** Splits a VAT-inclusive amount into net and VAT parts. */
export function splitVat(gross: Cents, rateBps: number): { net: Cents; vat: Cents } {
  const vat = includedVat(gross, rateBps);
  return { net: gross - vat, vat };
}

/**
 * Distributes `amount` across `weights` proportionally so that the parts always sum to `amount`
 * (largest remainder method). Used to spread an order discount over VAT rates and lines.
 */
export function allocateProportionally(amount: Cents, weights: readonly number[]): Cents[] {
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight <= 0 || weights.length === 0) return weights.map(() => 0);
  const raw = weights.map((w) => (amount * w) / totalWeight);
  const floors = raw.map((r) => Math.floor(r));
  let remainder = amount - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (remainder <= 0) break;
    floors[i] = (floors[i] ?? 0) + 1;
    remainder--;
  }
  return floors;
}
