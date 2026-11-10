import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { ErrorState, LoadingState } from "../../components/StateViews";
import { useSession } from "../../session";

/**
 * Only the Log and the account screens need sign-in. Home, Lessons and When to call never do.
 * Signed out: the Welcome screen (or Signed out, right after signing out). Still asking the server: the loading state. Server not
 * reachable: the error state with Try again.
 */
export function RequireSignIn({ children }: { children: ReactNode }) {
  const { status, refresh, signedOutReason } = useSession();
  if (status === "checking") return <LoadingState />;
  if (status === "error") return <ErrorState onRetry={() => void refresh()} />;
  if (status === "signedOut") {
    // Just signed out or deleted from this screen: say so, rather than the Welcome screen.
    return <Navigate to={signedOutReason ? "/signed-out" : "/welcome"} replace />;
  }
  return children;
}
