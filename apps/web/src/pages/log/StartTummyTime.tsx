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

/**
 * The running time, worked out from the start time and redrawn once a second. After a stop it
 * keeps showing the time that was just timed, so the result is on the big clock, not only in a
 * sentence that may sit below the fold on a small phone.
 */
function useTimerView() {
  const { startedAtMs } = useSyncExternalStore(timer.subscribe, timer.get);
  const [now, setNow] = useState(() => Date.now());
  // Set by the screen from the stop itself, so the clock and the sentence use the same length.
  // A stop made somewhere else (signing out) leaves it empty, and the clock shows 0:00.
  const [last, setLast] = useState<number | null>(null);

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

  const running = startedAtMs !== null;
  const seconds = running ? elapsedSeconds(startedAtMs, now) : (last ?? 0);
  return { running, seconds, stopped: !running && last !== null, setLast };
}

/**
 * One large Start / Stop control and the running time. The time is a role="timer" region with
 * aria-live="off": a screen reader can read it at any moment, but is not interrupted every
 * second. The message under it (role="status") announces starting and stopping once, politely,
 * and sits right above the button so it is in sight when the button is tapped.
 */
function TimerFace({
  seconds,
  running,
  stopped,
  busy,
  stopLabel,
  message,
  onToggle,
}: {
  seconds: number;
  running: boolean;
  stopped: boolean;
  busy: boolean;
  stopLabel: string;
  message: string;
  onToggle: () => void;
}) {
  const labelId = useId();
  return (
    <div className="timer-panel">
      <p className="timer-panel__label" id={labelId}>
        {stopped ? t.lastLabel : t.timeLabel}
      </p>
      <div role="timer" aria-live="off" aria-labelledby={labelId} className="timer-panel__time">
        <span aria-hidden="true">{clockText(seconds)}</span>
        <span className="visually-hidden">{lengthText(seconds)}</span>
      </div>
      <p role="status" className="timer-panel__message">
        {message}
      </p>
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
  const { running, seconds, stopped, setLast } = useTimerView();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!running) {
      setLast(null);
      timer.start(Date.now());
      setMessage(t.started);
      return;
    }
    const done = timer.stop(Date.now());
    if (done === null) return;
    const total = Math.floor(done.elapsedMs / 1000);
    setLast(total);
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
        stopped={stopped}
        busy={busy}
        stopLabel={t.stop}
        message={message}
        onToggle={() => void toggle()}
      />
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
  // One check at a time: on a slow line a tired person may tap Try again more than once.
  const [checking, setChecking] = useState(false);
  async function checkAgain() {
    if (checking) return;
    setChecking(true);
    try {
      await refresh();
    } finally {
      setChecking(false);
    }
  }
  const { running, seconds, stopped, setLast } = useTimerView();
  const [message, setMessage] = useState("");

  function toggle() {
    if (!running) {
      setLast(null);
      timer.start(Date.now());
      setMessage(t.started);
      return;
    }
    const done = timer.stop(Date.now());
    if (done === null) return;
    const total = Math.floor(done.elapsedMs / 1000);
    setLast(total);
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
        <Button
          variant="secondary"
          block
          // aria-disabled, not disabled: a disabled button drops keyboard focus to the page.
          aria-disabled={checking}
          onClick={() => void checkAgain()}
        >
          {checking ? en.states.loading : en.states.tryAgain}
        </Button>
      ) : null}
      <TimerFace
        seconds={seconds}
        running={running}
        stopped={stopped}
        busy={false}
        stopLabel={t.stopSignedOut}
        message={message}
        onToggle={toggle}
      />
      {checkFailed ? null : (
        <Link to="/welcome" appearance="secondary" block>
          {t.signInToSave}
        </Link>
      )}
    </Page>
  );
}
