import { z } from "./zod.js";

/**
 * Lesson and safety card files (ADR 0006). Everything in `content/` is checked against these
 * schemas by `packages/shared/test/content.test.ts`, which runs under `pnpm test` and in CI.
 *
 * Messages are written for a person who edits a content file, not for a programmer.
 */

/**
 * The emergency line is fixed text. The safety card schema accepts only this exact sentence and
 * the screen always shows this constant, never the file's copy, so editing a content file
 * cannot drop or change it. Source: docs/knowledge/content-style-guide.md, "Safety wording".
 */
export const EMERGENCY_LINE = "Trouble breathing or turning blue: call 911.";

export const PLACEHOLDER = "placeholder";
export const APPROVED = "approved";

/** A path on our own server, such as /media/step-1.jpg. No scheme, no host, no "//". */
const sameOriginPath = z
  .string()
  .regex(
    /^\/(?![/\\])[^\s\\]*$/,
    "must be a path on our own server that starts with one / (for example /media/step-1.jpg). Links to other websites are not allowed",
  );

const text = z.string().trim().min(1, "cannot be empty");

const lessonId = z
  .string()
  .regex(
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    "use only lowercase letters, numbers and single dashes (for example first-lesson)",
  );

const approval = {
  status: z.enum([PLACEHOLDER, APPROVED], {
    error: 'must be exactly "placeholder" or "approved"',
  }),
  approvedBy: z.string().trim().optional(),
  approvedOn: z.iso.date("must be a date written like YYYY-MM-DD").optional(),
};

/** `approved` needs the clinician's name and the date. This is the rule CI enforces. */
function requireApproval(
  value: { status: string; approvedBy?: string | undefined; approvedOn?: string | undefined },
  ctx: z.RefinementCtx,
): void {
  if (value.status !== APPROVED) {
    return;
  }
  if (!value.approvedBy) {
    ctx.addIssue({
      code: "custom",
      path: ["approvedBy"],
      message:
        'is required when status is "approved": write the name of the clinician who signed off',
    });
  }
  if (!value.approvedOn) {
    ctx.addIssue({
      code: "custom",
      path: ["approvedOn"],
      message:
        'is required when status is "approved": write the date of the sign-off as YYYY-MM-DD',
    });
  }
}

const stepSchema = z
  .strictObject({
    text,
    image: sameOriginPath.optional(),
    alt: z.string().trim().optional(),
  })
  .superRefine((step, ctx) => {
    if (step.image && !step.alt) {
      ctx.addIssue({
        code: "custom",
        path: ["alt"],
        message:
          "is required when a step has an image: describe the picture for someone who cannot see it",
      });
    }
  });

/** Raw HTML is not allowed in lesson text. The page also refuses to show it (see Markdown.tsx). */
const HTML_TAG = /<\/?[a-z!][^>]*>/i;

export const lessonSchema = z
  .strictObject({
    id: lessonId,
    title: text,
    goal: text,
    body: z
      .string()
      .refine((b) => !HTML_TAG.test(b), "raw HTML is not allowed: use plain Markdown only"),
    steps: z.array(stepSchema).default([]),
    videoUrl: sameOriginPath.optional(),
    captionsUrl: sameOriginPath.optional(),
    transcript: z.string().trim().optional(),
    // Questions arrive in Block 12. Until then this stays empty.
    checks: z.array(z.never()).optional(),
    pathways: z
      .array(z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "use lowercase tags with dashes"))
      .default([]),
    ...approval,
  })
  .superRefine((lesson, ctx) => {
    requireApproval(lesson, ctx);
    if (lesson.videoUrl) {
      if (!lesson.captionsUrl) {
        ctx.addIssue({
          code: "custom",
          path: ["captionsUrl"],
          message: "is required when there is a video: every video needs captions",
        });
      }
      if (!lesson.transcript) {
        ctx.addIssue({
          code: "custom",
          path: ["transcript"],
          message: "is required when there is a video: every video needs a transcript",
        });
      }
    }
  });

export type Lesson = z.infer<typeof lessonSchema>;

export const safetyCardSchema = z
  .strictObject({
    emergencyLine: z.literal(EMERGENCY_LINE, {
      error: `must be exactly: ${EMERGENCY_LINE}`,
    }),
    callToday: z.array(text).min(1, "needs at least one item"),
    ...approval,
  })
  .superRefine(requireApproval);

export type SafetyCard = z.infer<typeof safetyCardSchema>;

export type ParseResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

export function describeIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const where = issue.path.length > 0 ? issue.path.join(".") : "file";
    return `${where}: ${issue.message}`;
  });
}

/** Reads the safety card file (JSON). */
export function parseSafetyCardFile(source: string): ParseResult<SafetyCard> {
  let data: unknown;
  try {
    data = JSON.parse(source);
  } catch {
    return { ok: false, errors: ["file: is not valid JSON (check commas, quotes and brackets)"] };
  }
  const result = safetyCardSchema.safeParse(data);
  return result.success
    ? { ok: true, value: result.data }
    : { ok: false, errors: describeIssues(result.error) };
}
