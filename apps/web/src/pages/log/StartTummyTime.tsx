import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { LOG_MAX_DURATION_SECONDS, LOG_MIN_DURATION_SECONDS } from "@tummy/shared";
import { Alert } from "../../components/Alert";
import { Button } from "../../components/Button";
import { Link } from "../../components/Link";
import { Page } from "../../components/Page";
import { clockText, fill, lengthText } from "../../log/format";
import { startLogSync } from "../../log/local-data";
import { elapsedSeconds, timer } from "../../log/timer";
import { useLogSync } from "../../log/useLogSync";
import { useSession } from "../../session";
import { en } from "../../strings/en";
import { SyncStatusLine } from "./SyncStatusLine";

const t = en.startTummyTime;

/** The running time, worked out from the start time and redrawn once a second. */
function useTimerView() {
  const { startedAtMs } = useSyncExternalStore(timer.subscribe, timer.get);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (startedAtMs === null) return;
    setNow(Date.now());
    // Only redraws the screen. The time itself is always worked out from the start time.
    const handle = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      clearInterval(handle);
    };
  }, [startedAtMs]);

  const seconds = startedAtMs === null ? 0 : elapsedSeconds(startedAtMs, now);
  return { running: startedAtMs !== null, seconds };
}

/**
 * One large Start / Stop control and the running time. The time is a role="timer" region with
 * aria-live="off": a screen reader can read it at any moment, but is not interrupted every
 * second. The screens using it announce starting and stopping once, politely.
 */
function TimerFace({
  seconds,
  running,
  busy,
  stopLabel,
  onToggle,
}: {
  seconds: number;
  running: boolean;
  busy: boolean;
  stopLabel: string;
  onToggle: () => void;
}) {
  const labelId = useId();
  return (
    <div className="timer-panel">
      <p className="timer-panel__label" id={labelId}>
        {t.timeLabel}
      </p>
      <div role="timer" aria-live="off" aria-labelledby={labelId} className="timer-panel__time">
        <span aria-hidden="true">{clockText(seconds)}</span>
        <span className="visually-hidden">{lengthText(seconds)}</span>
      </div>
      <Button
        block
        className="timer-panel__button"
        variant={running ? "secondary" : "primary"}
        disabled={busy}
        onClick={onToggle}
      >
        {running ? stopLabel : t.start}
      </Button>
    </div>
  );
}

/** Signed in: the time is saved to the log when the timer stops. */
export function StartTummyTime() {
  const { state } = useLogSync();
  const { running, seconds } = useTimerView();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!running) {
      timer.start(Date.now());
      setMessage(t.started);
      return;
    }
    const done = timer.stop(Date.now());
    if (done === null) return;
    const total = Math.floor(done.elapsedMs / 1000);
    if (total < LOG_MIN_DURATION_SECONDS) {
      setMessage(t.tooShort);
      return;
    }
    if (total > LOG_MAX_DURATION_SECONDS) {
      setMessage(t.tooLong);
      return;
    }
    setBusy(true);
    try {
      const sync = await startLogSync();
      await sync.add({
        startedAt: new Date(done.startedAtMs).toISOString(),
        durationSeconds: total,
      });
      setMessage(fill(t.saved, { time: lengthText(total) }));
    } catch {
      setMessage(en.account.errors.unexpected);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page title={t.title}>
      <SyncStatusLine state={state} />
      <TimerFace
        seconds={seconds}
        running={running}
        busy={busy}
        stopLabel={t.stop}
        onToggle={() => void toggle()}
      />
      <p role="status" className="timer-panel__message">
        {message}
      </p>
      {message === t.tooLong ? (
        <Link to="/log/add" appearance="secondary" block>
          {t.addInstead}
        </Link>
      ) : null}
      <Link to="/log" appearance="secondary" block>
        {t.seeLog}
      </Link>
    </Page>
  );
}

/**
 * Signed out: the same timer, so the first tap on Home's big button never hits a sign-in wall.
 * Nothing is saved or stored: the timer lives in memory (src/log/timer.ts) and the time is only
 * shown. It says so before the timer starts, and offers sign-in to keep a log.
 */
export function TryTummyTime() {
  const { status, refresh } = useSession();
  // The sign-in check failed (a server error), so the person may well be signed in. Say that,
  // and offer a retry: the timer keeps running, and if the check then passes, this screen
  // becomes the one that saves.
  const checkFailed = status === "error";
  const { running, seconds } = useTimerView();
  const [message, setMessage] = useState("");

  function toggle() {
    if (!running) {
      timer.start(Date.now());
      setMessage(t.started);
      return;
    }
    const done = timer.stop(Date.now());
    if (done === null) return;
    const total = Math.floor(done.elapsedMs / 1000);
    setMessage(
      total < LOG_MIN_DURATION_SECONDS
        ? t.tooShortSignedOut
        : fill(t.doneNotSaved, { time: lengthText(total) }),
    );
  }

  return (
    <Page title={t.title}>
      <Alert kind="info">{checkFailed ? t.checkFailed : t.notSignedIn}</Alert>
      {checkFailed ? (
        <Button variant="secondary" block onClick={() => void refresh()}>
          {en.states.tryAgain}
        </Button>
      ) : null}
      <TimerFace
        seconds={seconds}
        running={running}
        busy={false}
        stopLabel={t.stopSignedOut}
        onToggle={toggle}
      />
      <p role="status" className="timer-panel__message">
        {message}
      </p>
      {checkFailed ? null : (
        <Link to="/welcome" appearance="secondary" block>
          {t.signInToSave}
        </Link>
      )}
    </Page>
  );
}
