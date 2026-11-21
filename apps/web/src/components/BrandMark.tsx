/**
 * The app's mark: a small baby on a mat, from the same drawing set as the lessons. A stand-in
 * until the client sends their logo (the brief lists a logo among what the client owes).
 */
export function BrandMark() {
  return (
    <svg className="brand__mark" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <rect width="40" height="40" rx="12" fill="var(--color-primary)" />
      <rect x="6" y="27" width="28" height="4" rx="2" fill="var(--color-ill-mat)" />
      <ellipse cx="17" cy="23" rx="8.5" ry="4" fill="var(--color-ill-cloth)" />
      <circle cx="28" cy="19" r="5" fill="var(--color-ill-skin-3)" />
      <circle cx="30" cy="18.5" r="0.9" fill="var(--color-ill-hair)" />
    </svg>
  );
}
