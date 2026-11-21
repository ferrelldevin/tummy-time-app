import { lazy, Suspense } from "react";
import { Link as RouterLink } from "react-router";
import { Icon } from "../components/Icon";
import { Illustration } from "../components/Illustration";
import { Link } from "../components/Link";
import { Page } from "../components/Page";
import { correctedAgeText } from "../plan/format";
import { usePlan } from "../plan/store";
import { useServerStatus } from "../health-status";
import { useSession } from "../session";
import { en } from "../strings/en";

// Both load their own files, so Home stays small: the lesson files and the log code.
const NextLesson = lazy(() =>
  import("./ContentRoutes").then((m) => ({ default: m.NextLessonRoute })),
);
const TodayCard = lazy(() => import("./log/LogRoutes").then((m) => ({ default: m.TodayCard })));

function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 5 || h >= 22) return en.home.night;
  if (h < 12) return en.home.morning;
  if (h < 17) return en.home.afternoon;
  return en.home.evening;
}

/**
 * Home: the two things a tired caregiver most often needs (start tummy time, help with crying)
 * at the top, then the plan and the week.
 */
export function Home() {
  const { profile } = usePlan();
  const { status } = useSession();
  const server = useServerStatus();
  const age = profile ? correctedAgeText(profile).short : null;

  return (
    <Page title={en.home.title} eyebrow={greeting(new Date())}>
      {age ? (
        <p className="chip">
          <Icon name="sparkle" size={18} />
          {en.home.correctedChip}: {age}
        </p>
      ) : null}
      <div className="hero-actions">
        <Link to="/start-tummy-time" appearance="primary" block large className="btn--hero">
          <Icon name="clock" />
          {en.home.startTummyTime}
        </Link>
        <RouterLink to="/baby-crying" className="calm-card">
          <span className="calm-card__icon" aria-hidden="true">
            <Icon name="heart" />
          </span>
          <span className="calm-card__text">
            <span className="calm-card__title">{en.home.babyCrying}</span>
            <span className="calm-card__hint">{en.home.babyCryingHint}</span>
          </span>
          <Icon name="arrowRight" />
        </RouterLink>
      </div>

      {profile ? (
        <Suspense fallback={null}>
          <NextLesson />
        </Suspense>
      ) : (
        <section className="soft-card soft-card--teal setup-card" aria-labelledby="setup-title">
          <Illustration scene="welcome" className="setup-card__art" />
          <div className="stack">
            <h2 id="setup-title">{en.home.setUpTitle}</h2>
            <p>{en.home.setUpBody}</p>
            <Link to="/getting-started" appearance="primary">
              {en.home.setUpButton}
              <Icon name="arrowRight" />
            </Link>
          </div>
        </section>
      )}

      <section className="stack" aria-labelledby="today-title">
        <h2 id="today-title">{en.home.todayTitle}</h2>
        {status === "signedIn" ? (
          <Suspense fallback={null}>
            <TodayCard />
          </Suspense>
        ) : (
          <p>
            {en.home.todaySignedOut} <Link to="/welcome">{en.home.todaySignInLink}</Link>
          </p>
        )}
      </section>

      <ul className="footer-links">
        <li>
          <Link to="/add-to-home-screen">{en.home.addToHomeScreen}</Link>
        </li>
        <li>
          <Link to="/about">{en.about.link}</Link>
        </li>
      </ul>
      <p role="status" className="fine-print">
        {en.server[server]}
      </p>
    </Page>
  );
}
