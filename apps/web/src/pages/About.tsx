import { lazy, Suspense, useState } from "react";
import { Alert } from "../components/Alert";
import { Button } from "../components/Button";
import { Illustration } from "../components/Illustration";
import { Page } from "../components/Page";
import { planStore } from "../plan/store";
import { en } from "../strings/en";

// Demo build only. In every other build __DEMO__ is false and this import is dropped.
const DemoPanel = __DEMO__
  ? lazy(() => import("./DemoPanel").then((m) => ({ default: m.DemoPanel })))
  : null;

/** What this app is, what is still a draft, what it keeps, and "Start over" on this phone. */
export function About() {
  const [cleared, setCleared] = useState(false);
  return (
    <Page title={en.about.title}>
      <Illustration scene="welcome" tone={1} className="hero-art" />
      {DemoPanel ? (
        <Suspense fallback={null}>
          <DemoPanel />
        </Suspense>
      ) : null}
      <section className="soft-card soft-card--sun stack" aria-labelledby="about-draft">
        <h2 id="about-draft">{en.about.draftTitle}</h2>
        <p>{en.about.draftBody}</p>
        <p>
          <strong>{en.about.notAdvice}</strong>
        </p>
      </section>
      <section className="stack" aria-labelledby="about-privacy">
        <h2 id="about-privacy">{en.about.privacyTitle}</h2>
        <p>{en.about.privacyBody}</p>
        <Button
          variant="secondary"
          onClick={() => {
            planStore.clear();
            setCleared(true);
          }}
        >
          {en.about.startOver}
        </Button>
        <div role="status">
          {cleared ? <Alert kind="success">{en.about.startOverDone}</Alert> : null}
        </div>
      </section>
      <p className="fine-print">{en.about.credits}</p>
    </Page>
  );
}
