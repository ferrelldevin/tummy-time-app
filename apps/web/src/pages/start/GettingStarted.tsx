import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { Page } from "../../components/Page";
import { ageChoices, bornChoices } from "../../plan/corrected-age";
import type { AgeChoice, BornChoice } from "../../plan/corrected-age";
import { goingChoices, planStore, topicChoices, usePlan } from "../../plan/store";
import type { Going, Topic } from "../../plan/store";
import { en } from "../../strings/en";

const t = en.start;
const TOTAL = 4;

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ""));
}

/**
 * "Getting started": four questions, one per screen. Two age RANGES (never a birth date), the
 * topics the care team has raised, and how tummy time is going. The answers pick the lessons
 * (src/plan/pathways.ts) and stay on this phone (src/plan/store.ts).
 */
export function GettingStarted() {
  const navigate = useNavigate();
  const saved = usePlan().profile;
  const [step, setStep] = useState(1);
  const [age, setAge] = useState<AgeChoice | null>(saved?.age ?? null);
  const [born, setBorn] = useState<BornChoice | null>(saved?.born ?? null);
  const [topics, setTopics] = useState<Topic[] | null>(saved?.topics ?? null);
  const [going, setGoing] = useState<Going | null>(saved?.going ?? null);
  const [missing, setMissing] = useState(false);
  const legend = useRef<HTMLLegendElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    // Each new question gets focus, so a screen reader reads it. Not on the first one.
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    // Each question is a new screen, so it starts at the top with "Question n of 4" in sight.
    const scroller = legend.current?.closest(".app-scroll");
    if (scroller) scroller.scrollTop = 0;
    legend.current?.focus({ preventScroll: Boolean(scroller) });
  }, [step]);

  const answered = [age, born, topics, going][step - 1] !== null;

  function next() {
    if (!answered) {
      setMissing(true);
      return;
    }
    setMissing(false);
    if (step < TOTAL) {
      setStep(step + 1);
      return;
    }
    if (age && born && topics && going) {
      planStore.saveProfile({ age, born, topics, going });
      void navigate("/your-plan");
    }
  }

  function back() {
    setMissing(false);
    if (step > 1) setStep(step - 1);
    else void navigate(-1);
  }

  return (
    <Page title={t.title}>
      <div className="stepper" aria-hidden="true">
        {Array.from({ length: TOTAL }, (_, i) => (
          <span key={i} className={i < step ? "stepper__dot stepper__dot--on" : "stepper__dot"} />
        ))}
      </div>
      <p className="eyebrow">{fill(t.stepLabel, { n: step, total: TOTAL })}</p>
      <form
        className="stack question"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          next();
        }}
      >
        <fieldset
          className="choice-group"
          {...(missing ? { "aria-describedby": "choice-missing" } : {})}
        >
          {step === 1 ? (
            <>
              <legend ref={legend} tabIndex={-1} className="question__title">
                {t.age.question}
              </legend>
              {ageChoices.map((c) => (
                <Choice
                  key={c}
                  type="radio"
                  name="age"
                  label={t.age.choices[c]}
                  checked={age === c}
                  onChange={() => {
                    setAge(c);
                    setMissing(false);
                  }}
                />
              ))}
            </>
          ) : null}
          {step === 2 ? (
            <>
              <legend ref={legend} tabIndex={-1} className="question__title">
                {t.born.question}
              </legend>
              <p className="question__hint">{t.born.hint}</p>
              {bornChoices.map((c) => (
                <Choice
                  key={c}
                  type="radio"
                  name="born"
                  label={t.born.choices[c]}
                  checked={born === c}
                  onChange={() => {
                    setBorn(c);
                    setMissing(false);
                  }}
                />
              ))}
            </>
          ) : null}
          {step === 3 ? (
            <>
              <legend ref={legend} tabIndex={-1} className="question__title">
                {t.topics.question}
              </legend>
              <p className="question__hint">{t.topics.hint}</p>
              {topicChoices.map((c) => (
                <Choice
                  key={c}
                  type="checkbox"
                  name="topics"
                  label={t.topics.choices[c]}
                  checked={topics?.includes(c) ?? false}
                  onChange={(on) => {
                    const now = topics ?? [];
                    const next = on ? [...now, c] : now.filter((x) => x !== c);
                    // Unticking the last topic leaves the question unanswered; it must not
                    // look like "None of these" was picked.
                    setTopics(next.length > 0 ? next : null);
                    setMissing(false);
                  }}
                />
              ))}
              <Choice
                type="checkbox"
                name="topics-none"
                label={t.topics.none}
                checked={topics !== null && topics.length === 0}
                onChange={(on) => {
                  setTopics(on ? [] : null);
                  setMissing(false);
                }}
              />
            </>
          ) : null}
          {step === 4 ? (
            <>
              <legend ref={legend} tabIndex={-1} className="question__title">
                {t.going.question}
              </legend>
              {goingChoices.map((c) => (
                <Choice
                  key={c}
                  type="radio"
                  name="going"
                  label={t.going.choices[c]}
                  checked={going === c}
                  onChange={() => {
                    setGoing(c);
                    setMissing(false);
                  }}
                />
              ))}
            </>
          ) : null}
        </fieldset>
        {missing ? (
          <p id="choice-missing" className="field__error" role="alert">
            {t.pickOne}
          </p>
        ) : null}
        <div className="button-row">
          <Button variant="secondary" onClick={back}>
            <Icon name="arrowLeft" />
            {t.back}
          </Button>
          <Button type="submit">
            {step === TOTAL ? t.finish : t.next}
            <Icon name="arrowRight" />
          </Button>
        </div>
      </form>
      <p className="fine-print">{t.privacy}</p>
    </Page>
  );
}

function Choice({
  type,
  name,
  label,
  checked,
  onChange,
}: {
  type: "radio" | "checkbox";
  name: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={checked ? "choice choice--on" : "choice"}>
      <input
        className="choice__input"
        type={type}
        name={name}
        checked={checked}
        onChange={(e) => {
          onChange(e.target.checked);
        }}
      />
      <span className="choice__box" aria-hidden="true">
        <Icon name="check" size={18} />
      </span>
      <span className="choice__label">{label}</span>
    </label>
  );
}
