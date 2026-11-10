import type { ReactNode } from "react";
import { en } from "../strings/en";

export type AlertKind = "info" | "success" | "error";

export interface AlertProps {
  kind?: AlertKind;
  /** Errors are announced right away. Notes and done messages wait for a pause. */
  children: ReactNode;
}

const icons: Record<AlertKind, string> = {
  info: "M12 2a10 10 0 100 20 10 10 0 000-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z",
  success: "M12 2a10 10 0 100 20 10 10 0 000-20zm-2 15l-5-5 1.4-1.4L10 14.2l7.6-7.6L19 8l-9 9z",
  error: "M12 2L1 21h22L12 2zm1 15h-2v-2h2v2zm0-4h-2V9h2v4z",
};

/** A message box. Meaning comes from the icon and the word, never from color alone. */
export function Alert({ kind = "info", children }: AlertProps) {
  return (
    <div className={`alert alert--${kind}`} role={kind === "error" ? "alert" : "status"}>
      <svg className="alert__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d={icons[kind]} fill="currentColor" />
      </svg>
      <div className="alert__body">
        <p>
          <span className="alert__label">{en.alert[kind]}:</span> {children}
        </p>
      </div>
    </div>
  );
}
