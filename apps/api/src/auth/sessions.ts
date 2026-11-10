import { createHash, randomBytes } from "node:crypto";
import type { CookieSerializeOptions } from "@fastify/cookie";
import type { FastifyRequest } from "fastify";
import { forAccount, type AccountId } from "../db/account-scope.js";
import type { Db } from "../db/client.js";
import type { Clock } from "./clock.js";
import { credentialStore } from "./credential-store.js";

/**
 * Server-side sessions in a cookie (ADR 0004, threat model #4).
 *
 * - The token is 32 random bytes (256 bits) from node:crypto, sent only in the cookie.
 * - The database keeps only its SHA-256 hash (sessions.id_hash), so a database leak does not
 *   leak a live session.
 * - A session ends 30 days after it was last used, or 90 days after sign-in, whichever is first.
 *   A session past either limit is treated as absent and deleted when it is next presented.
 * - last_seen_at is written at most about once an hour per session, not on every request.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
export const IDLE_LIMIT_MS = 30 * DAY_MS;
export const ABSOLUTE_LIMIT_MS = 90 * DAY_MS;
export const TOUCH_INTERVAL_MS = 60 * 60 * 1000;

/**
 * __Host- prefix: the browser accepts this cookie only if it is Secure, has Path=/ and no Domain,
 * so no other site or subdomain can set or overwrite it. Chromium allows Secure cookies on
 * http://127.0.0.1 and http://localhost, so this works unchanged in development and in the
 * browser tests; no relaxed setting exists.
 */
export const SESSION_COOKIE = "__Host-tummy_session";

/** Every attribute but the lifetime. Clearing the cookie uses exactly these, so it matches. */
export const SESSION_COOKIE_ATTRIBUTES = {
  path: "/",
  httpOnly: true,
  secure: true,
  sameSite: "lax",
} as const satisfies CookieSerializeOptions;

export const SESSION_COOKIE_OPTIONS: CookieSerializeOptions = {
  ...SESSION_COOKIE_ATTRIBUTES,
  // Kept by the browser across restarts for the session's whole possible life. The server
  // decides when it really ends.
  maxAge: ABSOLUTE_LIMIT_MS / 1000,
};

/** 32 bytes as base64url: 43 characters. */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

/** The session cookie's value on a request, if it has one. */
export function sessionCookie(request: FastifyRequest): string | undefined {
  return new Map(Object.entries(request.cookies)).get(SESSION_COOKIE);
}

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Lowercase hex SHA-256 of the token: the only form the database ever sees. */
export function sessionIdHash(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export interface ActiveSession {
  accountId: AccountId;
  idHash: string;
}

export function sessionService(db: Db, clock: Clock) {
  const store = credentialStore(db);
  return {
    /** Starts a session for a signed-in account. Returns the token for the cookie. */
    async start(accountId: AccountId): Promise<string> {
      const token = newSessionToken();
      const now = clock.now();
      await forAccount(db, accountId).sessions.create({
        idHash: sessionIdHash(token),
        createdAt: now,
        expiresAt: new Date(now.getTime() + ABSOLUTE_LIMIT_MS),
      });
      return token;
    },

    /** The session behind a cookie value, or null if there is none or it has ended. */
    async resolve(token: string | undefined): Promise<ActiveSession | null> {
      if (token === undefined || !TOKEN_SHAPE.test(token)) {
        return null;
      }
      const idHash = sessionIdHash(token);
      const found = await store.findSession(idHash);
      if (!found) {
        return null;
      }
      const now = clock.now().getTime();
      const idleEnd = found.lastSeenAt.getTime() + IDLE_LIMIT_MS;
      if (now >= found.expiresAt.getTime() || now >= idleEnd) {
        await store.deleteSession(idHash);
        return null;
      }
      if (now - found.lastSeenAt.getTime() >= TOUCH_INTERVAL_MS) {
        await store.touchSession(idHash, new Date(now));
      }
      return { accountId: found.accountId, idHash };
    },

    /** Ends the session behind a cookie value, whoever it belongs to. Nothing if there is none. */
    async endToken(token: string | undefined): Promise<void> {
      if (token !== undefined && TOKEN_SHAPE.test(token)) {
        await store.deleteSession(sessionIdHash(token));
      }
    },

    /** Ends this one session ("sign out" on this phone) and records it. */
    async endOne(session: ActiveSession): Promise<void> {
      const scope = forAccount(db, session.accountId);
      await scope.sessions.deleteOne(session.idHash);
      await scope.audit.record("sign_out");
    },

    async recordSignIn(accountId: AccountId): Promise<void> {
      await forAccount(db, accountId).audit.record("sign_in");
    },

    /** Phones signed in to this account now: sessions inside both limits. */
    countActive(accountId: AccountId): Promise<number> {
      const now = clock.now();
      return forAccount(db, accountId).sessions.countActive(
        now,
        new Date(now.getTime() - IDLE_LIMIT_MS),
      );
    },
  };
}

export type SessionService = ReturnType<typeof sessionService>;
