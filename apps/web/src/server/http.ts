import "server-only";
import { can, type Permission } from "@dimsum/domain";
import type { ApiErrorBody } from "@dimsum/types";
import { NextResponse, type NextRequest } from "next/server";
import { z, type ZodType } from "zod";
import { Prisma } from "./db";
import { getViewerFromHeaders, type Viewer } from "./auth/session";
import { AppError, isAppError } from "./errors";
import { logger, type Logger } from "./logger";
import { rateLimit } from "./ratelimit";
import { clientIp, privacyHash, sameOrigin } from "./security";

export interface RouteContext<P> {
  req: NextRequest;
  params: P;
  viewer: Viewer | null;
  requestId: string;
  ip: string;
  log: Logger;
  /** Parses and validates the JSON body. */
  body<T>(schema: ZodType<T>): Promise<T>;
  /** Validates query-string parameters. */
  query<T>(schema: ZodType<T>): T;
}

export interface RouteOptions {
  /** "user" requires a signed-in user, a Permission requires that role permission. */
  auth?: "public" | "user" | Permission;
  rateLimit?: { name: string; limit: number; windowSeconds: number; by?: "ip" | "user" };
  /** Maximum JSON body size in bytes. */
  maxBodyBytes?: number;
}

const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validates a UUID path segment: anything else is simply "not found". */
export function parseId(value: string, what = "Elemento"): string {
  if (!UUID.test(value)) throw new AppError("NOT_FOUND", `${what} non trovato.`);
  return value;
}

export function json<T>(data: T, init: ResponseInit = {}): NextResponse {
  const headers = new Headers(init.headers);
  if (!headers.has("Cache-Control")) headers.set("Cache-Control", "no-store");
  return NextResponse.json(data, { ...init, headers });
}

export function errorResponse(error: unknown, requestId: string, log: Logger): NextResponse {
  let appError: AppError;
  if (isAppError(error)) {
    appError = error;
  } else if (error instanceof z.ZodError) {
    const flat = z.flattenError(error);
    const fieldErrors = Object.fromEntries(
      Object.entries(flat.fieldErrors as Record<string, string[] | undefined>).filter(
        (e): e is [string, string[]] => !!e[1],
      ),
    );
    appError = new AppError(
      "VALIDATION_FAILED",
      flat.formErrors[0] ?? Object.values(fieldErrors)[0]?.[0] ?? "Controlla i dati inseriti.",
      {
        fieldErrors,
      },
    );
  } else if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    appError = new AppError("CONFLICT", "Questo elemento esiste già.");
  } else if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    appError = new AppError("NOT_FOUND");
  } else {
    log.error("unhandled API error", { error });
    appError = new AppError("INTERNAL");
  }
  if (appError.status >= 500 && isAppError(error)) log.error("API error", { code: appError.code, error });
  const body: ApiErrorBody = {
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.fieldErrors ? { fieldErrors: appError.fieldErrors } : {}),
      ...(appError.details !== undefined ? { details: appError.details } : {}),
    },
  };
  const headers: Record<string, string> = { "Cache-Control": "no-store", "X-Request-Id": requestId };
  if (appError.retryAfterSeconds) headers["Retry-After"] = String(appError.retryAfterSeconds);
  return NextResponse.json(body, { status: appError.status, headers });
}

/**
 * Wraps an API v1 route handler: request id, session, RBAC, CSRF protection for cookie-based
 * calls, rate limiting, input validation and uniform error responses. Business logic lives in
 * services; handlers stay thin so the same API serves web, PWA and native apps.
 */
export function apiRoute<P = Record<string, never>>(
  options: RouteOptions,
  handler: (ctx: RouteContext<P>) => Promise<Response | unknown>,
) {
  return async (req: NextRequest, routeCtx: { params: Promise<P> }): Promise<Response> => {
    const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
    const log = logger.child({ requestId, method: req.method, path: req.nextUrl.pathname });
    try {
      const ip = clientIp(req.headers);
      const bearer = req.headers.get("authorization")?.startsWith("Bearer ");
      const hasSessionCookie = (req.headers.get("cookie") ?? "").includes("dimsum.session_token");

      // CSRF: browsers attach the session cookie automatically, so cookie-authenticated writes must
      // come from our own origin. Native apps authenticate with a bearer token instead.
      if (UNSAFE.has(req.method) && hasSessionCookie && !bearer && !sameOrigin(req.headers)) {
        throw new AppError("FORBIDDEN", "Richiesta non consentita.");
      }

      const auth = options.auth ?? "public";
      const viewer =
        auth === "public" && !hasSessionCookie && !bearer
          ? null
          : await getViewerFromHeaders(req.headers, { fresh: auth !== "public" && auth !== "user" });
      if (auth !== "public") {
        if (!viewer) throw new AppError("UNAUTHENTICATED");
        if (auth !== "user" && !can(viewer.role, auth)) throw new AppError("FORBIDDEN");
      }

      if (options.rateLimit) {
        const subject =
          options.rateLimit.by === "user" && viewer ? `u:${viewer.userId}` : `ip:${privacyHash(ip)}`;
        const r = await rateLimit(
          `${options.rateLimit.name}:${subject}`,
          options.rateLimit.limit,
          options.rateLimit.windowSeconds,
        );
        if (!r.ok) throw new AppError("RATE_LIMITED", undefined, { retryAfterSeconds: r.retryAfterSeconds });
      }

      const maxBody = options.maxBodyBytes ?? 64 * 1024;
      const ctx: RouteContext<P> = {
        req,
        params: (await routeCtx.params) ?? ({} as P),
        viewer,
        requestId,
        ip,
        log,
        async body(schema) {
          const declared = Number(req.headers.get("content-length") ?? 0);
          if (declared > maxBody) throw new AppError("PAYLOAD_TOO_LARGE", "Richiesta troppo grande.");
          const text = await req.text();
          if (text.length > maxBody) throw new AppError("PAYLOAD_TOO_LARGE", "Richiesta troppo grande.");
          let data: unknown;
          try {
            data = text ? JSON.parse(text) : {};
          } catch {
            throw new AppError("BAD_REQUEST", "Formato della richiesta non valido.");
          }
          return schema.parse(data);
        },
        query(schema) {
          return schema.parse(Object.fromEntries(req.nextUrl.searchParams.entries()));
        },
      };

      const result = await handler(ctx);
      if (result instanceof Response) {
        result.headers.set("X-Request-Id", requestId);
        return result;
      }
      return json(result ?? { ok: true }, { headers: { "X-Request-Id": requestId } });
    } catch (error) {
      return errorResponse(error, requestId, log);
    }
  };
}
