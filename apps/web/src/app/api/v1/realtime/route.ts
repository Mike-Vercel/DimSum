import { can } from "@dimsum/domain";
import { z } from "zod";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { apiRoute } from "@/server/http";
import { hub, type Channel } from "@/server/realtime/bus";

/** Server-Sent Events stream. Clients reconnect automatically (EventSource) and refetch on reconnect. */
export const maxDuration = 300;

const query = z.object({
  channels: z
    .string()
    .max(500)
    .transform((s) =>
      s
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean),
    )
    .pipe(
      z
        .array(
          z
            .string()
            .regex(
              /^(kitchen|riders|catalog|order:[A-Za-z0-9_-]{16,64}|rider:[0-9a-f-]{36}|user:[0-9a-f-]{36})$/,
            ),
        )
        .min(1)
        .max(8),
    ),
});

export const GET = apiRoute(
  { auth: "public", rateLimit: { name: "realtime", limit: 60, windowSeconds: 60 } },
  async ({ req, viewer, query: parseQuery }) => {
    const { channels } = parseQuery(query);

    for (const channel of channels) {
      if (channel === "catalog") continue;
      // Order channels are keyed by the unguessable tracking id: knowing it is the capability.
      if (channel.startsWith("order:")) continue;
      if (channel === "kitchen" || channel === "riders") {
        if (!viewer || !can(viewer.role, "orders:read")) throw new AppError("FORBIDDEN");
        continue;
      }
      if (channel.startsWith("user:")) {
        if (!viewer || channel !== `user:${viewer.userId}`) throw new AppError("FORBIDDEN");
        continue;
      }
      if (channel.startsWith("rider:")) {
        if (!viewer) throw new AppError("UNAUTHENTICATED");
        if (can(viewer.role, "orders:read")) continue;
        const rider = await db.rider.findUnique({ where: { userId: viewer.userId }, select: { id: true } });
        if (!rider || channel !== `rider:${rider.id}`) throw new AppError("FORBIDDEN");
      }
    }

    const encoder = new TextEncoder();
    let cleanup: (() => void) | null = null;
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (chunk: string) => {
          try {
            controller.enqueue(encoder.encode(chunk));
          } catch {
            cleanup?.();
          }
        };
        send(`retry: 3000\n: connected\n\n`);
        const unsubscribe = await hub.subscribe(channels as Channel[], (envelope) => {
          send(`id: ${envelope.id}\ndata: ${JSON.stringify(envelope.event)}\n\n`);
        });
        const heartbeat = setInterval(() => send(`: ping ${Date.now()}\n\n`), 20_000);
        cleanup = () => {
          clearInterval(heartbeat);
          unsubscribe();
          cleanup = null;
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        };
        req.signal.addEventListener("abort", () => cleanup?.());
      },
      cancel() {
        cleanup?.();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-store, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  },
);
