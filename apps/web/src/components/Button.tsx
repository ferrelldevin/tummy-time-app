import type { ButtonHTMLAttributes, Ref } from "react";

export type ButtonVariant = "primary" | "secondary";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  block?: boolean;
  large?: boolean;
  /** Lets a screen move focus to this button (for example to Undo after a delete). */
  ref?: Ref<HTMLButtonElement> | undefined;
}

/** A real <button>. Defaults to type="button" so it never submits a form by accident. */
export function Button({
  variant = "primary",
  block = false,
  large = false,
  type = "button",
  className,
  ...rest
}: ButtonProps) {
  const classes = ["btn", `btn--${variant}`, block ? "btn--block" : "", large ? "btn--large" : ""]
    .concat(className ?? "")
    .filter(Boolean)
    .join(" ");
  return <button type={type} className={classes} {...rest} />;
}
