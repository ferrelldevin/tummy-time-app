import type { z } from "zod";
import type { AuthMethod } from "@tummy/shared";
import type { AccountId } from "../db/account-scope.js";

/**
 * THE SIGN-IN SEAM (ADR 0003). Routes call only this interface, never a provider directly, so
 * the sign-in method can change (for example to an emailed code) without touching the routes,
 * the sessions or the account data.
 *
 * Each step has a start and a finish, so a method that needs two round trips (send a code, then
 * check it) fits. The family-code-pin provider does its real work in the finish steps.
 *
 * A provider proves who someone is and answers with an account ID. It never sets cookies or
 * starts sessions: src/auth/routes.ts does that the same way for every provider.
 */

export interface ProviderInputs {
  /** Body schema for each step, strict. A step with no schema accepts no body. */
  startSignUp?: z.ZodObject;
  finishSignUp: z.ZodObject;
  startSignIn?: z.ZodObject;
  finishSignIn: z.ZodObject;
}

export interface StartResult {
  method: AuthMethod;
}

export type SignUpResult =
  /** The family code is shown once, then forgotten. It is never stored or logged. */
  { outcome: "created"; accountId: AccountId; familyCode: string } | { outcome: "weak_pin" };

export type SignInResult =
  | { outcome: "signed_in"; accountId: AccountId }
  /** Unknown family code or wrong PIN: deliberately the same answer. */
  | { outcome: "failed" }
  /** Only reachable with a real family code: a stranger never sees it. */
  | { outcome: "locked" };

export interface AuthProvider {
  readonly method: AuthMethod;
  readonly inputs: ProviderInputs;
  startSignUp(input: unknown): Promise<StartResult>;
  finishSignUp(input: unknown): Promise<SignUpResult>;
  startSignIn(input: unknown): Promise<StartResult>;
  finishSignIn(input: unknown): Promise<SignInResult>;
}
