import { useId } from "react";
import type { InputHTMLAttributes } from "react";
import { en } from "../strings/en";

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  hint?: string;
  /** When set, the field is marked invalid and the message is shown in text under it. */
  error?: string;
}

/** A labeled input. The label is always visible. The error is text, not only color. */
export function TextField({ label, hint, error, required, ...rest }: TextFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : "", error ? errorId : ""].filter(Boolean).join(" ");
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
        {required ? ` ${en.field.required}` : ""}
      </label>
      {hint ? (
        <p className="field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      <input
        {...rest}
        id={id}
        className="field__input"
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
      />
      {error ? (
        <p className="field__error" id={errorId}>
          {en.field.errorPrefix} {error}
        </p>
      ) : null}
    </div>
  );
}
