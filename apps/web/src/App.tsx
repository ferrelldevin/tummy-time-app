import { lazy, Suspense } from "react";
import type { ReactNode } from "react";
import { Route, Routes } from "react-router";
import { AppShell } from "./components/AppShell";
import { LoadingState } from "./components/StateViews";
import { WhenToCallRoute } from "./pages/WhenToCallRoute";
import { Account } from "./pages/account/Account";
import { CreateAccount } from "./pages/account/CreateAccount";
import { RequireSignIn } from "./pages/account/RequireSignIn";
import { SignedOut } from "./pages/account/SignedOut";
import { SignIn } from "./pages/account/SignIn";
import { Welcome } from "./pages/account/Welcome";
import { AddToHomeScreen } from "./pages/AddToHomeScreen";
import { Home } from "./pages/Home";
import { NotFound } from "./pages/NotFound";
import { Placeholder } from "./pages/Placeholder";
import { SessionProvider } from "./session";
import { en } from "./strings/en";

// The style guide exists only in development. In a production build this is `null`, the
// dynamic import is removed, and scripts/check-no-styleguide.mjs proves it.
const Styleguide = import.meta.env.DEV ? lazy(() => import("./pages/Styleguide")) : null;

// Lessons load as their own file when a caregiver opens them. The YAML reader and the Markdown
// reader live there, which keeps first load small. "When to call" is NOT lazy: it opens at once.
const LessonsRoute = lazy(() =>
  import("./pages/ContentRoutes").then((m) => ({ default: m.LessonsRoute })),
);
const LessonRoute = lazy(() =>
  import("./pages/ContentRoutes").then((m) => ({ default: m.LessonRoute })),
);

// The log screens need sign-in and load as their own file, with the sync engine and IndexedDB
// code, so Home, Lessons and When to call never pay for them.
const StartTummyTimeRoute = lazy(() =>
  import("./pages/log/LogRoutes").then((m) => ({ default: m.StartTummyTime })),
);
const LogRoute = lazy(() => import("./pages/log/LogRoutes").then((m) => ({ default: m.LogPage })));
const AddTimeRoute = lazy(() =>
  import("./pages/log/LogRoutes").then((m) => ({ default: m.AddTime })),
);

function SignedInLazy({ children }: { children: ReactNode }) {
  return (
    <RequireSignIn>
      <Suspense fallback={<LoadingState />}>{children}</Suspense>
    </RequireSignIn>
  );
}

export function App() {
  return (
    <SessionProvider>
      <AppRoutes />
    </SessionProvider>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Home />} />
        <Route
          path="start-tummy-time"
          element={
            <SignedInLazy>
              <StartTummyTimeRoute />
            </SignedInLazy>
          }
        />
        <Route
          path="baby-crying"
          element={<Placeholder title={en.babyCrying.title} text={en.babyCrying.placeholder} />}
        />
        <Route path="when-to-call" element={<WhenToCallRoute />} />
        <Route
          path="lessons"
          element={
            <Suspense fallback={<LoadingState />}>
              <LessonsRoute />
            </Suspense>
          }
        />
        <Route
          path="lessons/:id"
          element={
            <Suspense fallback={<LoadingState />}>
              <LessonRoute />
            </Suspense>
          }
        />
        <Route
          path="log"
          element={
            <SignedInLazy>
              <LogRoute />
            </SignedInLazy>
          }
        />
        <Route
          path="log/add"
          element={
            <SignedInLazy>
              <AddTimeRoute />
            </SignedInLazy>
          }
        />
        <Route path="add-to-home-screen" element={<AddToHomeScreen />} />
        <Route path="welcome" element={<Welcome />} />
        <Route path="create-account" element={<CreateAccount />} />
        <Route path="sign-in" element={<SignIn />} />
        <Route path="signed-out" element={<SignedOut />} />
        <Route
          path="account"
          element={
            <RequireSignIn>
              <Account />
            </RequireSignIn>
          }
        />
        {Styleguide ? (
          <Route
            path="styleguide"
            element={
              <Suspense fallback={<LoadingState />}>
                <Styleguide />
              </Suspense>
            }
          />
        ) : null}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
