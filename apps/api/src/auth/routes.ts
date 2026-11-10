import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  authStartResponseSchema,
  deleteMeBodySchema,
  deleteMeResponseSchema,
  meResponseSchema,
  signedOutResponseSchema,
  signInFinishResponseSchema,
  signUpFinishResponseSchema,
} from "@tummy/shared";
import type { AccountId } from "../db/account-scope.js";
import type { Db } from "../db/client.js";
import { ApiError, defineRoute } from "../http/api-rules.js";
import type { AuthRateLimits } from "../http/security.js";
import type { Clock } from "./clock.js";
import { defineAccountRoute } from "./guard.js";
import type { CheckPin } from "./pin-check.js";
import type { AuthProvider } from "./provider.js";
import {
  SESSION_COOKIE,
  SESSION_COOKIE_ATTRIBUTES,
  SESSION_COOKIE_OPTIONS,
  sessionCookie,
  type SessionService,
} from "./sessions.js";

/**
 * Sign-up, sign-in, sign-out and the account (Block 4). Every route here is added with
 * defineRoute() or defineAccountRoute(), so it has strict schemas and the one error shape, and
 * every state-changing one passes the cross-site check in src/http/security.ts first.
 *
 * Routes reach the sign-in method only through the AuthProvider interface, sessions only
 * through the session service, and account rows only through forAccount().
 */

export interface AuthDeps {
  db: Db;
  provider: AuthProvider;
  sessions: SessionService;
  checkPin: CheckPin;
  rateLimits: AuthRateLimits;
  /** The same clock sign-in uses. The log routes measure their time limits with it too. */
  clock: Clock;
}

function clearSessionCookie(reply: FastifyReply): void {
  // The same attributes as when it was set, so the browser matches and removes it.
  void reply.clearCookie(SESSION_COOKIE, { ...SESSION_COOKIE_ATTRIBUTES });
}

/**
 * Starts a session after a successful sign-up or sign-in. Any session this browser already had
 * is ended first, whoever it belonged to, so a token planted before sign-in is never promoted
 * (session fixation). The new token goes only into the cookie.
 */
async function startSession(
  deps: AuthDeps,
  request: FastifyRequest,
  reply: FastifyReply,
  accountId: AccountId,
): Promise<void> {
  await deps.sessions.endToken(sessionCookie(request));
  const token = await deps.sessions.start(accountId);
  void reply.setCookie(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);
}

export function registerAuthRoutes(app: FastifyInstance, deps: AuthDeps): void {
  const { provider } = deps;
  const guard = { db: deps.db, sessions: deps.sessions };

  defineRoute(app, {
    method: "POST",
    url: "/api/auth/sign-up/start",
    ...(provider.inputs.startSignUp ? { body: provider.inputs.startSignUp } : {}),
    response: authStartResponseSchema,
    rateLimit: deps.rateLimits.signUp,
    handler: ({ body }) => provider.startSignUp(body),
  });

  defineRoute(app, {
    method: "POST",
    url: "/api/auth/sign-up/finish",
    body: provider.inputs.finishSignUp,
    response: signUpFinishResponseSchema,
    status: 201,
    rateLimit: deps.rateLimits.signUp,
    handler: async ({ body, request, reply }) => {
      const result = await provider.finishSignUp(body);
      if (result.outcome === "weak_pin") {
        throw new ApiError(400, "weak_pin");
      }
      await startSession(deps, request, reply, result.accountId);
      return { familyCode: result.familyCode };
    },
  });

  defineRoute(app, {
    method: "POST",
    url: "/api/auth/sign-in/start",
    ...(provider.inputs.startSignIn ? { body: provider.inputs.startSignIn } : {}),
    response: authStartResponseSchema,
    rateLimit: deps.rateLimits.signIn,
    handler: ({ body }) => provider.startSignIn(body),
  });

  defineRoute(app, {
    method: "POST",
    url: "/api/auth/sign-in/finish",
    body: provider.inputs.finishSignIn,
    response: signInFinishResponseSchema,
    rateLimit: deps.rateLimits.signIn,
    handler: async ({ body, request, reply }) => {
      const result = await provider.finishSignIn(body);
      if (result.outcome === "failed") {
        throw new ApiError(401, "sign_in_failed");
      }
      if (result.outcome === "locked") {
        throw new ApiError(429, "account_locked");
      }
      await startSession(deps, request, reply, result.accountId);
      await deps.sessions.recordSignIn(result.accountId);
      return { signedIn: true as const };
    },
  });

  // Sign out on this phone. Works with or without a session, so a stale cookie can always be
  // cleared; the audit event is written only when a session really ended.
  defineRoute(app, {
    method: "POST",
    url: "/api/auth/sign-out",
    response: signedOutResponseSchema,
    handler: async ({ request, reply }) => {
      const session = await deps.sessions.resolve(sessionCookie(request));
      if (session !== null) {
        await deps.sessions.endOne(session);
      }
      clearSessionCookie(reply);
      return { signedOut: true as const };
    },
  });

  defineAccountRoute(app, guard, {
    method: "POST",
    url: "/api/auth/sign-out-everywhere",
    response: signedOutResponseSchema,
    handler: async ({ account, reply }) => {
      await account.sessions.deleteAll();
      await account.audit.record("sign_out");
      clearSessionCookie(reply);
      return { signedOut: true as const };
    },
  });

  defineAccountRoute(app, guard, {
    method: "GET",
    url: "/api/me",
    response: meResponseSchema,
    handler: async ({ session }) => ({
      signedIn: true as const,
      phonesSignedIn: await deps.sessions.countActive(session.accountId),
    }),
  });

  defineAccountRoute(app, guard, {
    method: "DELETE",
    url: "/api/me",
    body: deleteMeBodySchema,
    response: deleteMeResponseSchema,
    // It checks a PIN, so it gets the sign-in limit.
    rateLimit: deps.rateLimits.signIn,
    handler: async ({ body, account, reply }) => {
      const check = await deps.checkPin({ accountId: account.accountId }, body.pin);
      if (check.outcome === "locked") {
        throw new ApiError(429, "account_locked");
      }
      if (check.outcome === "failed") {
        throw new ApiError(401, "sign_in_failed");
      }
      await account.deleteAccount();
      clearSessionCookie(reply);
      return { deleted: true as const };
    },
  });
}
