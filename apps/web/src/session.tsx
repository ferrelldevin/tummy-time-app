import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { meResponseSchema } from "@tummy/shared";
import { apiCall } from "./api";
import { setUnauthorizedHandler, startLogSync, stopLogSync, wipeLocalData } from "./log/local-data";

/**
 * Whether this phone is signed in, learned from GET /api/me. Held in memory only: nothing about
 * the session is written to localStorage, sessionStorage, IndexedDB or a readable cookie. The
 * session cookie itself is HttpOnly, so no script on the page can read it.
 *
 * It also starts and ends this phone's copy of the log (src/log/local-data.ts): sync starts once
 * the server says this phone is signed in, and the copy is deleted the moment it is not, for any
 * reason: signed out here, signed out everywhere, account deleted, or a 401 from the server
 * (threat model #13).
 */
export type SessionStatus = "checking" | "signedIn" | "signedOut" | "error";
/** "ended": the server said this phone is no longer signed in (a 401 during sync). */
export type SignedOutReason = "thisPhone" | "everywhere" | "deleted" | "ended";

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
      // Loads the log code in the background and sends anything still in the outbox.
      startLogSync().catch(() => undefined);
    } else if (result.error === "unauthorized") {
      setStatus("signedOut");
      // Whatever an earlier session left on this phone (for example, signed out everywhere
      // from another phone while this one was closed) is deleted now.
      void wipeLocalData();
    } else {
      setStatus("error");
    }
  }, []);

  const markSignedOut = useCallback((reason: SignedOutReason) => {
    setReason(reason);
    setPhones(0);
    setStatus("signedOut");
    void wipeLocalData();
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      markSignedOut("ended");
    });
    void refresh();
    return () => {
      setUnauthorizedHandler(() => undefined);
      stopLogSync();
    };
  }, [refresh, markSignedOut]);

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
