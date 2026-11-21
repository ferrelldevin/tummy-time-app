import type { Lesson } from "@tummy/shared";
import { Alert } from "../components/Alert";
import { Illustration } from "../components/Illustration";
import { LessonRow } from "../components/LessonRow";
import { Link } from "../components/Link";
import { Page } from "../components/Page";
import { EmptyState } from "../components/StateViews";
import { fill } from "../plan/format";
import { planFor } from "../plan/pathways";
import { usePlan } from "../plan/store";
import { en } from "../strings/en";

/**
 * The lessons. With answers from "Getting started", the caregiver's plan comes first, with
 * progress, then every other lesson. Every draft says so.
 */
export function Lessons({ lessons }: { lessons: readonly Lesson[] }) {
  const { profile, done } = usePlan();
  if (lessons.length === 0) {
    return (
      <Page title={en.lessons.title}>
        <EmptyState title={en.lessons.emptyTitle} body={en.lessons.emptyBody} />
      </Page>
    );
  }
  const plan = profile ? planFor(profile, lessons) : [];
  const others = lessons.filter((l) => !plan.includes(l));
  const doneInPlan = plan.filter((l) => done.includes(l.id)).length;

  return (
    <Page title={en.lessons.title}>
      {lessons.some((l) => l.status === "placeholder") ? (
        <Alert kind="info">{en.draftLabel}</Alert>
      ) : null}
      {profile ? (
        <section className="stack" aria-labelledby="your-plan">
          <div className="section-head">
            <h2 id="your-plan">{en.lessons.yourPlan}</h2>
            <p className="section-head__meta">
              {fill(en.home.progress, { done: doneInPlan, total: plan.length })}
            </p>
          </div>
          <Progress value={doneInPlan} max={plan.length} />
          <ol className="lesson-rows">
            {plan.map((lesson, i) => (
              <li key={lesson.id}>
                <LessonRow lesson={lesson} done={done.includes(lesson.id)} index={i + 1} />
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <section className="soft-card soft-card--teal setup-card">
          <Illustration scene="path" className="setup-card__art" />
          <div className="stack">
            <p>{en.lessons.setUp}</p>
            <Link to="/getting-started" appearance="primary">
              {en.lessons.setUpButton}
            </Link>
          </div>
        </section>
      )}
      {others.length > 0 ? (
        <section className="stack" aria-labelledby="all-lessons">
          <h2 id="all-lessons">{profile ? en.lessons.other : en.lessons.all}</h2>
          <ul className="lesson-rows">
            {others.map((lesson) => (
              <li key={lesson.id}>
                <LessonRow lesson={lesson} done={done.includes(lesson.id)} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </Page>
  );
}

/** A thin bar. The words next to it say the same thing, so it is hidden from screen readers. */
export function Progress({ value, max }: { value: number; max: number }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div className="progress" aria-hidden="true">
      {/* Set through the DOM (CSSOM), which the page's Content Security Policy allows. */}
      <div className="progress__fill" style={{ inlineSize: `${String(pct)}%` }} />
    </div>
  );
}
