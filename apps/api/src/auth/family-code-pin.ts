import { formatFamilyCode, signInFinishBodySchema, signUpFinishBodySchema } from "@tummy/shared";
import { forAccount } from "../db/account-scope.js";
import type { Db } from "../db/client.js";
import { credentialStore } from "./credential-store.js";
import { codeLookup, generateFamilyCode, readFamilyCode } from "./family-code.js";
import type { PinHasher } from "./pin-hash.js";
import type { CheckPin } from "./pin-check.js";
import { isCommonPin } from "./pin-rules.js";
import type { AuthProvider, SignInResult, SignUpResult } from "./provider.js";

/**
 * The default provider (ADR 0003): a 12-character family code made by the server, plus a
 * 6-digit PIN the caregiver chooses.
 */

export interface PinProviderDeps {
  db: Db;
  secret: Buffer;
  hasher: PinHasher;
  checkPin: CheckPin;
  /** When false (dev-fake only), common PINs are allowed. */
  refuseCommonPins?: boolean;
}

/** A fresh code colliding with an existing one is about 1 in 2^59; retrying covers it. */
const CREATE_TRIES = 3;

export async function createAccountWithPin(
  deps: PinProviderDeps,
  pin: string,
): Promise<SignUpResult> {
  if ((deps.refuseCommonPins ?? true) && isCommonPin(pin)) {
    return { outcome: "weak_pin" };
  }
  const pinHash = await deps.hasher.hash(pin);
  for (let i = 0; i < CREATE_TRIES; i += 1) {
    const code = generateFamilyCode();
    const accountId = await credentialStore(deps.db).createAccount(
      codeLookup(deps.secret, code),
      pinHash,
    );
    if (accountId !== null) {
      await forAccount(deps.db, accountId).audit.record("sign_up");
      return { outcome: "created", accountId, familyCode: formatFamilyCode(code) };
    }
  }
  throw new Error("Could not make a unique family code.");
}

export function familyCodePinProvider(deps: PinProviderDeps): AuthProvider {
  return {
    method: "family-code-pin",
    inputs: { finishSignUp: signUpFinishBodySchema, finishSignIn: signInFinishBodySchema },

    startSignUp: () => Promise.resolve({ method: "family-code-pin" }),

    finishSignUp(input) {
      const { pin } = signUpFinishBodySchema.parse(input);
      return createAccountWithPin(deps, pin);
    },

    startSignIn: () => Promise.resolve({ method: "family-code-pin" }),

    async finishSignIn(input): Promise<SignInResult> {
      const { familyCode, pin } = signInFinishBodySchema.parse(input);
      const code = readFamilyCode(familyCode);
      // A code that cannot exist is handled exactly like one that does not: same work, same
      // answer. The lookup value is computed from something that matches no account.
      const lookup = codeLookup(deps.secret, code ?? `not-a-code:${familyCode}`);
      const result = await deps.checkPin({ codeLookup: lookup }, pin);
      return result.outcome === "ok"
        ? { outcome: "signed_in", accountId: result.accountId }
        : { outcome: result.outcome };
    },
  };
}
