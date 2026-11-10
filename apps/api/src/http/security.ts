import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance } from "fastify";
import { ApiError } from "./api-rules.js";

/** Largest request body the API accepts. A tummy time entry is well under 1 KB. */
export const BODY_LIMIT_BYTES = 16 * 1024;

export interface RateLimitOptions {
  /** Requests allowed per window, per client. */
  max: number;
  timeWindowMs: number;
}

/** General limit for every route. Sign-in gets its own, stricter limit in Block 4. */
export const DEFAULT_RATE_LIMIT: RateLimitOptions = { max: 300, timeWindowMs: 60_000 };

/**
 * Security headers on every response, and a general rate limit.
 *
 * The API only ever sends JSON, so its Content Security Policy allows nothing at all:
 * no scripts (inline or not), no frames, no forms. The page itself is served by nginx.
 */
export function registerSecurity(app: FastifyInstance, limit: RateLimitOptions): void {
  void app.register(helmet, {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    strictTransportSecurity: { maxAge: 63_072_000, includeSubDomains: true },
    xContentTypeOptions: true,
    xFrameOptions: { action: "deny" },
    referrerPolicy: { policy: "no-referrer" },
    crossOriginResourcePolicy: { policy: "same-origin" },
    crossOriginOpenerPolicy: { policy: "same-origin" },
  });

  // API answers can hold a family's data: no browser or proxy may keep a copy.
  app.addHook("onSend", async (_request, reply) => {
    reply.header("cache-control", "no-store");
  });

  // Counts requests per client network address, in this process's memory only: the count is
  // never written to the database or a log, and it is gone when the window ends or the API
  // restarts. (IPv6 addresses are grouped by their network prefix, the plugin's default.)
  void app.register(rateLimit, {
    global: true,
    max: limit.max,
    timeWindow: limit.timeWindowMs,
    errorResponseBuilder: () => new ApiError(429, "rate_limited"),
  });
}
