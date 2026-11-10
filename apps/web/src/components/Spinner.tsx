import { en } from "../strings/en";

export interface SpinnerProps {
  /** Words shown next to the ring. These are also what a screen reader hears. */
  label?: string;
}

/** A busy indicator with a visible text alternative. The ring is decoration only. */
export function Spinner({ label = en.states.loading }: SpinnerProps) {
  return (
    <div className="spinner" role="status">
      <span className="spinner__ring" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
