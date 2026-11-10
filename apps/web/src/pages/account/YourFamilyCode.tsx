import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Page } from "../../components/Page";
import { en } from "../../strings/en";

const t = en.account.familyCode;

/** "A B C D, E F G H, J K M N": read one character at a time by a screen reader. */
function spelledOut(code: string): string {
  return code
    .split(" ")
    .map((group) => group.split("").join(" "))
    .join(", ");
}

/**
 * Shown once, right after sign-up. The code lives only in the memory of the screen that made
 * the account; it is gone when this screen closes or the page reloads.
 */
export function YourFamilyCode({ code, onDone }: { code: string; onDone: () => void }) {
  return (
    <Page title={t.title} focusHeading>
      <p>{t.lead}</p>
      <Card>
        <p className="family-code" aria-hidden="true" data-testid="family-code">
          {code}
        </p>
        <p className="visually-hidden">
          {t.spelledOut} {spelledOut(code)}
        </p>
      </Card>
      <p>
        <strong>{t.saveIt}</strong>
      </p>
      <p>{t.why}</p>
      <p>{t.shared}</p>
      <p>{t.noRecovery}</p>
      <Button block large onClick={onDone}>
        {t.done}
      </Button>
    </Page>
  );
}
