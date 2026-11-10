import type { FastifyInstance } from "fastify";
import {
  LOG_PAGE_SIZE,
  isAllowedStartTime,
  logEntrySchema,
  logParamsSchema,
  logsPageSchema,
  logsQuerySchema,
  putLogBodySchema,
  type LogEntry,
} from "@tummy/shared";
import type { Clock } from "../auth/clock.js";
import { defineAccountRoute, type GuardDeps } from "../auth/guard.js";
import type { LogWriteResult, TummyLog } from "../db/account-scope.js";
import { ApiError } from "../http/api-rules.js";

/**
 * The tummy time log and its sync (Block 6, ADR 0005, ADR 0009).
 *
 * - PUT /api/logs/:id creates an entry, replaces it, or brings a deleted one back ("undo").
 *   The phone makes the ID. Answers the stored entry.
 * - DELETE /api/logs/:id marks the entry deleted. Answers the stored entry. Deleting an entry
 *   that is already deleted answers the same entry again and changes nothing.
 * - GET /api/logs?since=<rev> answers every entry changed after that rev, deleted ones included,
 *   in rev order, at most LOG_PAGE_SIZE at a time.
 *
 * An ID that does not exist for this account answers 404 on DELETE, and is never in a GET.
 * An ID that belongs to ANOTHER account answers exactly the same way on DELETE and GET, and 404
 * on PUT, and that entry is never read or changed (threat model #8).
 *
 * Every route is a defineAccountRoute(): no session, no access (401), and the handler reaches
 * rows only through `account`, which always filters by the signed-in account.
 */

export interface LogRouteDeps extends GuardDeps {
  clock: Clock;
}

function toWire(row: TummyLog): LogEntry {
  return {
    id: row.id,
    startedAt: row.startedAt.toISOString(),
    durationSeconds: row.durationSeconds,
    rev: row.rev,
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
  };
}

function answer(result: LogWriteResult): LogEntry {
  switch (result.outcome) {
    case "written":
    case "unchanged":
      return toWire(result.entry);
    case "not_found":
      throw new ApiError(404, "not_found");
    case "no_account":
      // The account was deleted while this request was on its way. Its sessions are gone too.
      throw new ApiError(401, "unauthorized");
  }
}

export function registerLogRoutes(app: FastifyInstance, deps: LogRouteDeps): void {
  const guard = { db: deps.db, sessions: deps.sessions };

  defineAccountRoute(app, guard, {
    method: "PUT",
    url: "/api/logs/:id",
    params: logParamsSchema,
    body: putLogBodySchema,
    response: logEntrySchema,
    handler: async ({ params, body, account }) => {
      const now = deps.clock.now();
      const startedAt = new Date(body.startedAt);
      // Not more than a few minutes ahead (phone clocks drift) and not before a year ago.
      if (!isAllowedStartTime(startedAt, now)) {
        throw new ApiError(400, "bad_request");
      }
      return answer(
        await account.logs.put(
          { id: params.id, startedAt, durationSeconds: body.durationSeconds },
          now,
        ),
      );
    },
  });

  defineAccountRoute(app, guard, {
    method: "DELETE",
    url: "/api/logs/:id",
    params: logParamsSchema,
    response: logEntrySchema,
    handler: async ({ params, account }) =>
      answer(await account.logs.markDeleted(params.id, deps.clock.now())),
  });

  defineAccountRoute(app, guard, {
    method: "GET",
    url: "/api/logs",
    querystring: logsQuerySchema,
    response: logsPageSchema,
    handler: async ({ query, account }) => {
      const changes = await account.logs.changesSince(query.since ?? 0, LOG_PAGE_SIZE);
      return {
        entries: changes.entries.map(toWire),
        latestRev: changes.latestRev,
        more: changes.more,
      };
    },
  });
}
