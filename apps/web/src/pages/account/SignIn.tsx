import { useId, useRef, useState } from "react";
import type { SyntheticEvent } from "react";
import { useNavigate } from "react-router";
import {
  FAMILY_CODE_INPUT_MAX,
  isWellFormedFamilyCode,
  normalizeFamilyCode,
  signInFinishResponseSchema,
} from "@tummy/shared";
import { apiCall } from "../../api";
import { Button } from "../../components/Button";
import { Link } from "../../components/Link";
import { Page } from "../../components/Page";
import { PinField } from "../../components/PinField";
import { TextField } from "../../components/TextField";
import { useSession } from "../../session";
import { en } from "../../strings/en";
import { cleanPin, ErrorSummary, failureText, pinProblem, useFocusAfterSubmit } from "./forms";

const t = en.account.signIn;

function codeProblem(value: string): string | undefined {
  const code = normalizeFamilyCode(value);
  if (code === "") return en.account.errors.codeMissing;
  if (!isWellFormedFamilyCode(code)) return en.account.errors.codeShape;
  return undefined;
}

export function SignIn() {
  const navigate = useNavigate();
  const { refresh } = useSession();
  const summaryId = useId();
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [errors, setErrors] = useState<{ code?: string; pin?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);
  const pinRef = useRef<HTMLInputElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const focusAfterSubmit = useFocusAfterSubmit();

  async function submit(event: SyntheticEvent) {
    event.preventDefault();
    const next: { code?: string; pin?: string } = {};
    const c = codeProblem(code);
    const p = pinProblem(pin);
    if (c) next.code = c;
    if (p) next.pin = p;
    setErrors(next);
    setServerError(null);
    if (next.code) {
      focusAfterSubmit(codeRef);
      return;
    }
    if (next.pin) {
      focusAfterSubmit(pinRef);
      return;
    }

    setSubmitting(true);
    const result = await apiCall("/api/auth/sign-in/finish", signInFinishResponseSchema, {
      method: "POST",
      body: { familyCode: code, pin: cleanPin(pin) },
    });
    if (result.ok) {
      setPin("");
      await refresh();
      setSubmitting(false);
      void navigate("/log");
      return;
    }
    setSubmitting(false);
    setServerError(failureText(result.error, en.account.errors.signInFailed));
    focusAfterSubmit(summaryRef);
  }

  const problems = [errors.code, errors.pin, serverError].filter((x): x is string => !!x);
  return (
    <Page title={t.title}>
      <p>{t.intro}</p>
      <form className="stack" noValidate onSubmit={(e) => void submit(e)}>
        <ErrorSummary id={summaryId} problems={problems} ref={summaryRef} />
        <TextField
          label={t.codeLabel}
          hint={t.codeHint}
          {...(errors.code ? { error: errors.code } : {})}
          {...(serverError ? { describedBy: summaryId } : {})}
          ref={codeRef}
          type="text"
          name="username"
          autoComplete="username"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          maxLength={FAMILY_CODE_INPUT_MAX}
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
          }}
        />
        <PinField
          label={t.pinLabel}
          hint={t.pinHint}
          {...(errors.pin ? { error: errors.pin } : {})}
          {...(serverError ? { describedBy: summaryId } : {})}
          value={pin}
          onChange={setPin}
          autoComplete="current-password"
          ref={pinRef}
        />
        <Button type="submit" block large disabled={submitting}>
          {submitting ? t.submitting : t.submit}
        </Button>
      </form>
      <p>
        {t.noAccount} <Link to="/create-account">{t.createInstead}</Link>
      </p>
    </Page>
  );
}
