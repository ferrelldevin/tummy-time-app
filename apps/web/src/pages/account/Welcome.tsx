import { Link } from "../../components/Link";
import { Page } from "../../components/Page";
import { Alert } from "../../components/Alert";
import { en } from "../../strings/en";
import { useOnline } from "../../useOnline";

const t = en.account.welcome;

/** Shown when someone opens the Log without being signed in. */
export function Welcome() {
  const online = useOnline();
  return (
    <Page title={t.title}>
      <p>{t.intro}</p>
      <p>{t.open}</p>
      {online ? null : <Alert kind="info">{t.needsConnection}</Alert>}
      <Link to="/create-account" appearance="primary" block large>
        {t.createAccount}
      </Link>
      <Link to="/sign-in" appearance="secondary" block large>
        {t.signIn}
      </Link>
    </Page>
  );
}
