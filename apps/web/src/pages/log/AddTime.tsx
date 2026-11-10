import { useId, useRef, useState } from "react";
import type { SyntheticEvent } from "react";
import { useNavigate } from "react-router";
import { LOG_MAX_AGE_MS } from "@tummy/shared";
import { Button } from "../../components/Button";
import { Page } from "../../components/Page";
import { TextField } from "../../components/TextField";
import { checkAddTime, type AddTimeErrors } from "../../log/add-time-rules";
import { localDayKey } from "../../log/format";
import { startLogSync } from "../../log/local-data";
import { en } from "../../strings/en";
import { ErrorSummary, useFocusAfterSubmit } from "../account/forms";

const t = en.addTime;

/**
 * "Add a time": a tummy time the caregiver did not time with the app. The same error pattern
 * as the sign-in forms: words, tied to each field, a summary at the top, focus on the first
 * field with a problem.
 */
export function AddTime() {
  const navigate = useNavigate();
  const [now] = useState(() => new Date());
  const [day, setDay] = useState(() => localDayKey(now));
  const [time, setTime] = useState("");
  const [minutes, setMinutes] = useState("");
  const [errors, setErrors] = useState<AddTimeErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const summaryId = useId();
  const summaryRef = useRef<HTMLDivElement>(null);
  const dayRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLInputElement>(null);
  const minutesRef = useRef<HTMLInputElement>(null);
  const focusAfterSubmit = useFocusAfterSubmit();

  async function submit(event: SyntheticEvent) {
    event.preventDefault();
    setServerError(null);
    const checked = checkAddTime({ day, time, minutes }, new Date());
    if (!checked.ok) {
      setErrors(checked.errors);
      if (checked.errors.day) focusAfterSubmit(dayRef);
      else if (checked.errors.time) focusAfterSubmit(timeRef);
      else focusAfterSubmit(minutesRef);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const sync = await startLogSync();
      await sync.add(checked.body);
      void navigate("/log", { state: { saved: true } });
    } catch {
      setSaving(false);
      setServerError(en.account.errors.unexpected);
      focusAfterSubmit(summaryRef);
    }
  }

  const problems = [errors.day, errors.time, errors.minutes, serverError].filter(
    (p): p is string => !!p,
  );
  return (
    <Page title={t.title}>
      <p>{t.intro}</p>
      <form className="stack" noValidate onSubmit={(e) => void submit(e)}>
        <ErrorSummary id={summaryId} problems={problems} ref={summaryRef} />
        <TextField
          label={t.dayLabel}
          type="date"
          value={day}
          min={localDayKey(new Date(now.getTime() - LOG_MAX_AGE_MS))}
          max={localDayKey(now)}
          onChange={(e) => {
            setDay(e.target.value);
          }}
          {...(errors.day ? { error: errors.day } : {})}
          ref={dayRef}
        />
        <TextField
          label={t.timeLabel}
          type="time"
          value={time}
          onChange={(e) => {
            setTime(e.target.value);
          }}
          {...(errors.time ? { error: errors.time } : {})}
          ref={timeRef}
        />
        <TextField
          label={t.minutesLabel}
          hint={t.minutesHint}
          inputMode="numeric"
          autoComplete="off"
          value={minutes}
          onChange={(e) => {
            setMinutes(e.target.value);
          }}
          {...(errors.minutes ? { error: errors.minutes } : {})}
          ref={minutesRef}
        />
        <Button type="submit" block large disabled={saving}>
          {t.submit}
        </Button>
      </form>
    </Page>
  );
}
