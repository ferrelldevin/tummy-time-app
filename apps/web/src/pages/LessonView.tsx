import type { Lesson } from "@tummy/shared";
import { Alert } from "../components/Alert";
import { Card } from "../components/Card";
import { Link } from "../components/Link";
import { Markdown } from "../components/Markdown";
import { Page } from "../components/Page";
import { en } from "../strings/en";

/** One lesson. A draft shows the banner. Every lesson ends with where to get help. */
export function LessonView({ lesson }: { lesson: Lesson }) {
  return (
    <Page title={lesson.title}>
      {lesson.status === "placeholder" ? <Alert kind="info">{en.draftLabel}</Alert> : null}
      <Card title={en.lessons.goal}>
        <p>{lesson.goal}</p>
      </Card>
      {lesson.videoUrl && lesson.captionsUrl ? (
        <section className="stack" aria-labelledby="lesson-video">
          <h2 id="lesson-video">{en.lessons.video}</h2>
          <video className="lesson-video" controls preload="metadata" src={lesson.videoUrl}>
            <track kind="captions" src={lesson.captionsUrl} srcLang="en" label="English" default />
          </video>
          {lesson.transcript ? (
            <details>
              <summary>{en.lessons.transcript}</summary>
              <p>{lesson.transcript}</p>
            </details>
          ) : null}
        </section>
      ) : null}
      <Markdown source={lesson.body} />
      {lesson.steps.length > 0 ? (
        <section className="stack" aria-labelledby="lesson-steps">
          <h2 id="lesson-steps">{en.lessons.steps}</h2>
          <ol className="steps">
            {lesson.steps.map((step, i) => (
              <li key={i} className="stack">
                <p>{step.text}</p>
                {step.image && step.alt ? (
                  <img className="step-image" src={step.image} alt={step.alt} loading="lazy" />
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      <p>{en.lessons.getHelp}</p>
      <Link to="/when-to-call" appearance="secondary" block>
        {en.nav.whenToCall}
      </Link>
      <Link to="/lessons">{en.lessons.backToList}</Link>
    </Page>
  );
}
