import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router";
import { AppShell } from "./components/AppShell";
import { LoadingState } from "./components/StateViews";
import { Home } from "./pages/Home";
import { NotFound } from "./pages/NotFound";
import { Placeholder } from "./pages/Placeholder";
import { en } from "./strings/en";

// The style guide exists only in development. In a production build this is `null`, the
// dynamic import is removed, and scripts/check-no-styleguide.mjs proves it.
const Styleguide = import.meta.env.DEV ? lazy(() => import("./pages/Styleguide")) : null;

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Home />} />
        <Route
          path="start-tummy-time"
          element={
            <Placeholder title={en.startTummyTime.title} text={en.startTummyTime.placeholder} />
          }
        />
        <Route
          path="baby-crying"
          element={<Placeholder title={en.babyCrying.title} text={en.babyCrying.placeholder} />}
        />
        <Route
          path="when-to-call"
          element={<Placeholder title={en.whenToCall.title} text={en.whenToCall.placeholder} />}
        />
        <Route
          path="lessons"
          element={<Placeholder title={en.lessons.title} text={en.lessons.placeholder} />}
        />
        <Route
          path="log"
          element={<Placeholder title={en.log.title} text={en.log.placeholder} />}
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
