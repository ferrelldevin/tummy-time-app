import { useState } from "react";
import type { Ref } from "react";
import { en } from "../strings/en";
import { Button } from "./Button";
import { TextField } from "./TextField";

export interface PinFieldProps {
  label: string;
  hint?: string;
  error?: string;
  describedBy?: string;
  value: string;
  onChange: (value: string) => void;
  /** "new-password" when choosing a PIN, "current-password" when typing it, so a password manager can help. */
  autoComplete: "new-password" | "current-password";
  ref?: Ref<HTMLInputElement>;
}

/**
 * A PIN input. It is a password field (hidden as it is typed) that opens the number pad on a
 * phone, with a Show PIN button so a tired person can check what they typed. Paste is allowed.
 */
export function PinField({
  label,
  hint,
  error,
  describedBy,
  value,
  onChange,
  autoComplete,
  ref,
}: PinFieldProps) {
  const [shown, setShown] = useState(false);
  return (
    <TextField
      label={label}
      {...(hint ? { hint } : {})}
      {...(error ? { error } : {})}
      {...(describedBy ? { describedBy } : {})}
      ref={ref}
      type={shown ? "text" : "password"}
      inputMode="numeric"
      autoComplete={autoComplete}
      autoCorrect="off"
      spellCheck={false}
      maxLength={12}
      value={value}
      onChange={(event) => {
        onChange(event.target.value);
      }}
      after={
        <Button
          variant="secondary"
          className="field__toggle"
          aria-pressed={shown}
          onClick={() => {
            setShown((s) => !s);
          }}
        >
          {en.account.pin.show}
        </Button>
      }
    />
  );
}
