import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { meResponseSchema } from "@tummy/shared";
import { apiCall } from "./api";
import {
  localDataExists,
  setUnauthorizedHandler,
  startLogSync,
  stopLogSync,
  wipeLocalData,
} from "./log/local-data";

/**
 * Whether this phone is signed in, learned from GET /api/me. Held in memory only: nothing about
 * the session is written to localStorage, sessionStorage, IndexedDB or a readable cookie. The
 * session cookie itself is HttpOnly, so no script on the page can read it.
 *
 * It also starts and ends this phone's copy of the log (src/log/local-data.ts): sync starts once
 * the server says this phone is signed in, and the copy is deleted the moment it is not, for any
 * reason: signed out here, signed out everywhere, account deleted, or a 401 from the server
 * (threat model #13).
 *
 * OPENED WITH NO SIGNAL (Block 7). If /api/me cannot reach the server at all (not a 401, not an
 * error answer), the phone's copy of the log decides, and nothing new is stored to decide it:
 * that copy exists only while this phone is signed in, because every way of signing out deletes
 * it. So:
 * - the copy exists: signed in, not confirmed yet (`confirmed: false`). The log works from the
 *   copy, and /api/me is asked again when the phone is back online or the app comes back to the
 *   front. A 401 then deletes the copy, as always.
 * - no copy: signed out. Sign-in screens say that they need a connection.
 */
export type SessionStatus = "checking" | "signedIn" | "signedOut" | "error";
/** "ended": the server said this phone is no longer signed in (a 401 during sync). */
export type SignedOutReason = "thisPhone" | "everywhere" | "deleted" | "ended";

export interface SessionState {
  status: SessionStatus;
  /**
   * False when "signedIn" comes from this phone's copy of the log because the server could not
   * be reached. True once the server has said so.
   */
  confirmed: boolean;
  phonesSignedIn: number;
  /** Why the last sign-out happened, for the Signed out screen. Memory only. */
  signedOutReason: SignedOutReason | null;
  refresh: () => Promise<void>;
  markSignedOut: (reason: SignedOutReason) => void;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>("checking");
  const [confirmed, setConfirmed] = useState(false);
  const [phonesSignedIn, setPhones] = useState(0);
  const [signedOutReason, setReason] = useState<SignedOutReason | null>(null);
  /** The last /api/me could not reach the server, so it is asked again later. */
  const unreachable = useRef(false);
  /** Shown as signed in from the phone's copy, so a 401 now means "ended", not "never". */
  const signedInLocally = useRef(false);

  const markSignedOut = useCallback((reason: SignedOutReason) => {
    signedInLocally.current = false;
    unreachable.current = false;
    setReason(reason);
    setPhones(0);
    setConfirmed(false);
    setStatus("signedOut");
    void wipeLocalData();
  }, []);

  const refresh = useCallback(async () => {
    const result = await apiCall("/api/me", meResponseSchema);
    if (result.ok) {
      unreachable.current = false;
      signedInLocally.current = false;
      setPhones(result.data.phonesSignedIn);
      setReason(null);
      setConfirmed(true);
      setStatus("signedIn");
      // Loads the log code in the background and sends anything still in the outbox.
      startLogSync().catch(() => undefined);
    } else if (result.error === "unauthorized") {
      unreachable.current = false;
      if (signedInLocally.current) {
        // It looked signed in from the phone's copy; the server says it is not any more.
        markSignedOut("ended");
        return;
      }
      setConfirmed(false);
      setStatus("signedOut");
      // Whatever an earlier session left on this phone (for example, signed out everywhere
      // from another phone while this one was closed) is deleted now.
      void wipeLocalData();
    } else if (result.error === "network") {
      unreachable.current = true;
      const hasLocalCopy = await localDataExists();
      signedInLocally.current = hasLocalCopy;
      setConfirmed(false);
      setStatus(hasLocalCopy ? "signedIn" : "signedOut");
      if (hasLocalCopy) {
        // The log screens work from the phone's copy; changes wait in the outbox.
        startLogSync().catch(() => undefined);
      }
    } else {
      setStatus("error");
    }
  }, [markSignedOut]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      markSignedOut("ended");
    });
    void refresh();
    // Ask the server again once it may be reachable: back online, or back in front.
    const askAgain = () => {
      if (unreachable.current && document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("online", askAgain);
    document.addEventListener("visibilitychange", askAgain);
    return () => {
      window.removeEventListener("online", askAgain);
      document.removeEventListener("visibilitychange", askAgain);
      setUnauthorizedHandler(() => undefined);
      stopLogSync();
    };
  }, [refresh, markSignedOut]);

  const value = useMemo(
    () => ({ status, confirmed, phonesSignedIn, signedOutReason, refresh, markSignedOut }),
    [status, confirmed, phonesSignedIn, signedOutReason, refresh, markSignedOut],
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
