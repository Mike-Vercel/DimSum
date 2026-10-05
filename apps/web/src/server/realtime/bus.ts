import "server-only";
import type { RealtimeEvent } from "@dimsum/types";
import pg from "pg";
import { db } from "../db";
import { env } from "../env";
import { logger } from "../logger";

/**
 * Realtime bus on PostgreSQL LISTEN/NOTIFY.
 *
 *  publish()  → pg_notify on any (pooled) connection
 *  subscribe()→ one LISTEN connection per server instance (direct URL), fanned out in memory
 *
 * Works for a single `next start` process and for many serverless instances alike, without a
 * third-party realtime service. Events are tiny notifications: clients refetch the data they
 * need through the API, so a missed event is never a correctness problem.
 */

export type Channel =
  "kitchen" | "riders" | "catalog" | `order:${string}` | `rider:${string}` | `user:${string}`;

interface Envelope {
  id: string;
  channels: Channel[];
  event: RealtimeEvent;
  at: number;
}

type Listener = (envelope: Envelope) => void;

const PG_CHANNEL = "dimsum_realtime";

class Hub {
  private client: pg.Client | null = null;
  private connecting: Promise<void> | null = null;
  private listeners = new Set<{ channels: Set<string>; fn: Listener }>();
  private idleTimer: NodeJS.Timeout | null = null;
  private retry = 0;

  async subscribe(channels: Channel[], fn: Listener): Promise<() => void> {
    const entry = { channels: new Set<string>(channels), fn };
    this.listeners.add(entry);
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    await this.ensureConnected();
    return () => {
      this.listeners.delete(entry);
      if (this.listeners.size === 0 && !this.idleTimer) {
        // Keep the LISTEN connection briefly for reconnecting clients, then release it.
        this.idleTimer = setTimeout(() => void this.disconnect(), 60_000);
      }
    };
  }

  dispatch(envelope: Envelope) {
    for (const l of this.listeners) {
      if (envelope.channels.some((c) => l.channels.has(c))) {
        try {
          l.fn(envelope);
        } catch (error) {
          logger.warn("realtime listener failed", { error });
        }
      }
    }
  }

  get connected() {
    return this.client !== null;
  }

  private async ensureConnected(): Promise<void> {
    if (this.client) return;
    if (this.connecting) return this.connecting;
    this.connecting = (async () => {
      const e = env();
      const client = new pg.Client({ connectionString: e.DIRECT_DATABASE_URL ?? e.DATABASE_URL });
      client.on("notification", (msg) => {
        if (msg.channel !== PG_CHANNEL || !msg.payload) return;
        try {
          this.dispatch(JSON.parse(msg.payload) as Envelope);
        } catch (error) {
          logger.warn("invalid realtime payload", { error });
        }
      });
      const onLost = (error?: unknown) => {
        if (this.client !== client) return;
        logger.warn("realtime LISTEN connection lost", { error });
        this.client = null;
        void client.end().catch(() => {});
        if (this.listeners.size > 0) {
          const delay = Math.min(30_000, 500 * 2 ** this.retry++);
          setTimeout(() => void this.ensureConnected().catch(() => {}), delay);
        }
      };
      client.on("error", onLost);
      client.on("end", () => onLost());
      await client.connect();
      await client.query(`LISTEN ${PG_CHANNEL}`);
      this.client = client;
      this.retry = 0;
    })().finally(() => {
      this.connecting = null;
    });
    return this.connecting;
  }

  private async disconnect() {
    this.idleTimer = null;
    if (this.listeners.size > 0 || !this.client) return;
    const c = this.client;
    this.client = null;
    await c.end().catch(() => {});
  }
}

const globalForHub = globalThis as unknown as { __dimsumRealtimeHub?: Hub };
export const hub = (globalForHub.__dimsumRealtimeHub ??= new Hub());

export async function publish(channels: Channel[], event: RealtimeEvent): Promise<void> {
  const envelope: Envelope = { id: crypto.randomUUID(), channels, event, at: Date.now() };
  const payload = JSON.stringify(envelope);
  if (payload.length > 7_500) {
    logger.error("realtime payload too large, dropped", { type: event.type, size: payload.length });
    return;
  }
  try {
    await db.$executeRaw`SELECT pg_notify(${PG_CHANNEL}, ${payload})`;
  } catch (error) {
    // Database notify unavailable: still deliver to clients connected to this instance.
    logger.warn("pg_notify failed, local delivery only", { error });
    hub.dispatch(envelope);
  }
}

export type { Envelope };
