import { useEffect, useRef, useState } from "react";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { Illustration } from "../components/Illustration";
import { Link } from "../components/Link";
import { Page } from "../components/Page";
import { Alert } from "../components/Alert";
import { fill } from "../plan/format";
import { en } from "../strings/en";

const t = en.babyCrying;
type Step = "breathe" | "try" | "how" | "good" | "stop";
const BREATHS = 3;
const HALF_MS = 4000;

/**
 * "Baby crying? Try this": a calm, one-step-at-a-time coach. The brief's core problem is that
 * caregivers get upset when a baby born early cries in tummy time, and stop. So it starts with
 * the caregiver (three slow breaths), then one idea, then says plainly that stopping is OK.
 * The ideas are DRAFTS until the care team checks them.
 */
export function BabyCrying() {
  const [step, setStep] = useState<Step>("breathe");
  const [picked, setPicked] = useState<number | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    heading.current?.focus();
  }, [step]);

  const number = step === "breathe" ? 1 : step === "try" ? 2 : 3;

  return (
    <Page title={t.title}>
      <p className="lead">{t.intro}</p>
      <div className="coach soft-card soft-card--lilac">
        <p className="eyebrow">{fill(t.stepLabel, { n: number, total: 3 })}</p>
        {step === "breathe" ? (
          <Breathe
            headingRef={heading}
            onDone={() => {
              setStep("try");
            }}
          />
        ) : null}
        {step === "try" ? (
          <div className="stack">
            <h2 ref={heading} tabIndex={-1}>
              {t.tryTitle}
            </h2>
            <p>{t.tryBody}</p>
            <ul className="idea-list">
              {t.ideas.map((idea, i) => (
                <li key={i}>
                  <button
                    type="button"
                    className="idea"
                    onClick={() => {
                      setPicked(i);
                      setStep("how");
                    }}
                  >
                    <span className="idea__num" aria-hidden="true">
                      {i + 1}
                    </span>
                    <span>{idea}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="fine-print">{t.ideasDraft}</p>
          </div>
        ) : null}
        {step === "how" ? (
          <div className="stack">
            <h2 ref={heading} tabIndex={-1}>
              {t.howTitle}
            </h2>
            {picked !== null ? <p className="picked-idea">{t.ideas[picked]}</p> : null}
            <div className="button-row button-row--stack">
              <Button
                large
                onClick={() => {
                  setStep("good");
                }}
              >
                {t.better}
              </Button>
              <Button
                large
                variant="secondary"
                onClick={() => {
                  setStep("stop");
                }}
              >
                {t.stillCrying}
              </Button>
            </div>
          </div>
        ) : null}
        {step === "good" ? (
          <div className="stack coach__end">
            <Illustration scene="mat" tone={2} />
            <h2 ref={heading} tabIndex={-1}>
              {t.goodTitle}
            </h2>
            <p>{t.goodBody}</p>
            <Link to="/start-tummy-time" appearance="primary" block>
              {t.startTimer}
            </Link>
          </div>
        ) : null}
        {step === "stop" ? (
          <div className="stack coach__end">
            <Illustration scene="calm" tone={1} />
            <h2 ref={heading} tabIndex={-1}>
              {t.stopTitle}
            </h2>
            <p>{t.stopBody}</p>
            <p className="praise">{t.stopCounts}</p>
            <Button
              variant="secondary"
              block
              onClick={() => {
                setPicked(null);
                setStep("try");
              }}
            >
              <Icon name="refresh" />
              {t.again}
            </Button>
          </div>
        ) : null}
      </div>
      <Alert kind="info">{en.draftLabel}</Alert>
      <Link to="/when-to-call" appearance="secondary" block>
        <Icon name="phone" />
        {t.callLink}
      </Link>
      <Link to="/">{t.backHome}</Link>
    </Page>
  );
}

function Breathe({
  headingRef,
  onDone,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onDone: () => void;
}) {
  // 0 = not started; then 1, 2, 3... counts half-breaths (in, out, in, out...).
  const [half, setHalf] = useState(0);
  const finished = half > BREATHS * 2;

  useEffect(() => {
    if (half === 0 || finished) return;
    const timer = window.setTimeout(() => {
      setHalf((h) => h + 1);
    }, HALF_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [half, finished]);

  const breathingIn = half % 2 === 1;
  const label =
    half === 0
      ? t.breatheStart
      : finished
        ? t.breatheDone
        : breathingIn
          ? t.breatheIn
          : t.breatheOut;

  return (
    <div className="stack breathe">
      <h2 ref={headingRef} tabIndex={-1}>
        {t.breatheTitle}
      </h2>
      <p>{t.breatheBody}</p>
      <div
        className={[
          "breathe__circle",
          half > 0 && !finished
            ? breathingIn
              ? "breathe__circle--in"
              : "breathe__circle--out"
            : "",
        ].join(" ")}
        aria-hidden="true"
      >
        <span className="breathe__word">{half === 0 ? "" : label}</span>
      </div>
      {half === 0 ? (
        <Button
          large
          block
          onClick={() => {
            setHalf(1);
          }}
        >
          <Icon name="wind" />
          {t.breatheStart}
        </Button>
      ) : (
        <Button large block variant={finished ? "primary" : "secondary"} onClick={onDone}>
          {finished ? t.breatheDone : t.tryTitle}
          <Icon name="arrowRight" />
        </Button>
      )}
    </div>
  );
}
