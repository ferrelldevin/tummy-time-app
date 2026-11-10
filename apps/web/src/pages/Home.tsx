import { Link } from "../components/Link";
import { Page } from "../components/Page";
import { useServerStatus } from "../health-status";
import { en } from "../strings/en";

export function Home() {
  const server = useServerStatus();
  return (
    <Page title={en.home.title}>
      <p>{en.home.intro}</p>
      <Link to="/start-tummy-time" appearance="primary" block large>
        {en.home.startTummyTime}
      </Link>
      <Link to="/baby-crying" appearance="primary" block large>
        {en.home.babyCrying}
      </Link>
      <p role="status">{en.server[server]}</p>
    </Page>
  );
}
