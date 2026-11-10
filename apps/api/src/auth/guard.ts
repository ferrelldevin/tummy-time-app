import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { z } from "zod";
import { forAccount, type AccountScope } from "../db/account-scope.js";
import type { Db } from "../db/client.js";
import { ApiError, defineRoute, type RouteSpec } from "../http/api-rules.js";
import { sessionCookie, type ActiveSession, type SessionService } from "./sessions.js";

/**
 * THE SIGN-IN GUARD. A route that needs a signed-in account is added with defineAccountRoute().
 * Before its inputs are even read, the guard turns the session cookie into an account ID that
 * the database vouches for, or refuses with 401. The handler never sees an ID from the request:
 * it gets `account`, which is forAccount(db, <that ID>), the one door to the account's rows.
 */

const signedIn = new WeakMap<FastifyRequest, ActiveSession>();

export interface GuardDeps {
  db: Db;
  sessions: SessionService;
}

type ObjectSchema = z.ZodObject;

export interface AccountRouteSpec<
  P extends ObjectSchema,
  Q extends ObjectSchema,
  B extends ObjectSchema,
  R extends z.ZodType,
> extends Omit<RouteSpec<P, Q, B, R>, "handler" | "preHandler"> {
  handler: (input: {
    params: z.infer<P>;
    query: z.infer<Q>;
    body: z.infer<B>;
    request: FastifyRequest;
    reply: FastifyReply;
    account: AccountScope;
    session: ActiveSession;
  }) => z.input<R> | Promise<z.input<R>>;
}

export function defineAccountRoute<
  P extends ObjectSchema = z.ZodObject,
  Q extends ObjectSchema = z.ZodObject,
  B extends ObjectSchema = z.ZodObject,
  R extends z.ZodType = z.ZodType,
>(app: FastifyInstance, deps: GuardDeps, spec: AccountRouteSpec<P, Q, B, R>): void {
  defineRoute<P, Q, B, R>(app, {
    ...spec,
    preHandler: async (request) => {
      const session = await deps.sessions.resolve(sessionCookie(request));
      if (session === null) {
        throw new ApiError(401, "unauthorized");
      }
      signedIn.set(request, session);
    },
    handler: (input) => {
      const session = signedIn.get(input.request);
      if (session === undefined) {
        // Cannot happen: the preHandler above runs first. Refuse rather than guess.
        throw new ApiError(401, "unauthorized");
      }
      return spec.handler({ ...input, session, account: forAccount(deps.db, session.accountId) });
    },
  });
}
