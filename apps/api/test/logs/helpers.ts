import { randomUUID } from "node:crypto";
import type { LightMyRequestResponse } from "fastify";
import type { LogEntry, LogsPage } from "@tummy/shared";
import { SAME_SITE } from "../same-site.js";
import { cookieHeader, type AuthTestApp } from "../auth/helpers.js";

/** A made-up tummy time: a start time a little before the test clock's "now", 5 minutes long. */
export function sampleEntry(t: AuthTestApp, minutesAgo = 30, durationSeconds = 300) {
  return {
    startedAt: new Date(t.clock.now().getTime() - minutesAgo * 60_000).toISOString(),
    durationSeconds,
  };
}

export function newId(): string {
  return randomUUID();
}

export function putLog(
  t: AuthTestApp,
  token: string,
  id: string,
  payload: unknown,
): Promise<LightMyRequestResponse> {
  return t.app.inject({
    method: "PUT",
    url: `/api/logs/${id}`,
    headers: { ...SAME_SITE, ...cookieHeader(token) },
    payload: payload as Record<string, unknown>,
  });
}

export function deleteLog(
  t: AuthTestApp,
  token: string,
  id: string,
): Promise<LightMyRequestResponse> {
  return t.app.inject({
    method: "DELETE",
    url: `/api/logs/${id}`,
    headers: { ...SAME_SITE, ...cookieHeader(token) },
  });
}

export function getLogs(
  t: AuthTestApp,
  token: string,
  since?: number | string,
): Promise<LightMyRequestResponse> {
  return t.app.inject({
    method: "GET",
    url: since === undefined ? "/api/logs" : `/api/logs?since=${String(since)}`,
    headers: cookieHeader(token),
  });
}

/** PUT that must succeed; answers the stored entry. */
export async function put(
  t: AuthTestApp,
  token: string,
  id: string,
  payload: unknown,
): Promise<LogEntry> {
  const res = await putLog(t, token, id, payload);
  if (res.statusCode !== 200) {
    throw new Error(`PUT failed: ${String(res.statusCode)} ${res.body}`);
  }
  return res.json<LogEntry>();
}

export async function pull(t: AuthTestApp, token: string, since?: number): Promise<LogsPage> {
  const res = await getLogs(t, token, since);
  if (res.statusCode !== 200) {
    throw new Error(`GET failed: ${String(res.statusCode)} ${res.body}`);
  }
  return res.json<LogsPage>();
}

/**
 * What a phone does: starting from `since`, asks again with each answer's latestRev while
 * `more` is true. Answers every page it got.
 */
export async function pullAll(t: AuthTestApp, token: string, since = 0): Promise<LogsPage[]> {
  const pages: LogsPage[] = [];
  let next = since;
  for (;;) {
    const page = await pull(t, token, next);
    pages.push(page);
    next = page.latestRev;
    if (!page.more) return pages;
  }
}
