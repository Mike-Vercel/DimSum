const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${timeZone}|${JSON.stringify(options)}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat("it-IT", { ...options, timeZone });
    formatters.set(key, f);
  }
  return f;
}

/** "sab 4 ott · 20:15" in the restaurant's time zone (deterministic on server and client). */
export function formatOrderDate(iso: string, timeZone: string): string {
  const d = new Date(iso);
  const day = formatter(timeZone, { weekday: "short", day: "numeric", month: "short" }).format(d);
  const time = formatter(timeZone, { hour: "2-digit", minute: "2-digit" }).format(d);
  return `${day} · ${time}`;
}

/** "4 ottobre 2026". */
export function formatLongDate(iso: string, timeZone: string): string {
  return formatter(timeZone, { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}
