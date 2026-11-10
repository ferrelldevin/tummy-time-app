import Fastify from "fastify";
import { afterAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { apiErrorSchema } from "@tummy/shared";
import { buildApp } from "../src/app.js";
import { applyApiRules, defineRoute, findLooseObjects } from "../src/http/api-rules.js";
import { BODY_LIMIT_BYTES } from "../src/http/security.js";

/** Test-only routes that exercise each rule. They exist only inside this file's app. */
const app = buildApp({
  routes(scope) {
    defineRoute(scope, {
      method: "POST",
      url: "/api/test/echo",
      body: z.strictObject({
        minutes: z.number().int().min(1),
        note: z.strictObject({ a: z.string() }).optional(),
      }),
      response: z.strictObject({ minutes: z.number() }),
      handler: ({ body }) => ({ minutes: body.minutes }),
    });
    defineRoute(scope, {
      method: "GET",
      url: "/api/test/items/:id",
      params: z.strictObject({ id: z.uuid() }),
      querystring: z.strictObject({ since: z.coerce.number().int().min(0).optional() }),
      response: z.strictObject({ id: z.string(), since: z.number() }),
      handler: ({ params, query }) => ({ id: params.id, since: query.since ?? 0 }),
    });
    defineRoute(scope, {
      method: "GET",
      url: "/api/test/leaky",
      response: z.strictObject({ ok: z.boolean() }),
      // A bug on purpose: an extra field the schema does not allow.
      handler: () => ({ ok: true, pin_hash: "$argon2id$secret" }) as { ok: boolean },
    });
    defineRoute(scope, {
      method: "GET",
      url: "/api/test/crash",
      response: z.strictObject({ ok: z.boolean() }),
      handler: () => {
        throw new Error('relation "tummy_logs" does not exist at SELECT * FROM tummy_logs');
      },
    });
  },
});

afterAll(async () => {
  await app.close();
});

function expectErrorShape(body: string, code: string): void {
  const parsed = apiErrorSchema.parse(JSON.parse(body));
  expect(parsed.error.code).toBe(code);
  // Nothing internal: no stack frames, SQL or table names, no Fastify error codes.
  expect(body).not.toMatch(/\bat\s+\S+\s*\(|stack|tummy_logs|SELECT|FST_|Error:|\.ts\b/i);
}

describe("one error shape, no leaks", () => {
  it("400: unknown field in the body", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/test/echo",
      payload: { minutes: 3, pin: "1234" },
    });
    expect(res.statusCode).toBe(400);
    expectErrorShape(res.body, "bad_request");
  });

  it("400: unknown field in a nested object", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/test/echo",
      payload: { minutes: 3, note: { a: "x", b: "y" } },
    });
    expect(res.statusCode).toBe(400);
  });

  it("400: wrong type, bad params, unknown query", async () => {
    for (const request of [
      { method: "POST" as const, url: "/api/test/echo", payload: { minutes: "three" } },
      { method: "GET" as const, url: "/api/test/items/not-a-uuid" },
      {
        method: "GET" as const,
        url: "/api/test/items/4f7a1d2e-8c3b-4a5d-9e6f-1a2b3c4d5e6f?extra=1",
      },
      { method: "GET" as const, url: "/api/health?debug=true" },
    ]) {
      const res = await app.inject(request);
      expect(res.statusCode, request.url).toBe(400);
      expectErrorShape(res.body, "bad_request");
    }
  });

  it("400: broken JSON", async () => {
    const broken = await app.inject({
      method: "POST",
      url: "/api/test/echo",
      headers: { "content-type": "application/json" },
      payload: '{"minutes": 3,',
    });
    expect(broken.statusCode).toBe(400);
    expectErrorShape(broken.body, "bad_request");
  });

  it("400: prototype poisoning", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/test/echo",
      headers: { "content-type": "application/json" },
      payload: '{"minutes": 3, "__proto__": {"admin": true}}',
    });
    expect(res.statusCode).toBe(400);
    expectErrorShape(res.body, "bad_request");
  });

  it("valid input passes and the output is checked", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/test/echo",
      payload: { minutes: 3 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ minutes: 3 });
    const item = await app.inject({
      method: "GET",
      url: "/api/test/items/4f7a1d2e-8c3b-4a5d-9e6f-1a2b3c4d5e6f?since=5",
    });
    expect(item.json()).toEqual({ id: "4f7a1d2e-8c3b-4a5d-9e6f-1a2b3c4d5e6f", since: 5 });
  });

  it("404: unknown address", async () => {
    const res = await app.inject({ method: "GET", url: "/api/nothing-here" });
    expect(res.statusCode).toBe(404);
    expectErrorShape(res.body, "not_found");
  });

  it("413: body over the limit", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/test/echo",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ minutes: 3, padding: "x".repeat(BODY_LIMIT_BYTES) }),
    });
    expect(res.statusCode).toBe(413);
    expectErrorShape(res.body, "payload_too_large");
  });

  it("415: not JSON", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/test/echo",
      headers: { "content-type": "application/xml" },
      payload: "<minutes>3</minutes>",
    });
    expect(res.statusCode).toBe(415);
    expectErrorShape(res.body, "unsupported_media_type");
  });

  it("500: a thrown error leaks no message, stack or SQL", async () => {
    const res = await app.inject({ method: "GET", url: "/api/test/crash" });
    expect(res.statusCode).toBe(500);
    expectErrorShape(res.body, "internal_error");
  });

  it("500: a response with a field its schema does not allow is never sent", async () => {
    const res = await app.inject({ method: "GET", url: "/api/test/leaky" });
    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain("argon2id");
    expectErrorShape(res.body, "internal_error");
  });
});

describe("429: the general rate limit", () => {
  const limited = buildApp({ rateLimit: { max: 2, timeWindowMs: 60_000 } });
  afterAll(async () => {
    await limited.close();
  });

  it("answers 429 in the one shape once the limit is passed, on real and unknown routes", async () => {
    expect((await limited.inject({ method: "GET", url: "/api/health" })).statusCode).toBe(200);
    expect((await limited.inject({ method: "GET", url: "/api/health" })).statusCode).toBe(200);
    const res = await limited.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(429);
    expect(res.headers["retry-after"]).toBeDefined();
    expectErrorShape(res.body, "rate_limited");
    const missing = await limited.inject({ method: "GET", url: "/api/nothing-here" });
    expect(missing.statusCode).toBe(429);
  });
});

describe("every route declares its schemas", () => {
  it("a route added without defineRoute() stops the app from starting", () => {
    const bare = Fastify();
    applyApiRules(bare);
    expect(() => bare.get("/api/raw", () => ({ ok: true }))).toThrow(/defineRoute/);
  });

  it("a schema that lets unknown fields through is refused when the route is defined", () => {
    const bare = Fastify();
    applyApiRules(bare);
    expect(() => {
      defineRoute(bare, {
        method: "POST",
        url: "/api/loose",
        body: z.object({ minutes: z.number() }),
        response: z.strictObject({}),
        handler: () => ({}),
      });
    }).toThrow(/strictObject/);
  });

  it("finds loose objects at any depth", () => {
    expect(findLooseObjects(z.strictObject({ a: z.strictObject({}) }))).toEqual([]);
    expect(findLooseObjects(z.strictObject({ a: z.array(z.object({})) }))).toEqual(["(root).a[]"]);
    expect(findLooseObjects(z.strictObject({ a: z.object({}).optional() }))).toEqual(["(root).a"]);
  });
});
