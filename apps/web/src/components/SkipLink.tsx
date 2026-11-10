import { en } from "../strings/en";

export interface SkipLinkProps {
  /** The id of the element to jump to. It must exist on the page. */
  targetId: string;
  label?: string;
}

/** First stop for keyboard users. Hidden until focused. */
export function SkipLink({ targetId, label = en.skipLink }: SkipLinkProps) {
  return (
    <a className="skip-link" href={`#${targetId}`}>
      {label}
    </a>
  );
}
