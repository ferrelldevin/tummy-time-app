import type { Lesson } from "@tummy/shared";
import { EmptyState } from "../components/StateViews";
import { Link } from "../components/Link";
import { Page } from "../components/Page";
import { en } from "../strings/en";

/** The list of lessons. Every item still marked as a draft says so. */
export function Lessons({ lessons }: { lessons: readonly Lesson[] }) {
  return (
    <Page title={en.lessons.title}>
      {lessons.length === 0 ? (
        <EmptyState title={en.lessons.emptyTitle} body={en.lessons.emptyBody} />
      ) : (
        <ul className="lesson-list">
          {lessons.map((lesson) => (
            <li key={lesson.id} className="stack">
              <Link to={`/lessons/${lesson.id}`} appearance="primary" block>
                {lesson.title}
              </Link>
              <p>{lesson.goal}</p>
              {lesson.status === "placeholder" ? (
                <p className="draft-note">{en.draftLabel}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
