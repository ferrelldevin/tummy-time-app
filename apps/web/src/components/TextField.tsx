import { useId } from "react";
import type { InputHTMLAttributes, ReactNode, Ref } from "react";
import { en } from "../strings/en";

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  hint?: string;
  /** When set, the field is marked invalid and the message is shown in text under it. */
  error?: string;
  /** IDs of other elements that describe this field, such as a form's error summary. */
  describedBy?: string;
  /** Lets a form move focus to this field (for example to the first one with an error). */
  ref?: Ref<HTMLInputElement> | undefined;
  /** Shown right after the input, inside the field (for example a "Show PIN" button). */
  after?: ReactNode;
}

/** A labeled input. The label is always visible. The error is text, not only color. */
export function TextField({
  label,
  hint,
  error,
  required,
  describedBy: extraDescribedBy,
  ref,
  after,
  ...rest
}: TextFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : "", error ? errorId : "", extraDescribedBy ?? ""]
    .filter(Boolean)
    .join(" ");
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
        ref={ref}
        id={id}
        className="field__input"
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
      />
      {after}
      {error ? (
        <p className="field__error" id={errorId}>
          {en.field.errorPrefix} {error}
        </p>
      ) : null}
    </div>
  );
}
