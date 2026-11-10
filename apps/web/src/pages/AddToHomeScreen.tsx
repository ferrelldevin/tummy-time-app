import { Button } from "../components/Button";
import { Page } from "../components/Page";
import { install, useCanInstall } from "../install/install-prompt";
import { en } from "../strings/en";

const t = en.install;

/**
 * How to put the app on the home screen. Public: no sign-in. Linked from Home and Account.
 *
 * CHECK BY HAND: a person must follow these steps on a real iPhone (Safari) and a real Android
 * phone (Chrome) and fix the words if the phones' menus have changed. The steps name the
 * buttons ("the Share button", "Add to Home Screen"), not where they sit on the screen, so small
 * menu changes do not make them wrong.
 */
export function AddToHomeScreen() {
  const canInstall = useCanInstall();
  return (
    <Page title={t.title}>
      <p>{t.intro}</p>
      <p>{t.offline}</p>
      {canInstall ? (
        <div className="stack">
          <p>{t.canInstall}</p>
          <Button block large onClick={() => void install()}>
            {t.installButton}
          </Button>
        </div>
      ) : null}
      <h2>{t.iphoneTitle}</h2>
      <ol className="steps">
        {t.iphoneSteps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <h2>{t.androidTitle}</h2>
      <ol className="steps">
        {t.androidSteps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p>{t.done}</p>
    </Page>
  );
}
