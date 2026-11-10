import { useState } from "react";
import { Alert } from "../components/Alert";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Dialog } from "../components/Dialog";
import { Link } from "../components/Link";
import { Page } from "../components/Page";
import { Spinner } from "../components/Spinner";
import { EmptyState, ErrorState, LoadingState, OfflineNotice } from "../components/StateViews";
import { TextField } from "../components/TextField";
import { styleguideText as t } from "../strings/styleguide.en";
import "./styleguide.css";

const colorTokens = [
  "--color-bg",
  "--color-surface",
  "--color-text",
  "--color-text-muted",
  "--color-primary",
  "--color-accent",
  "--color-danger",
  "--color-success",
  "--color-info-bg",
  "--color-success-bg",
  "--color-danger-bg",
  "--color-border",
  "--color-focus",
] as const;

/** Development only. Shows every base component and standard state on one page. */
export default function Styleguide() {
  const [open, setOpen] = useState(false);
  return (
    <Page title={t.title}>
      <p>{t.intro}</p>
      <p>{t.skipLinkNote}</p>

      <section className="stack" aria-labelledby="sg-colors">
        <h2 id="sg-colors">{t.colors}</h2>
        <ul className="sg-swatches">
          {colorTokens.map((name) => (
            <li key={name} className="sg-swatch">
              <div className="sg-swatch__chip" style={{ background: `var(${name})` }} />
              <code>{name}</code>
            </li>
          ))}
        </ul>
      </section>

      <section className="stack" aria-labelledby="sg-type">
        <h2 id="sg-type">{t.type}</h2>
        <p style={{ fontSize: "var(--font-size-h1)" }}>h1</p>
        <p style={{ fontSize: "var(--font-size-h2)" }}>h2</p>
        <p style={{ fontSize: "var(--font-size-h3)" }}>h3</p>
        <p style={{ fontSize: "var(--font-size-lead)" }}>lead</p>
        <p>body</p>
      </section>

      <section className="stack" aria-labelledby="sg-buttons">
        <h2 id="sg-buttons">{t.buttons}</h2>
        <Button>{t.primary}</Button>
        <Button variant="secondary">{t.secondary}</Button>
        <Button disabled>{t.disabled}</Button>
        <Link to="/">{t.linkExample}</Link>
      </section>

      <section className="stack" aria-labelledby="sg-field">
        <h2 id="sg-field">{t.field}</h2>
        <TextField label={t.fieldLabel} hint={t.fieldHint} />
        <TextField label={t.fieldErrorLabel} error={t.fieldError} />
      </section>

      <section className="stack" aria-labelledby="sg-card">
        <h2 id="sg-card">{t.card}</h2>
        <Card title={t.cardTitle} headingLevel={3}>
          <p>{t.cardBody}</p>
        </Card>
      </section>

      <section className="stack" aria-labelledby="sg-alerts">
        <h2 id="sg-alerts">{t.alerts}</h2>
        <Alert kind="info">{t.alertInfo}</Alert>
        <Alert kind="success">{t.alertSuccess}</Alert>
        <Alert kind="error">{t.alertError}</Alert>
      </section>

      <section className="stack" aria-labelledby="sg-spinner">
        <h2 id="sg-spinner">{t.spinner}</h2>
        <Spinner />
      </section>

      <section className="stack" aria-labelledby="sg-states">
        <h2 id="sg-states">{t.states}</h2>
        <LoadingState />
        <EmptyState />
        <ErrorState onRetry={() => undefined} />
        <OfflineNotice />
      </section>

      <section className="stack" aria-labelledby="sg-dialog">
        <h2 id="sg-dialog">{t.dialog}</h2>
        <Button
          onClick={() => {
            setOpen(true);
          }}
        >
          {t.openDialog}
        </Button>
        <Dialog
          open={open}
          onClose={() => {
            setOpen(false);
          }}
          title={t.dialogTitle}
        >
          <p>{t.dialogBody}</p>
        </Dialog>
      </section>
    </Page>
  );
}
