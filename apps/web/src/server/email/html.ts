/** Tiny HTML templating for e-mails: every interpolated value is escaped unless wrapped in raw(). */

const RAW = Symbol("raw");
export interface RawHtml {
  [RAW]: true;
  value: string;
}

export const raw = (value: string): RawHtml => ({ [RAW]: true, value });

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type Value = string | number | null | undefined | false | RawHtml | Value[];

function render(value: Value): string {
  if (value === null || value === undefined || value === false) return "";
  if (Array.isArray(value)) return value.map(render).join("");
  if (typeof value === "object" && RAW in value) return value.value;
  return escapeHtml(value);
}

export function html(strings: TemplateStringsArray, ...values: Value[]): RawHtml {
  let out = "";
  strings.forEach((s, i) => {
    out += s + (i < values.length ? render(values[i] as Value) : "");
  });
  return raw(out);
}

/** Plain-text alternative from simple HTML. */
export function htmlToText(input: string): string {
  return input
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, "\n")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, "$2 ($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
