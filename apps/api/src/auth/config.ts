import { z } from "zod";
import { authMethods, type AuthMethod } from "@tummy/shared";
import { EnvError } from "../env.js";

/**
 * Sign-in settings, read from the environment only. The API refuses to start when any is wrong.
 *
 * - CODE_LOOKUP_SECRET: the key for the keyed hash of family codes (ADR 0003, threat model #3).
 *   At least 32 random bytes, written in base64. It lives only in the server's environment,
 *   never in the database, the repo or a log. Without it the API cannot find any account, so a
 *   missing or weak value stops the API instead of running with a guessable key.
 * - APP_ORIGIN: the app's own origin, such as https://tummytime.example.org. State-changing
 *   requests must carry exactly this Origin (src/http/security.ts). It is configured, never
 *   worked out from the Host header, because the client controls Host.
 * - AUTH_PROVIDER: family-code-pin (default) or dev-fake. dev-fake is only for development
 *   and test, and the API refuses to start with it anywhere else.
 */

export interface AuthSettings {
  provider: AuthMethod;
  codeLookupSecret: Buffer;
  appOrigin: string;
  nodeEnv: string;
}

const MIN_SECRET_BYTES = 32;
/** A random 32-byte key has about 28 different byte values. Fewer than 16 means "not random". */
const MIN_DISTINCT_BYTES = 16;

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

export function isDevelopmentOrTest(nodeEnv: string | undefined): boolean {
  return nodeEnv === "development" || nodeEnv === "test";
}

const secretSchema = z
  .string()
  .regex(/^[A-Za-z0-9+/_-]+={0,2}$/, "must be base64 (see .env.example for how to make one)")
  .transform((value, ctx) => {
    const bytes = Buffer.from(value, "base64");
    if (bytes.length < MIN_SECRET_BYTES) {
      ctx.addIssue({
        code: "custom",
        message: `must be at least ${String(MIN_SECRET_BYTES)} random bytes (see .env.example)`,
      });
      return z.NEVER;
    }
    if (new Set(bytes).size < MIN_DISTINCT_BYTES) {
      ctx.addIssue({
        code: "custom",
        message: "does not look random (see .env.example for how to make one)",
      });
      return z.NEVER;
    }
    return bytes;
  });

const originSchema = z.string().refine((value) => {
  try {
    const url = new URL(value);
    if (url.origin !== value) return false;
    // https everywhere, except plain http on this machine (development and the test runs).
    return (
      url.protocol === "https:" || (url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname))
    );
  } catch {
    return false;
  }
}, "must be an origin such as https://tummytime.example.org: https, no path, no trailing slash (http only for 127.0.0.1 or localhost)");

const authSchema = z.object({
  NODE_ENV: z.string().optional(),
  AUTH_PROVIDER: z.enum(authMethods).default("family-code-pin"),
  CODE_LOOKUP_SECRET: secretSchema,
  APP_ORIGIN: originSchema,
});

export function loadAuthSettings(
  source: Record<string, string | undefined> = process.env,
): AuthSettings {
  const result = authSchema.safeParse(source);
  if (!result.success) {
    const given = new Map(Object.entries(source));
    const problems = result.error.issues.map((issue) => {
      const name = issue.path.join(".");
      const missing = (given.get(name) ?? "") === "";
      // Never echo a value: it may be the secret.
      return `  - ${name}: ${missing ? "missing" : issue.message}`;
    });
    throw new EnvError(
      `The API cannot start because its sign-in settings are not right:\n${problems.join("\n")}\n` +
        "Copy .env.example to .env and fill in the values.",
    );
  }
  const env = result.data;
  if (env.AUTH_PROVIDER === "dev-fake" && !isDevelopmentOrTest(env.NODE_ENV)) {
    throw new EnvError(
      "The API cannot start because AUTH_PROVIDER is dev-fake, which signs anyone in without a PIN. " +
        `It only runs when NODE_ENV is development or test (NODE_ENV is "${env.NODE_ENV ?? ""}").`,
    );
  }
  return {
    provider: env.AUTH_PROVIDER,
    codeLookupSecret: env.CODE_LOOKUP_SECRET,
    appOrigin: env.APP_ORIGIN,
    nodeEnv: env.NODE_ENV ?? "",
  };
}
