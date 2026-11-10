import type { Db } from "../db/client.js";
import { DEFAULT_AUTH_RATE_LIMITS, type AuthRateLimits } from "../http/security.js";
import { systemClock, type Clock } from "./clock.js";
import type { AuthSettings } from "./config.js";
import { devFakeProvider } from "./dev-fake.js";
import { familyCodePinProvider } from "./family-code-pin.js";
import { pinChecker } from "./pin-check.js";
import { createPinHasher, type PinHasher } from "./pin-hash.js";
import type { AuthProvider } from "./provider.js";
import type { AuthDeps } from "./routes.js";
import { sessionService } from "./sessions.js";

export interface CreateAuthOptions {
  db: Db;
  settings: AuthSettings;
  clock?: Clock;
  rateLimits?: AuthRateLimits;
  /** Tests pass a wrapped hasher to see how many Argon2id checks ran. */
  hasher?: PinHasher;
}

/** Builds everything sign-in needs. Async because the dummy hash is made at start-up. */
export async function createAuth(options: CreateAuthOptions): Promise<AuthDeps> {
  const clock = options.clock ?? systemClock;
  const hasher = options.hasher ?? (await createPinHasher());
  const { db, settings } = options;
  const checkPin = pinChecker(db, hasher, clock);
  const pinDeps = { db, secret: settings.codeLookupSecret, hasher, checkPin };
  const provider: AuthProvider =
    settings.provider === "dev-fake"
      ? devFakeProvider(pinDeps, settings.nodeEnv)
      : familyCodePinProvider(pinDeps);
  return {
    db,
    provider,
    sessions: sessionService(db, clock),
    checkPin,
    rateLimits: options.rateLimits ?? DEFAULT_AUTH_RATE_LIMITS,
    clock,
  };
}
