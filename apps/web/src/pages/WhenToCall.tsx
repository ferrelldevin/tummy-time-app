import type { SafetyCard } from "@tummy/shared";
import { Alert } from "../components/Alert";
import { Card } from "../components/Card";
import { Page } from "../components/Page";
import { en } from "../strings/en";

/**
 * The "When to call" card. The emergency line comes from the string catalog, never from the
 * content file, so a content edit cannot remove or change it. If the file cannot be read, the
 * line still shows. The rest of the card is the file's wording and carries the draft banner
 * until a clinician signs off.
 */
export function WhenToCall({ card }: { card: SafetyCard | null }) {
  return (
    <Page title={en.whenToCall.title}>
      {card === null || card.status === "placeholder" ? (
        <Alert kind="info">{en.draftLabel}</Alert>
      ) : null}
      <Card>
        <p className="emergency-line" data-testid="emergency-line">
          {en.whenToCall.emergencyLine}
        </p>
      </Card>
      {card ? (
        <Card title={en.whenToCall.callTodayHeading}>
          <ul>
            {card.callToday.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </Card>
      ) : (
        <Alert kind="error">{en.whenToCall.problem}</Alert>
      )}
      <p>{en.whenToCall.getHelp}</p>
      <p>{en.whenToCall.notAdvice}</p>
    </Page>
  );
}
