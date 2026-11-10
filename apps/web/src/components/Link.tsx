import type { ComponentProps } from "react";
import { Link as RouterLink } from "react-router";

export interface LinkProps extends ComponentProps<typeof RouterLink> {
  /** "link" looks like text. "primary" and "secondary" look like the matching Button. */
  appearance?: "link" | "primary" | "secondary";
  block?: boolean;
  large?: boolean;
}

/** An in-app link (no full page load). Link-looking or button-looking, always a real <a>. */
export function Link({
  appearance = "link",
  block = false,
  large = false,
  className,
  ...rest
}: LinkProps) {
  const classes =
    appearance === "link"
      ? ["link"]
      : ["btn", `btn--${appearance}`, block ? "btn--block" : "", large ? "btn--large" : ""];
  const joined = classes
    .concat(typeof className === "string" ? className : "")
    .filter(Boolean)
    .join(" ");
  return <RouterLink className={joined} {...rest} />;
}
