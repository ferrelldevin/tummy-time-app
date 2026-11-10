import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { meResponseSchema } from "@tummy/shared";
import { apiCall } from "./api";

/**
 * Whether this phone is signed in, learned from GET /api/me. Held in memory only: nothing is
 * written to localStorage, sessionStorage, IndexedDB or a readable cookie. The session cookie
 * itself is HttpOnly, so no script on the page can read it.
 */
export type SessionStatus = "checking" | "signedIn" | "signedOut" | "error";
export type SignedOutReason = "thisPhone" | "everywhere" | "deleted";

export interface SessionState {
  status: SessionStatus;
  phonesSignedIn: number;
  /** Why the last sign-out happened, for the Signed out screen. Memory only. */
  signedOutReason: SignedOutReason | null;
  refresh: () => Promise<void>;
  markSignedOut: (reason: SignedOutReason) => void;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>("checking");
  const [phonesSignedIn, setPhones] = useState(0);
  const [signedOutReason, setReason] = useState<SignedOutReason | null>(null);

  const refresh = useCallback(async () => {
    const result = await apiCall("/api/me", meResponseSchema);
    if (result.ok) {
      setPhones(result.data.phonesSignedIn);
      setReason(null);
      setStatus("signedIn");
    } else if (result.error === "unauthorized") {
      setStatus("signedOut");
    } else {
      setStatus("error");
    }
  }, []);

  const markSignedOut = useCallback((reason: SignedOutReason) => {
    setReason(reason);
    setPhones(0);
    setStatus("signedOut");
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ status, phonesSignedIn, signedOutReason, refresh, markSignedOut }),
    [status, phonesSignedIn, signedOutReason, refresh, markSignedOut],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const value = useContext(SessionContext);
  if (value === null) {
    throw new Error("useSession() needs a <SessionProvider> above it.");
  }
  return value;
}
