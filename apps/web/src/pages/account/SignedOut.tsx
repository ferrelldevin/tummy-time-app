import { Link } from "../../components/Link";
import { Page } from "../../components/Page";
import { useSession } from "../../session";
import { en } from "../../strings/en";

const t = en.account.signedOut;

export function SignedOut() {
  const { signedOutReason } = useSession();
  const message =
    signedOutReason === "thisPhone"
      ? t.thisPhone
      : signedOutReason === "everywhere"
        ? t.everywhere
        : signedOutReason === "deleted"
          ? t.deleted
          : t.plain;
  return (
    <Page title={t.title}>
      <p role="status">{message}</p>
      <Link to="/sign-in" appearance="primary" block large>
        {t.signIn}
      </Link>
      <Link to="/" appearance="secondary" block large>
        {t.home}
      </Link>
    </Page>
  );
}
