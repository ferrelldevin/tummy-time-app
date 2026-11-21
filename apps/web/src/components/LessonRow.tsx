import type { Lesson } from "@tummy/shared";
import { Link as RouterLink } from "react-router";
import { fill } from "../plan/format";
import { en } from "../strings/en";
import { Icon } from "./Icon";
import { Illustration } from "./Illustration";

/** One lesson in a list: a small drawing, the title, time to read, and Done or Draft. */
export function LessonRow({
  lesson,
  done,
  index,
}: {
  lesson: Lesson;
  done: boolean;
  /** Its number in the plan, if it is in one. */
  index?: number;
}) {
  return (
    <RouterLink
      to={`/lessons/${lesson.id}`}
      className={done ? "lesson-row lesson-row--done" : "lesson-row"}
    >
      <span className="lesson-row__art">
        <Illustration scene={lesson.illustration ?? "idea"} tone={lesson.order} />
        {done ? (
          <span className="lesson-row__check">
            <Icon name="check" size={18} />
          </span>
        ) : index !== undefined ? (
          <span className="lesson-row__num" aria-hidden="true">
            {index}
          </span>
        ) : null}
      </span>
      <span className="lesson-row__text">
        <span className="lesson-row__title">{lesson.title}</span>
        <span className="lesson-row__meta">
          {fill(en.plan.minutes, { n: lesson.minutes })}
          {done ? (
            <span className="tag tag--done">{en.lessons.doneTag}</span>
          ) : lesson.status === "placeholder" ? (
            <span className="tag tag--draft">{en.lessons.draftTag}</span>
          ) : null}
        </span>
      </span>
      <Icon name="arrowRight" />
    </RouterLink>
  );
}
