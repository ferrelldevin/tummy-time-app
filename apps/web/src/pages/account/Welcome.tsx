import { Link } from "../../components/Link";
import { Page } from "../../components/Page";
import { en } from "../../strings/en";

const t = en.account.welcome;

/** Shown when someone opens the Log without being signed in. */
export function Welcome() {
  return (
    <Page title={t.title}>
      <p>{t.intro}</p>
      <p>{t.open}</p>
      <Link to="/create-account" appearance="primary" block large>
        {t.createAccount}
      </Link>
      <Link to="/sign-in" appearance="secondary" block large>
        {t.signIn}
      </Link>
    </Page>
  );
}
