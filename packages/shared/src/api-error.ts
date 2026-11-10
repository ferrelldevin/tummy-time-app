import { z } from "zod";

/**
 * Every error the API sends has this one shape: { "error": { "code", "message" } }.
 * The web app shows its own words for each code from the string catalog; `message` is a plain
 * fallback and never carries internal details.
 */
export const apiErrorCodes = [
  "bad_request",
  "not_found",
  "payload_too_large",
  "unsupported_media_type",
  "rate_limited",
  "internal_error",
  // Block 4: sign-in and sessions.
  "unauthorized",
  "forbidden",
  "sign_in_failed",
  "account_locked",
  "weak_pin",
] as const;

export type ApiErrorCode = (typeof apiErrorCodes)[number];

export const apiErrorSchema = z.strictObject({
  error: z.strictObject({
    code: z.enum(apiErrorCodes),
    message: z.string().min(1),
  }),
});

export type ApiErrorBody = z.infer<typeof apiErrorSchema>;
