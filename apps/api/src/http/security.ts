import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { API_REQUEST_HEADER, API_REQUEST_HEADER_VALUE } from "@tummy/shared";
import { ApiError } from "./api-rules.js";

/** Largest request body the API accepts. A tummy time entry is well under 1 KB. */
export const BODY_LIMIT_BYTES = 16 * 1024;

export interface RateLimitOptions {
  /** Requests allowed per window, per client. */
  max: number;
  timeWindowMs: number;
}

/** General limit for every route. Sign-in and sign-up have their own, stricter limits. */
export const DEFAULT_RATE_LIMIT: RateLimitOptions = { max: 300, timeWindowMs: 60_000 };

/**
 * Stricter limits per network address, counted in memory like the general one (never stored,
 * never logged).
 * - Sign-in (and DELETE /api/me, which checks the PIN): 10 a minute. A person typing a code and
 *   PIN needs a few tries at most; 10 leaves room for a whole household behind one home router.
 *   It also caps the Argon2id work one address can cause.
 * - Sign-up: 20 an hour. Enough for a clinic helping families sign up on its Wi-Fi, while one
 *   address cannot fill the database with junk accounts.
 */
export interface AuthRateLimits {
  signIn: RateLimitOptions;
  signUp: RateLimitOptions;
}
export const DEFAULT_AUTH_RATE_LIMITS: AuthRateLimits = {
  signIn: { max: 10, timeWindowMs: 60_000 },
  signUp: { max: 20, timeWindowMs: 60 * 60_000 },
};

/** Methods that never change anything. Every other method must pass the cross-site check. */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Cross-site request check (threat model #5, ADR 0004). A request that can change something
 * must say it comes from our own page, two ways:
 * - its Origin header equals the app's own origin exactly. The browser sets Origin and a page
 *   cannot change it. The origin is configured (APP_ORIGIN), never taken from the Host header,
 *   which the client controls.
 * - it carries the custom header X-Tummy-Request: 1, which a form on another site cannot send.
 * With no origin configured, every such request is refused: the check fails closed.
 */
export function isSameSiteRequest(request: FastifyRequest, appOrigin: string | undefined): boolean {
  if (SAFE_METHODS.has(request.method)) {
    return true;
  }
  const headers = new Map(Object.entries(request.headers));
  return (
    appOrigin !== undefined &&
    headers.get("origin") === appOrigin &&
    headers.get(API_REQUEST_HEADER) === API_REQUEST_HEADER_VALUE
  );
}

/**
 * Security headers on every response, and a general rate limit.
 *
 * The API only ever sends JSON, so its Content Security Policy allows nothing at all:
 * no scripts (inline or not), no frames, no forms. The page itself is served by nginx.
 */
export function registerSecurity(
  app: FastifyInstance,
  limit: RateLimitOptions,
  appOrigin: string | undefined,
): void {
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

  // Runs after the rate limit (onRequest) and before the body is read, so a refused request
  // does no work: no parsing, no validation, no database, no handler. Unknown addresses too.
  app.addHook("preParsing", async (request, _reply, payload) => {
    if (!isSameSiteRequest(request, appOrigin)) {
      throw new ApiError(403, "forbidden");
    }
    return payload;
  });
}
