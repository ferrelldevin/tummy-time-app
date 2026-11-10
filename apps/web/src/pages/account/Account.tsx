import { useId, useRef, useState } from "react";
import type { SyntheticEvent } from "react";
import { useNavigate } from "react-router";
import { deleteMeResponseSchema, signedOutResponseSchema } from "@tummy/shared";
import { apiCall } from "../../api";
import { Alert } from "../../components/Alert";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Link } from "../../components/Link";
import { Page } from "../../components/Page";
import { PinField } from "../../components/PinField";
import { sendBeforeSignOut } from "../../log/local-data";
import { useSession, type SignedOutReason } from "../../session";
import { en } from "../../strings/en";
import { useOnline } from "../../useOnline";
import {
  cleanPin,
  ErrorSummary,
  failureText,
  NeedsConnection,
  pinProblem,
  useFocusAfterSubmit,
} from "./forms";

const t = en.account.manage;

/** Signed in only (see RequireSignIn). Sign out here, everywhere, or delete the account. */
export function Account() {
  const navigate = useNavigate();
  const { phonesSignedIn, confirmed, markSignedOut } = useSession();
  const online = useOnline();
  const offlineRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const summaryId = useId();
  const deleteSummaryId = useId();
  const summaryRef = useRef<HTMLDivElement>(null);
  const deleteSummaryRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLInputElement>(null);
  const focusAfterSubmit = useFocusAfterSubmit();
  const [unsent, setUnsent] = useState<{
    count: number;
    path: string;
    reason: SignedOutReason;
  } | null>(null);
  const unsentRef = useRef<HTMLDivElement>(null);

  function done(reason: SignedOutReason) {
    markSignedOut(reason);
    void navigate("/signed-out");
  }

  /**
   * Signing out deletes this phone's copy of the log. So first, try once to send any tummy
   * times still waiting; if some could not be sent, say so and let the person choose.
   */
  async function signOut(path: string, reason: SignedOutReason, evenIfUnsent = false) {
    if (!online) {
      // The server must end the session. Signing out offline would only delete this phone's
      // copy and leave the session alive, so nothing happens but the sentence that says so.
      setUnsent(null);
      focusAfterSubmit(offlineRef);
      return;
    }
    setBusy(true);
    setProblem(null);
    setUnsent(null);
    if (!evenIfUnsent) {
      const left = await sendBeforeSignOut().catch(() => 0);
      if (left > 0) {
        setBusy(false);
        setUnsent({ count: left, path, reason });
        focusAfterSubmit(unsentRef);
        return;
      }
    }
    const result = await apiCall(path, signedOutResponseSchema, { method: "POST" });
    setBusy(false);
    if (result.ok || result.error === "unauthorized") {
      done(reason);
      return;
    }
    setProblem(failureText(result.error, en.account.errors.unexpected));
    focusAfterSubmit(summaryRef);
  }

  async function deleteAccount(event: SyntheticEvent) {
    event.preventDefault();
    setPinError(null);
    const p = pinProblem(pin);
    if (p) {
      setPinError(p);
      focusAfterSubmit(pinRef);
      return;
    }
    if (!online) {
      focusAfterSubmit(offlineRef);
      return;
    }
    setBusy(true);
    const result = await apiCall("/api/me", deleteMeResponseSchema, {
      method: "DELETE",
      body: { pin: cleanPin(pin) },
    });
    setBusy(false);
    if (result.ok) {
      setPin("");
      done("deleted");
      return;
    }
    setPinError(failureText(result.error, en.account.errors.wrongPin));
    focusAfterSubmit(deleteSummaryRef);
  }

  return (
    <Page title={t.title}>
      {online ? null : <NeedsConnection text={t.needsConnection} ref={offlineRef} />}
      <ErrorSummary id={summaryId} problems={problem ? [problem] : []} ref={summaryRef} />
      {unsent ? (
        <div className="stack unsent-warning" ref={unsentRef} tabIndex={-1}>
          <Alert kind="error">
            {unsent.count === 1 ? t.unsentOne : t.unsentMany.replace("{n}", String(unsent.count))}{" "}
            {unsent.count === 1 ? t.unsentLossOne : t.unsentLossMany}
          </Alert>
          <Button
            block
            onClick={() => {
              setUnsent(null);
            }}
          >
            {t.stay}
          </Button>
          <Button
            variant="secondary"
            block
            disabled={busy}
            onClick={() => void signOut(unsent.path, unsent.reason, true)}
          >
            {t.signOutAnyway}
          </Button>
        </div>
      ) : null}
      <p>
        {t.signedIn}{" "}
        {!confirmed
          ? t.checkLater
          : phonesSignedIn > 1
            ? t.manyPhones.replace("{n}", String(phonesSignedIn))
            : t.onePhone}
      </p>
      <Button
        block
        large
        disabled={busy}
        onClick={() => void signOut("/api/auth/sign-out", "thisPhone")}
      >
        {t.signOut}
      </Button>
      <p>{t.everywhereHint}</p>
      <Button
        variant="secondary"
        block
        large
        disabled={busy}
        onClick={() => void signOut("/api/auth/sign-out-everywhere", "everywhere")}
      >
        {t.signOutEverywhere}
      </Button>
      <Card title={t.deleteTitle}>
        <p>{t.deleteWarning}</p>
        <form className="stack" noValidate onSubmit={(e) => void deleteAccount(e)}>
          <ErrorSummary
            id={deleteSummaryId}
            problems={pinError ? [pinError] : []}
            ref={deleteSummaryRef}
          />
          <PinField
            label={t.deletePinLabel}
            hint={t.deletePinHint}
            {...(pinError ? { error: pinError, describedBy: deleteSummaryId } : {})}
            value={pin}
            onChange={setPin}
            autoComplete="current-password"
            ref={pinRef}
          />
          <Button type="submit" variant="secondary" block disabled={busy}>
            {busy ? t.working : t.deleteSubmit}
          </Button>
        </form>
      </Card>
      <p>
        <Link to="/add-to-home-screen">{t.addToHomeScreen}</Link>
      </p>
    </Page>
  );
}
