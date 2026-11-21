import { useEffect, useRef, useState } from "react";
import type { Lesson } from "@tummy/shared";
import { Alert } from "../components/Alert";
import { Icon } from "../components/Icon";
import { Illustration } from "../components/Illustration";
import { Link } from "../components/Link";
import { Markdown } from "../components/Markdown";
import { Page } from "../components/Page";
import { QuickCheck } from "../components/QuickCheck";
import { Button } from "../components/Button";
import { fill } from "../plan/format";
import { planStore, usePlan } from "../plan/store";
import { en } from "../strings/en";

/** A step the care team still has to write starts with this. It is shown as a marked gap. */
const CARE_TEAM_GAP = "CARE TEAM:";

/** Lesson files keep media paths from the site root. The demo build serves from a folder. */
function media(path: string): string {
  return `${import.meta.env.BASE_URL.replace(/\/$/, "")}${path}`;
}

/**
 * One lesson: a drawing, the goal, the video (or its empty slot until the client records it),
 * the steps, quick checks, then "Mark as done" and the next lesson. A draft shows the banner.
 * Every lesson ends with where to get help.
 */
export function LessonView({ lesson, next }: { lesson: Lesson; next?: Lesson | undefined }) {
  const { done } = usePlan();
  const isDone = done.includes(lesson.id);
  const [justDone, setJustDone] = useState(false);
  const doneNote = useRef<HTMLParagraphElement>(null);
  // The "Mark as done" button goes away when pressed, so focus moves to the sentence that
  // replaces it instead of falling to the top of the page.
  useEffect(() => {
    if (justDone) doneNote.current?.focus();
  }, [justDone]);

  return (
    <Page title={lesson.title}>
      <figure className="lesson-hero">
        <Illustration scene={lesson.illustration ?? "idea"} tone={lesson.order} />
        <figcaption className="lesson-hero__meta">
          <span>
            <Icon name="clock" size={18} /> {fill(en.lessons.minutes, { n: lesson.minutes })}
          </span>
          {lesson.status === "placeholder" ? (
            <span className="tag tag--draft">{en.lessons.draftTag}</span>
          ) : null}
        </figcaption>
      </figure>
      {lesson.status === "placeholder" ? <Alert kind="info">{en.draftLabel}</Alert> : null}
      <section className="soft-card soft-card--teal">
        <h2 className="kicker">{en.lessons.goal}</h2>
        <p className="lead">{lesson.goal}</p>
      </section>

      {lesson.videoUrl && lesson.captionsUrl ? (
        <section className="stack" aria-labelledby="lesson-video">
          <h2 id="lesson-video">{en.lessons.video}</h2>
          <video className="lesson-video" controls preload="metadata" src={media(lesson.videoUrl)}>
            <track
              kind="captions"
              src={media(lesson.captionsUrl)}
              srcLang="en"
              label="English"
              default
            />
          </video>
          {lesson.transcript ? (
            <details>
              <summary>{en.lessons.transcript}</summary>
              <p>{lesson.transcript}</p>
            </details>
          ) : null}
        </section>
      ) : lesson.videoPlanned ? (
        <section className="video-slot" aria-labelledby="lesson-video">
          <div className="video-slot__poster" aria-hidden="true">
            <Illustration scene={lesson.illustration ?? "idea"} tone={lesson.order + 1} />
            <span className="video-slot__play">
              <Icon name="play" size={28} />
            </span>
          </div>
          <div className="video-slot__text">
            <h2 id="lesson-video">{en.lessons.videoSoon}</h2>
            <p>
              <strong>{en.lessons.videoPlannedLabel}</strong> {lesson.videoPlanned}
            </p>
            <p className="fine-print">
              {en.lessons.videoSoonBody} {en.lessons.captionsSoon}
            </p>
          </div>
        </section>
      ) : null}

      <div className="lesson-body">
        <Markdown source={lesson.body} />
      </div>

      {lesson.steps.length > 0 ? (
        <section className="stack" aria-labelledby="lesson-steps">
          <h2 id="lesson-steps">{en.lessons.steps}</h2>
          <ol className="steps">
            {lesson.steps.map((step, i) =>
              step.text.startsWith(CARE_TEAM_GAP) ? (
                <li key={i} className="steps__item steps__item--gap">
                  <p>
                    <strong>{en.lessons.careTeamNote}:</strong>{" "}
                    {step.text.slice(CARE_TEAM_GAP.length).trim()}
                  </p>
                </li>
              ) : (
                <li key={i} className="steps__item">
                  <p>{step.text}</p>
                  {step.image && step.alt ? (
                    <img
                      className="step-image"
                      src={media(step.image)}
                      alt={step.alt}
                      loading="lazy"
                    />
                  ) : null}
                </li>
              ),
            )}
          </ol>
        </section>
      ) : null}

      {lesson.checks.length > 0 ? (
        <section className="stack" aria-labelledby="lesson-checks">
          <div>
            <h2 id="lesson-checks">{en.lessons.checkTitle}</h2>
            <p className="fine-print">{en.lessons.checkIntro}</p>
          </div>
          {lesson.checks.map((check, i) => (
            <QuickCheck key={`${lesson.id}-${String(i)}`} check={check} number={i + 1} />
          ))}
        </section>
      ) : null}

      <div className="lesson-end stack">
        {/* Focus moves to this sentence when it appears, so a screen reader reads it once. It is
            not also a live region: that would read it twice. */}
        <div>
          {isDone ? (
            <p
              ref={doneNote}
              tabIndex={-1}
              className={justDone ? "done-note done-note--pop" : "done-note"}
            >
              <span className="done-note__icon">
                <Icon name="check" />
              </span>
              {en.lessons.markedDone}
            </p>
          ) : null}
        </div>
        {isDone ? null : (
          <Button
            block
            large
            onClick={() => {
              planStore.markDone(lesson.id);
              setJustDone(true);
            }}
          >
            <Icon name="check" />
            {en.lessons.markDone}
          </Button>
        )}
        {next ? (
          <Link to={`/lessons/${next.id}`} appearance={isDone ? "primary" : "secondary"} block>
            {en.lessons.next}: {next.title}
          </Link>
        ) : null}
      </div>

      <p>{en.lessons.getHelp}</p>
      <Link to="/when-to-call" appearance="secondary" block>
        {en.nav.whenToCall}
      </Link>
      <Link to="/lessons">{en.lessons.backToList}</Link>
    </Page>
  );
}
