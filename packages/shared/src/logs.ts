import { z } from "./zod.js";

/**
 * Request and answer shapes for the tummy time log and its sync (Block 6, ADR 0005, ADR 0009).
 * The API checks every request and answer against these; the web app reads answers with them
 * and uses the same limits in its own form checks.
 */

/** Shortest and longest tummy time the log takes. The database has the same check. */
export const LOG_MIN_DURATION_SECONDS = 1;
export const LOG_MAX_DURATION_SECONDS = 7200;

/**
 * How far in the future a start time may be. A start time is never really in the future, but
 * phone clocks drift by a minute or two, and an entry saved by a phone whose clock runs a little
 * fast must not be refused for ever.
 */
export const LOG_MAX_FUTURE_MS = 5 * 60 * 1000;

/** How far back a start time may be: 365 days. */
export const LOG_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

/** The most entries one GET /api/logs answer carries. The phone asks again while `more` is true. */
export const LOG_PAGE_SIZE = 500;

/**
 * An entry ID: a UUID in its lowercase, dashed form, made on the phone. Upper case, braces or a
 * missing dash are refused, so one entry can only ever be written one way.
 */
export const logIdSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  .pipe(z.uuid());

/** A time with its offset from UTC ("Z" or "+02:00"), to the second or finer. */
const isoTime = z.iso.datetime({ offset: true });

/** True when a start time is inside the window the log accepts, measured from `now`. */
export function isAllowedStartTime(startedAt: Date, now: Date): boolean {
  const t = startedAt.getTime();
  return (
    !Number.isNaN(t) &&
    t <= now.getTime() + LOG_MAX_FUTURE_MS &&
    t >= now.getTime() - LOG_MAX_AGE_MS
  );
}

export const logParamsSchema = z.strictObject({ id: logIdSchema });

/** PUT /api/logs/:id: the whole entry. It creates the entry, replaces it, or brings it back. */
export const putLogBodySchema = z.strictObject({
  startedAt: isoTime,
  durationSeconds: z.number().int().min(LOG_MIN_DURATION_SECONDS).max(LOG_MAX_DURATION_SECONDS),
});
export type PutLogBody = z.infer<typeof putLogBodySchema>;

/**
 * GET /api/logs?since=<rev>. A whole number, 0 or more, written plainly (no sign, no leading
 * zeros, no exponent), no bigger than JavaScript can count exactly.
 */
export const logsQuerySchema = z.strictObject({
  since: z
    .string()
    .regex(/^(0|[1-9][0-9]{0,15})$/)
    .transform(Number)
    .pipe(z.number().int().min(0).max(Number.MAX_SAFE_INTEGER))
    .optional(),
});

/** One entry as the API sends it. `deletedAt` is set when it was deleted, so deletes sync. */
export const logEntrySchema = z.strictObject({
  id: logIdSchema,
  startedAt: isoTime,
  durationSeconds: z.number().int().min(LOG_MIN_DURATION_SECONDS).max(LOG_MAX_DURATION_SECONDS),
  rev: z.number().int().min(1),
  deletedAt: isoTime.nullable(),
});
export type LogEntry = z.infer<typeof logEntrySchema>;

/**
 * GET /api/logs answer. `entries` are in rev order. `latestRev` is the highest rev in this
 * answer, or the `since` that was asked for when there are none: the phone asks with it next.
 */
export const logsPageSchema = z.strictObject({
  entries: z.array(logEntrySchema).max(LOG_PAGE_SIZE),
  latestRev: z.number().int().min(0),
  more: z.boolean(),
});
export type LogsPage = z.infer<typeof logsPageSchema>;
