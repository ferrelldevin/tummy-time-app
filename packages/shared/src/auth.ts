import { z } from "./zod.js";
import { FAMILY_CODE_INPUT_MAX, PIN_PATTERN } from "./family-code.js";

/**
 * Request and answer shapes for sign-in, sign-up and the account (Block 4). The API checks every
 * request and answer against these; the web app reads answers with them.
 */

export const authMethods = ["family-code-pin", "dev-fake"] as const;
export type AuthMethod = (typeof authMethods)[number];

const pin = z.string().regex(PIN_PATTERN);
const familyCode = z.string().min(1).max(FAMILY_CODE_INPUT_MAX);

/** Answer to sign-up/start and sign-in/start: which method this server uses. */
export const authStartResponseSchema = z.strictObject({ method: z.enum(authMethods) });

/** family-code-pin: sign-up chooses a PIN; the server makes the family code. */
export const signUpFinishBodySchema = z.strictObject({ pin });
/** family-code-pin: sign-in takes the code (with or without spaces and dashes) and the PIN. */
export const signInFinishBodySchema = z.strictObject({ familyCode, pin });

/** dev-fake (development and test only): sign in with the family code alone. */
export const devFakeSignInFinishBodySchema = z.strictObject({ familyCode });

/** Sent once, right after sign-up. Formatted as three groups of four. Never stored or logged. */
export const signUpFinishResponseSchema = z.strictObject({ familyCode: z.string() });
export const signInFinishResponseSchema = z.strictObject({ signedIn: z.literal(true) });
export const signedOutResponseSchema = z.strictObject({ signedOut: z.literal(true) });

/** GET /api/me: only what the screens need. No hashes, no counters. */
export const meResponseSchema = z.strictObject({
  signedIn: z.literal(true),
  /** How many phones (sessions) are signed in to this account now, this one included. */
  phonesSignedIn: z.number().int().min(1),
});
export type MeResponse = z.infer<typeof meResponseSchema>;

/** DELETE /api/me asks for the PIN again. */
export const deleteMeBodySchema = z.strictObject({ pin });
export const deleteMeResponseSchema = z.strictObject({ deleted: z.literal(true) });
