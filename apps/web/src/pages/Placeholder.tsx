import { Alert } from "../components/Alert";
import { Page } from "../components/Page";
import { en } from "../strings/en";

/** A screen whose real content is not built or not approved yet. Always shows the draft label. */
export function Placeholder({ title, text }: { title: string; text: string }) {
  return (
    <Page title={title}>
      <Alert kind="info">{en.draftLabel}</Alert>
      <p>{text}</p>
    </Page>
  );
}
