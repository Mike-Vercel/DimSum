import "server-only";

type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const threshold = ORDER[(process.env.LOG_LEVEL as Level | undefined) ?? "info"] ?? ORDER.info;
const pretty = process.env.NODE_ENV !== "production";

/** Keys never written to logs, even when nested. */
const REDACT = /pass(word)?|secret|token|authorization|cookie|card|cvc|iban|clientsecret/i;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 5 || value === null || typeof value !== "object") return value;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
      cause: redact(value.cause, depth + 1),
    };
  }
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([k, v]) => [
      k,
      REDACT.test(k) ? "[redacted]" : redact(v, depth + 1),
    ]),
  );
}

function write(level: Level, msg: string, context?: Record<string, unknown>) {
  if (ORDER[level] < threshold) return;
  const entry = {
    level,
    time: new Date().toISOString(),
    msg,
    ...(context ? (redact(context) as object) : {}),
  };
  const line = pretty
    ? `${entry.time.slice(11, 19)} ${level.toUpperCase().padEnd(5)} ${msg}${context ? ` ${JSON.stringify(redact(context))}` : ""}`
    : JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export interface Logger {
  debug(msg: string, ctx?: Record<string, unknown>): void;
  info(msg: string, ctx?: Record<string, unknown>): void;
  warn(msg: string, ctx?: Record<string, unknown>): void;
  error(msg: string, ctx?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): Logger;
}

function create(bindings: Record<string, unknown> = {}): Logger {
  const merge = (ctx?: Record<string, unknown>) => ({ ...bindings, ...ctx });
  return {
    debug: (m, c) => write("debug", m, merge(c)),
    info: (m, c) => write("info", m, merge(c)),
    warn: (m, c) => write("warn", m, merge(c)),
    error: (m, c) => write("error", m, merge(c)),
    child: (b) => create({ ...bindings, ...b }),
  };
}

export const logger = create();
