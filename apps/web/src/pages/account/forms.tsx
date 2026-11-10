import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { PIN_PATTERN } from "@tummy/shared";
import type { ApiFailure } from "../../api";
import { Alert } from "../../components/Alert";
import { en } from "../../strings/en";

/** What a person typed as a PIN, made comparable: spaces removed (some people type "482 916"). */
export function cleanPin(value: string): string {
  return value.replace(/\s/g, "");
}

export function pinProblem(value: string): string | undefined {
  const pin = cleanPin(value);
  if (pin === "") return en.account.errors.pinMissing;
  if (!PIN_PATTERN.test(pin)) return en.account.errors.pinShape;
  return undefined;
}

/** The words for an answer from the API that is not a success. */
export function failureText(error: ApiFailure, wrongCredential: string): string {
  switch (error) {
    case "sign_in_failed":
      return wrongCredential;
    case "account_locked":
      return en.account.errors.locked;
    case "rate_limited":
      return en.account.errors.rateLimited;
    case "weak_pin":
      return en.account.errors.weakPin;
    case "unauthorized":
      return en.account.errors.signedOutAlready;
    case "network":
      return en.account.errors.network;
    default:
      return en.account.errors.unexpected;
  }
}

/**
 * Moves focus after a failed submit: to the first field with a problem, or to the summary when
 * the problem came from the server. A screen reader then reads the field and its error. The
 * request counter makes a second failed submit move focus again.
 */
export function useFocusAfterSubmit() {
  const [request, setRequest] = useState<{
    target: RefObject<HTMLElement | null>;
    n: number;
  } | null>(null);
  useEffect(() => {
    request?.target.current?.focus();
  }, [request]);
  return (target: RefObject<HTMLElement | null>) => {
    setRequest((r) => ({ target, n: (r?.n ?? 0) + 1 }));
  };
}

/**
 * The list of problems at the top of a form. role="alert" (from Alert) makes a screen reader
 * announce it as soon as it appears; fields name it in aria-describedby; focus can land on it.
 */
export function ErrorSummary({
  id,
  problems,
  ref,
}: {
  id: string;
  problems: string[];
  ref: RefObject<HTMLDivElement | null>;
}) {
  if (problems.length === 0) {
    return <div id={id} ref={ref} tabIndex={-1} hidden />;
  }
  return (
    <div id={id} ref={ref} tabIndex={-1} className="error-summary">
      <Alert kind="error">
        {en.account.errors.summary}{" "}
        {problems.length === 1 ? (
          problems[0]
        ) : (
          <span className="error-summary__list">
            {problems.map((p) => (
              <span key={p} className="error-summary__item">
                {p}
              </span>
            ))}
          </span>
        )}
      </Alert>
    </div>
  );
}

/**
 * Shown on a screen that needs the server while the phone is offline: one plain sentence, in
 * place of pretending to try. Focus moves here when the person presses the button anyway.
 */
export function NeedsConnection({
  text,
  ref,
}: {
  text: string;
  ref: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div ref={ref} tabIndex={-1} className="needs-connection">
      <Alert kind="info">{text}</Alert>
    </div>
  );
}

export function useSummaryRef() {
  return useRef<HTMLDivElement>(null);
}
