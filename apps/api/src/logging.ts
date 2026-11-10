import type { FastifyRequest, FastifyServerOptions } from "fastify";
import type { Env } from "./env.js";

/**
 * Logging rules (docs/data-map.md, "In logs"): request method, path, status, duration and a
 * random request ID. Never a PIN, family code, cookie, session token, request body or network
 * address.
 *
 * Two layers keep secrets out:
 * 1. Serializers decide what a request, reply and error look like in a log line. They copy only
 *    the allowed fields, so headers, bodies and addresses are never written in the first place.
 * 2. REDACT_PATHS catches anything that slips past, such as code that logs
 *    `{ body: request.body }` or `{ pin }` by hand. Matching values become "[redacted]".
 *
 * test/logging.test.ts captures real log output and fails if any secret gets through.
 */
export const REDACT_PATHS: readonly string[] = [
  // Whole header objects: they carry cookies, tokens, forwarding addresses and device details.
  "headers",
  "*.headers",
  // Credential and address headers logged one by one.
  "authorization",
  "cookie",
  '["set-cookie"]',
  '["x-forwarded-for"]',
  "forwarded",
  "*.authorization",
  "*.cookie",
  '*["set-cookie"]',
  '*["x-forwarded-for"]',
  "*.forwarded",
  // Request bodies, never logged whole.
  "body",
  "*.body",
  "payload",
  "*.payload",
  // Sign-in secrets under any of their likely names.
  "pin",
  "*.pin",
  "code",
  "*.code",
  "familyCode",
  "*.familyCode",
  "family_code",
  "*.family_code",
  "token",
  "*.token",
  "sessionToken",
  "*.sessionToken",
  "password",
  "*.password",
  // Network addresses.
  "ip",
  "*.ip",
  "ips",
  "*.ips",
  "remoteAddress",
  "*.remoteAddress",
  "remotePort",
  "*.remotePort",
];

interface ErrorLike {
  name?: unknown;
  message?: unknown;
  stack?: unknown;
  code?: unknown;
  constraint?: unknown;
  cause?: unknown;
  query?: unknown;
  params?: unknown;
  severity?: unknown;
}

function stackFrames(stack: unknown): string {
  if (typeof stack !== "string") return "";
  // Drop the first line: it repeats the message, which for a database error can quote values.
  return stack
    .split("\n")
    .filter((line) => line.trimStart().startsWith("at "))
    .join("\n");
}

function isDatabaseError(error: ErrorLike): boolean {
  // Drizzle wraps query failures with the SQL text and its parameters; node-postgres errors
  // carry a severity and a five-character SQLSTATE. Both can quote row values in messages.
  return (
    "query" in error ||
    "params" in error ||
    (typeof error.severity === "string" && typeof error.code === "string")
  );
}

/** What an error looks like in a log line. Database errors lose their message and values. */
export interface SerializedError {
  [key: string]: unknown;
  type: string;
  message: string;
  stack: string;
}

export function serializeError(value: unknown): SerializedError {
  if (typeof value !== "object" || value === null) {
    return { type: typeof value, message: "", stack: "" };
  }
  const error = value as ErrorLike;
  const type = typeof error.name === "string" ? error.name : "Error";
  if (isDatabaseError(error)) {
    const cause = (
      typeof error.cause === "object" && error.cause !== null ? error.cause : error
    ) as ErrorLike;
    return {
      type,
      message: "Database error. Details are left out because they can quote row values.",
      sqlState: typeof cause.code === "string" ? cause.code : undefined,
      constraint: typeof cause.constraint === "string" ? cause.constraint : undefined,
      stack: stackFrames(error.stack),
    };
  }
  return {
    type,
    message: typeof error.message === "string" ? error.message : "",
    errorCode: typeof error.code === "string" ? error.code : undefined,
    stack: stackFrames(error.stack),
  };
}

export interface LoggingOptions {
  level: Env["LOG_LEVEL"];
  /** Where log lines go. Default: standard output. Tests pass a stream to read them. */
  stream?: { write: (line: string) => void };
}

export function loggerOptions(
  options: LoggingOptions,
): NonNullable<FastifyServerOptions["logger"]> {
  return {
    level: options.level,
    ...(options.stream ? { stream: options.stream } : {}),
    redact: { paths: [...REDACT_PATHS], censor: "[redacted]" },
    serializers: {
      req(request: FastifyRequest) {
        return { method: request.method, url: request.url.split("?")[0] ?? "" };
      },
      res(reply: { statusCode: number }) {
        return { statusCode: reply.statusCode };
      },
      err: serializeError,
    },
  };
}
