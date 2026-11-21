import { useState } from "react";
import { formatFamilyCode } from "@tummy/shared";
import { Alert } from "../components/Alert";
import { Button } from "../components/Button";
import { DEMO_FAMILY_CODE, DEMO_PIN, resetDemoServer } from "../demo/demo-server";
import { wipeLocalData } from "../log/local-data";
import { planStore } from "../plan/store";
import { en } from "../strings/en";

/**
 * DEMO BUILD ONLY (About renders it when __DEMO__ is true, so other builds drop it). Shows the
 * sample family's code and PIN and puts the whole demo back to the start for the next viewer.
 */
export function DemoPanel() {
  const [reset, setReset] = useState(false);
  return (
    <section className="soft-card soft-card--teal stack demo-panel" aria-labelledby="demo-title">
      <h2 id="demo-title">{en.about.demoTitle}</h2>
      <p>{en.about.demoBody}</p>
      <dl className="demo-panel__codes">
        <dt>{en.about.demoCode}</dt>
        <dd className="family-code">{formatFamilyCode(DEMO_FAMILY_CODE)}</dd>
        <dt>{en.about.demoPin}</dt>
        <dd className="family-code">{DEMO_PIN}</dd>
      </dl>
      <Button
        onClick={() => {
          resetDemoServer();
          planStore.clear();
          void wipeLocalData().then(() => {
            window.location.reload();
          });
          setReset(true);
        }}
      >
        {en.about.demoReset}
      </Button>
      <div role="status">
        {reset ? <Alert kind="success">{en.about.demoResetDone}</Alert> : null}
      </div>
    </section>
  );
}
