import type { Lesson } from "@tummy/shared";
import { Navigate } from "react-router";
import { Alert } from "../../components/Alert";
import { Illustration } from "../../components/Illustration";
import { LessonRow } from "../../components/LessonRow";
import { Link } from "../../components/Link";
import { Page } from "../../components/Page";
import { correctedAgeText } from "../../plan/format";
import { planFor } from "../../plan/pathways";
import { usePlan } from "../../plan/store";
import { en } from "../../strings/en";

/** "Your plan": the corrected age range and the lessons picked from the answers. */
export function YourPlan({ lessons }: { lessons: readonly Lesson[] }) {
  const { profile, done } = usePlan();
  if (!profile) return <Navigate to="/getting-started" replace />;
  const plan = planFor(profile, lessons);
  const age = correctedAgeText(profile);
  const next = plan.find((l) => !done.includes(l.id)) ?? plan[0];

  return (
    <Page title={en.plan.title}>
      <Illustration scene="path" className="hero-art" />
      <p className="lead">{en.plan.intro}</p>
      <Alert kind="info">{en.plan.draft}</Alert>
      <section className="soft-card soft-card--sun stack" aria-labelledby="corrected-title">
        <h2 id="corrected-title">{en.plan.correctedTitle}</h2>
        <p className="big-number">{age.long}</p>
        {age.short ? <p>{en.plan.correctedRough}</p> : null}
        <p className="fine-print">{en.plan.correctedWhat}</p>
      </section>
      <section className="stack" aria-labelledby="plan-lessons">
        <h2 id="plan-lessons">{en.plan.lessonsTitle}</h2>
        <ol className="lesson-rows">
          {plan.map((lesson, i) => (
            <li key={lesson.id}>
              <LessonRow lesson={lesson} done={done.includes(lesson.id)} index={i + 1} />
            </li>
          ))}
        </ol>
      </section>
      {next ? (
        <Link to={`/lessons/${next.id}`} appearance="primary" block large>
          {done.length === 0 ? en.plan.startFirst : en.plan.continue}
        </Link>
      ) : null}
      <Link to="/getting-started">{en.plan.change}</Link>
    </Page>
  );
}
