import type { Lesson } from "@tummy/shared";
import { Link as RouterLink } from "react-router";
import { Icon } from "../../components/Icon";
import { Illustration } from "../../components/Illustration";
import { fill } from "../../plan/format";
import { planFor } from "../../plan/pathways";
import { usePlan } from "../../plan/store";
import { en } from "../../strings/en";
import { Progress } from "../Lessons";

/** Home: the next lesson in the plan, with progress. Shown only once there is a plan. */
export function NextLessonCard({ lessons }: { lessons: readonly Lesson[] }) {
  const { profile, done } = usePlan();
  if (!profile) return null;
  const plan = planFor(profile, lessons);
  const doneCount = plan.filter((l) => done.includes(l.id)).length;
  const next = plan.find((l) => !done.includes(l.id));
  return (
    <section className="next-card" aria-labelledby="next-title">
      <div className="section-head">
        <h2 id="next-title">{en.home.nextTitle}</h2>
        <p className="section-head__meta">
          {fill(en.home.progress, { done: doneCount, total: plan.length })}
        </p>
      </div>
      <Progress value={doneCount} max={plan.length} />
      {next ? (
        <RouterLink to={`/lessons/${next.id}`} className="next-card__lesson">
          <Illustration scene={next.illustration ?? "idea"} tone={next.order} />
          <span className="next-card__text">
            <span className="next-card__title">{next.title}</span>
            <span className="next-card__goal">{next.goal}</span>
            <span className="next-card__meta">
              {fill(en.plan.minutes, { n: next.minutes })}
              {next.status === "placeholder" ? (
                <span className="tag tag--draft">{en.lessons.draftTag}</span>
              ) : null}
            </span>
          </span>
          <span className="next-card__go" aria-hidden="true">
            <Icon name="arrowRight" />
          </span>
        </RouterLink>
      ) : (
        <p>{en.home.allDone}</p>
      )}
    </section>
  );
}
