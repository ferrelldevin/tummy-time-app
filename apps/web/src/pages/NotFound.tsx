import { Link } from "../components/Link";
import { Page } from "../components/Page";
import { en } from "../strings/en";

export function NotFound() {
  return (
    <Page title={en.notFound.title}>
      <p>{en.notFound.body}</p>
      <Link to="/" appearance="secondary">
        {en.notFound.backHome}
      </Link>
    </Page>
  );
}
