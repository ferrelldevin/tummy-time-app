import { useRef } from "react";
import { Outlet, useLocation } from "react-router";
import { useSession } from "../session";
import { en } from "../strings/en";
import { Link } from "./Link";
import { useOnline } from "../useOnline";
import { BottomBar } from "./BottomBar";
import { NavigatedContext } from "./Page";
import { SkipLink } from "./SkipLink";
import { OfflineNotice } from "./StateViews";

/** The frame around every screen: skip link, header, main area, offline notice, bottom bar. */
export function AppShell() {
  const { key } = useLocation();
  const firstKey = useRef(key);
  const navigated = useRef(false);
  // Set during render so it is correct before any Page effect runs. Safe to repeat.
  if (key !== firstKey.current) {
    navigated.current = true;
  }
  const online = useOnline();
  const { status } = useSession();

  return (
    <NavigatedContext.Provider value={navigated}>
      <div className="app-shell">
        <SkipLink targetId="main" />
        <header className="app-header">
          <span>{en.appName}</span>
          {status === "signedIn" ? (
            <Link to="/account" className="app-header__link">
              {en.account.headerAccount}
            </Link>
          ) : (
            <Link to="/sign-in" className="app-header__link">
              {en.account.headerSignIn}
            </Link>
          )}
        </header>
        <main id="main" className="app-main" tabIndex={-1}>
          {online ? null : <OfflineNotice />}
          <Outlet />
        </main>
        <BottomBar />
      </div>
    </NavigatedContext.Provider>
  );
}
