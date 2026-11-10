import { useId, useRef, useState } from "react";
import type { SyntheticEvent } from "react";
import { useNavigate } from "react-router";
import { signUpFinishResponseSchema } from "@tummy/shared";
import { apiCall } from "../../api";
import { wipeLocalData } from "../../log/local-data";
import { Button } from "../../components/Button";
import { Link } from "../../components/Link";
import { Page } from "../../components/Page";
import { PinField } from "../../components/PinField";
import { useSession } from "../../session";
import { en } from "../../strings/en";
import { cleanPin, ErrorSummary, failureText, pinProblem, useFocusAfterSubmit } from "./forms";
import { YourFamilyCode } from "./YourFamilyCode";

const t = en.account.create;

export function CreateAccount() {
  const navigate = useNavigate();
  const { refresh } = useSession();
  const summaryId = useId();
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ pin?: string; confirm?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Memory only, for this one screen. Never stored anywhere.
  const [familyCode, setFamilyCode] = useState<string | null>(null);
  const pinRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const focusAfterSubmit = useFocusAfterSubmit();

  if (familyCode !== null) {
    return (
      <YourFamilyCode
        code={familyCode}
        onDone={() => {
          void navigate("/log");
        }}
      />
    );
  }

  async function submit(event: SyntheticEvent) {
    event.preventDefault();
    const next: { pin?: string; confirm?: string } = {};
    const pinError = pinProblem(pin);
    if (pinError) next.pin = pinError;
    else if (cleanPin(confirm) !== cleanPin(pin)) next.confirm = en.account.errors.pinMismatch;
    setErrors(next);
    setServerError(null);
    if (next.pin) {
      focusAfterSubmit(pinRef);
      return;
    }
    if (next.confirm) {
      focusAfterSubmit(confirmRef);
      return;
    }

    setSubmitting(true);
    const result = await apiCall("/api/auth/sign-up/finish", signUpFinishResponseSchema, {
      method: "POST",
      body: { pin: cleanPin(pin) },
    });
    setSubmitting(false);
    if (result.ok) {
      setPin("");
      setConfirm("");
      setFamilyCode(result.data.familyCode);
      // A new account starts with an empty copy of the log on this phone (see SignIn.tsx).
      void wipeLocalData().then(refresh);
      return;
    }
    if (result.error === "weak_pin") {
      setErrors({ pin: en.account.errors.weakPin });
      focusAfterSubmit(pinRef);
      return;
    }
    setServerError(failureText(result.error, en.account.errors.unexpected));
    focusAfterSubmit(summaryRef);
  }

  const problems = [errors.pin, errors.confirm, serverError].filter((p): p is string => !!p);
  return (
    <Page title={t.title}>
      <p>{t.intro}</p>
      <p>{t.notAdvice}</p>
      <form className="stack" noValidate onSubmit={(e) => void submit(e)}>
        <ErrorSummary id={summaryId} problems={problems} ref={summaryRef} />
        <PinField
          label={t.pinLabel}
          hint={t.pinHint}
          {...(errors.pin ? { error: errors.pin } : {})}
          {...(serverError ? { describedBy: summaryId } : {})}
          value={pin}
          onChange={setPin}
          autoComplete="new-password"
          ref={pinRef}
        />
        <PinField
          label={t.confirmLabel}
          {...(errors.confirm ? { error: errors.confirm } : {})}
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          ref={confirmRef}
        />
        <Button type="submit" block large disabled={submitting}>
          {submitting ? t.submitting : t.submit}
        </Button>
      </form>
      <p>
        {t.haveAccount} <Link to="/sign-in">{t.signInInstead}</Link>
      </p>
    </Page>
  );
}
