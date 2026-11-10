import { useId, useRef, useState } from "react";
import type { SyntheticEvent } from "react";
import { useNavigate } from "react-router";
import { deleteMeResponseSchema, signedOutResponseSchema } from "@tummy/shared";
import { apiCall } from "../../api";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Page } from "../../components/Page";
import { PinField } from "../../components/PinField";
import { useSession, type SignedOutReason } from "../../session";
import { en } from "../../strings/en";
import { cleanPin, ErrorSummary, failureText, pinProblem, useFocusAfterSubmit } from "./forms";

const t = en.account.manage;

/** Signed in only (see RequireSignIn). Sign out here, everywhere, or delete the account. */
export function Account() {
  const navigate = useNavigate();
  const { phonesSignedIn, markSignedOut } = useSession();
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

  function done(reason: SignedOutReason) {
    markSignedOut(reason);
    void navigate("/signed-out");
  }

  async function signOut(path: string, reason: SignedOutReason) {
    setBusy(true);
    setProblem(null);
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
      <ErrorSummary id={summaryId} problems={problem ? [problem] : []} ref={summaryRef} />
      <p>
        {t.signedIn}{" "}
        {phonesSignedIn > 1 ? t.manyPhones.replace("{n}", String(phonesSignedIn)) : t.onePhone}
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
    </Page>
  );
}
