import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import { healthResponseSchema } from "@tummy/shared";
import type { Env } from "./env.js";

/**
 * Builds the API without starting it, so tests can call it with app.inject().
 * Logs carry only method, path and a request id: no network address, headers or bodies.
 */
export function buildApp(
  options: Pick<Env, "LOG_LEVEL"> = { LOG_LEVEL: "silent" },
): FastifyInstance {
  const app = Fastify({
    logger: {
      level: options.LOG_LEVEL,
      serializers: {
        req(request: FastifyRequest) {
          return { method: request.method, url: request.url.split("?")[0] ?? "" };
        },
      },
    },
  });

  app.get("/api/health", () => healthResponseSchema.parse({ ok: true }));

  return app;
}
