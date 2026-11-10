import { randomUUID } from "node:crypto";
import cookie from "@fastify/cookie";
import Fastify, { type FastifyInstance } from "fastify";
import { healthResponseSchema } from "@tummy/shared";
import { registerAuthRoutes, type AuthDeps } from "./auth/routes.js";
import type { DbHandle } from "./db/client.js";
import type { Env } from "./env.js";
import { applyApiRules, defineRoute, notFoundHandler } from "./http/api-rules.js";
import {
  BODY_LIMIT_BYTES,
  DEFAULT_RATE_LIMIT,
  registerSecurity,
  type RateLimitOptions,
} from "./http/security.js";
import { loggerOptions, type LoggingOptions } from "./logging.js";

export interface AppOptions extends Partial<Pick<Env, "LOG_LEVEL" | "API_TRUST_PROXY_HOPS">> {
  /** Where log lines go (tests read them). Default: standard output. */
  logStream?: LoggingOptions["stream"];
  rateLimit?: RateLimitOptions;
  /** The app user's connection pool. The app closes it when it closes. */
  db?: DbHandle;
  /**
   * The app's own origin (APP_ORIGIN). Requests that change something must come from it.
   * Without one, every such request is refused.
   */
  appOrigin?: string;
  /** Sign-in, sessions and the account routes (src/auth). Built with createAuth(). */
  auth?: AuthDeps;
  /** Extra routes, added after the rules and limits are in place (tests use this). */
  routes?: (app: FastifyInstance) => void;
}

/**
 * Builds the API without starting it, so tests can call it with app.inject().
 * The rules every route follows are in src/http/api-rules.ts; headers and limits in
 * src/http/security.ts; what may be logged in src/logging.ts.
 */
export function buildApp(options: AppOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: loggerOptions({
      level: options.LOG_LEVEL ?? "silent",
      ...(options.logStream ? { stream: options.logStream } : {}),
    }),
    // A random request ID for each request. An ID sent by the client is ignored.
    genReqId: () => randomUUID(),
    requestIdHeader: false,
    bodyLimit: BODY_LIMIT_BYTES,
    // Trust X-Forwarded-For from exactly this many proxies in front, and no further.
    trustProxy: (_address: string, hop: number) => hop < (options.API_TRUST_PROXY_HOPS ?? 0),
    onProtoPoisoning: "error",
    onConstructorPoisoning: "error",
  });

  applyApiRules(app);
  registerSecurity(app, options.rateLimit ?? DEFAULT_RATE_LIMIT, options.appOrigin);
  // Reads the Cookie header into request.cookies and writes Set-Cookie. No signing secret: the
  // session token is random and checked against the database, so it needs no signature.
  void app.register(cookie);

  void app.register((scope, _opts, done) => {
    scope.setNotFoundHandler({ preHandler: scope.rateLimit() }, notFoundHandler);

    defineRoute(scope, {
      method: "GET",
      url: "/api/health",
      response: healthResponseSchema,
      handler: () => ({ ok: true as const }),
    });

    if (options.auth) {
      registerAuthRoutes(scope, options.auth);
    }
    options.routes?.(scope);
    done();
  });

  const db = options.db;
  if (db) {
    app.addHook("onClose", async () => {
      await db.close();
    });
  }

  return app;
}
