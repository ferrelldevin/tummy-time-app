import { devFakeSignInFinishBodySchema, signUpFinishBodySchema } from "@tummy/shared";
import { credentialStore } from "./credential-store.js";
import { isDevelopmentOrTest } from "./config.js";
import { codeLookup, readFamilyCode } from "./family-code.js";
import { createAccountWithPin, type PinProviderDeps } from "./family-code-pin.js";
import type { AuthProvider } from "./provider.js";

/**
 * dev-fake: a provider for development and browser tests ONLY (Block 4, step 11).
 * - Sign-up allows any 6-digit PIN, even 111111, so tests can use simple ones.
 * - Sign-in needs only the family code. No PIN, no lockout.
 * That is why it must never run anywhere real: it cannot be built unless NODE_ENV is
 * development or test, and src/auth/config.ts refuses to start the API with it otherwise.
 */

export class DevFakeRefused extends Error {
  constructor(nodeEnv: string) {
    super(`dev-fake only runs when NODE_ENV is development or test (it is "${nodeEnv}").`);
    this.name = "DevFakeRefused";
  }
}

export function devFakeProvider(deps: PinProviderDeps, nodeEnv: string): AuthProvider {
  if (!isDevelopmentOrTest(nodeEnv)) {
    throw new DevFakeRefused(nodeEnv);
  }
  const pinDeps = { ...deps, refuseCommonPins: false };
  return {
    method: "dev-fake",
    inputs: { finishSignUp: signUpFinishBodySchema, finishSignIn: devFakeSignInFinishBodySchema },

    startSignUp: () => Promise.resolve({ method: "dev-fake" }),

    finishSignUp(input) {
      const { pin } = signUpFinishBodySchema.parse(input);
      return createAccountWithPin(pinDeps, pin);
    },

    startSignIn: () => Promise.resolve({ method: "dev-fake" }),

    async finishSignIn(input) {
      const { familyCode } = devFakeSignInFinishBodySchema.parse(input);
      const code = readFamilyCode(familyCode);
      if (code === null) {
        return { outcome: "failed" };
      }
      const accountId = await credentialStore(deps.db).findAccountId(codeLookup(deps.secret, code));
      return accountId === null ? { outcome: "failed" } : { outcome: "signed_in", accountId };
    },
  };
}
