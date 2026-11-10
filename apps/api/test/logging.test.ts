import Fastify, { type FastifyInstance } from "fastify";
import { afterAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { buildApp } from "../src/app.js";
import { applyApiRules, defineRoute } from "../src/http/api-rules.js";
import { loggerOptions, REDACT_PATHS } from "../src/logging.js";

/**
 * THE REDACTION GATE. Sends requests full of made-up secrets through the real app with its real
 * logger, captures every log line, and fails if any secret or network address shows up.
 *
 * A probe route logs the worst things a careless future route might log by hand: the whole
 * body, the headers, the PIN, the family code, the address. The canary at the bottom runs the
 * same probe with redaction switched off and expects the secrets to appear, which proves the
 * probe really writes them and this test would notice.
 */

const SECRETS = {
  pin: "PIN-482916",
  familyCode: "CODE-K7QX-M3PZ-W9RT",
  cookie: "COOKIE-sess-5f1e9a",
  authorization: "AUTH-bearer-77c2",
  setCookie: "SETCOOKIE-sess-0b3d",
  token: "TOKEN-a81f",
  sqlValue: "SQLVALUE-d4e5",
};
const ADDRESS = "203.0.113.77"; // documentation-only address range (RFC 5737)

function probeRoutes(scope: FastifyInstance): void {
  defineRoute(scope, {
    method: "POST",
    url: "/api/test/probe",
    body: z.strictObject({ pin: z.string(), familyCode: z.string() }),
    response: z.strictObject({ ok: z.literal(true) }),
    handler: ({ body, request, reply }) => {
      void reply.header("set-cookie", `session=${SECRETS.setCookie}`);
      request.log.info(
        {
          body: request.body,
          headers: request.headers,
          pin: body.pin,
          familyCode: body.familyCode,
          code: body.familyCode,
          ip: request.ip,
          remoteAddress: request.ip,
          token: SECRETS.token,
          reply: { headers: reply.getHeaders() },
          nested: { pin: body.pin, cookie: request.headers.cookie, family_code: body.familyCode },
        },
        "probe",
      );
      return { ok: true as const };
    },
  });
  defineRoute(scope, {
    method: "GET",
    url: "/api/test/db-crash",
    response: z.strictObject({ ok: z.literal(true) }),
    handler: () => {
      // Shaped like a Drizzle query error, whose message quotes the SQL and its values.
      const error = Object.assign(
        new Error(`Failed query: insert into accounts values ($1)\nparams: ${SECRETS.sqlValue}`),
        {
          name: "DrizzleQueryError",
          query: "insert into accounts values ($1)",
          params: [SECRETS.sqlValue],
          cause: Object.assign(new Error(`Key (code_lookup)=(${SECRETS.sqlValue}) exists`), {
            code: "23505",
            severity: "ERROR",
            detail: `Key (code_lookup)=(${SECRETS.sqlValue}) already exists.`,
            constraint: "accounts_code_lookup_key",
          }),
        },
      );
      throw error;
    },
  });
}

async function exercise(app: FastifyInstance): Promise<void> {
  const headers = {
    cookie: `session=${SECRETS.cookie}`,
    authorization: `Bearer ${SECRETS.authorization}`,
    "x-forwarded-for": ADDRESS,
  };
  const probe = await app.inject({
    method: "POST",
    url: "/api/test/probe?code=" + SECRETS.familyCode,
    headers,
    remoteAddress: ADDRESS,
    payload: { pin: SECRETS.pin, familyCode: SECRETS.familyCode },
  });
  // The query string is not allowed here, so this is refused (400) after logging nothing secret.
  expect(probe.statusCode).toBe(400);
  const probeOk = await app.inject({
    method: "POST",
    url: "/api/test/probe",
    headers,
    remoteAddress: ADDRESS,
    payload: { pin: SECRETS.pin, familyCode: SECRETS.familyCode },
  });
  expect(probeOk.statusCode).toBe(200);
  // Refused because of an unknown field: the body must not be logged on the error path either.
  await app.inject({
    method: "POST",
    url: "/api/test/probe",
    headers,
    remoteAddress: ADDRESS,
    payload: { pin: SECRETS.pin, familyCode: SECRETS.familyCode, extra: SECRETS.token },
  });
  const crash = await app.inject({
    method: "GET",
    url: "/api/test/db-crash",
    headers,
    remoteAddress: ADDRESS,
  });
  expect(crash.statusCode).toBe(500);
}

function capture(): { lines: string[]; stream: { write: (line: string) => void } } {
  const lines: string[] = [];
  return { lines, stream: { write: (line: string) => lines.push(line) } };
}

describe("logs never carry secrets, bodies or network addresses", () => {
  const { lines, stream } = capture();
  const app = buildApp({ LOG_LEVEL: "info", logStream: stream, routes: probeRoutes });
  afterAll(async () => {
    await app.close();
  });

  it("writes real log lines, and none holds a secret or address", async () => {
    await exercise(app);
    const output = lines.join("");
    expect(lines.length).toBeGreaterThan(8);
    expect(output).toContain('"msg":"probe"');
    expect(output).toContain("[redacted]");
    for (const [name, secret] of Object.entries(SECRETS)) {
      expect(output, `${name} reached the log`).not.toContain(secret);
    }
    expect(output, "a network address reached the log").not.toContain(ADDRESS);
    expect(output).not.toContain("127.0.0.1");
    expect(output).not.toMatch(/"(remoteAddress|remotePort|ip)":"(?!\[redacted\])/);
  });

  it("request lines carry only method, path, status, duration and a random request ID", () => {
    const parsed = lines.map((line) => JSON.parse(line) as Record<string, unknown>);
    const requestLines = parsed.filter(
      (l) => l.msg === "incoming request" || l.msg === "request completed",
    );
    expect(requestLines.length).toBeGreaterThan(0);
    for (const line of requestLines) {
      expect(String(line.reqId)).toMatch(/^[0-9a-f-]{36}$/);
      if (line.req !== undefined)
        expect(Object.keys(line.req as object).sort()).toEqual(["method", "url"]);
      if (line.res !== undefined) expect(Object.keys(line.res as object)).toEqual(["statusCode"]);
    }
  });

  it("the database error was logged without its message or values, but with its SQLSTATE", () => {
    const crashLine = lines.find((l) => l.includes("request failed"));
    expect(crashLine).toBeDefined();
    expect(crashLine).toContain('"sqlState":"23505"');
    expect(crashLine).toContain("accounts_code_lookup_key");
    expect(crashLine).not.toContain("insert into");
  });
});

describe("canary: the probe is real", () => {
  it("with redaction switched off, the same requests DO leak, so the test above can fail", async () => {
    const { lines, stream } = capture();
    const options = loggerOptions({ level: "info", stream });
    const unsafe = Fastify({ logger: { ...(options as object), redact: [] } });
    applyApiRules(unsafe);
    probeRoutes(unsafe);
    await exercise(unsafe);
    await unsafe.close();
    const output = lines.join("");
    expect(output).toContain(SECRETS.pin);
    expect(output).toContain(SECRETS.familyCode);
    expect(output).toContain(SECRETS.cookie);
    expect(output).toContain(ADDRESS);
  });

  it("the redaction list names every secret the data map rules out", () => {
    for (const path of ["pin", "familyCode", "headers", "cookie", "authorization", "body", "ip"]) {
      expect(REDACT_PATHS).toContain(path);
    }
  });
});
