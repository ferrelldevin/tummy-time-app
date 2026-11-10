import { en } from "../strings/en";

/** True when the build was made with SITE_BANNER=test. Anything else means the real site. */
export function isTestSite(value: string): boolean {
  return value === "test";
}

/**
 * "Test site. Sample data." on every screen of a test site (build plan, Block 8). Nothing is
 * drawn on the real site. The words are in the string catalog; the switch is a build setting.
 * `show` exists so tests can try both states without rebuilding.
 */
export function SiteBanner({ show = isTestSite(__SITE_BANNER__) }: { show?: boolean }) {
  if (!show) return null;
  return (
    <div className="site-banner" role="region" aria-label={en.testSiteBanner}>
      <p className="site-banner__text">{en.testSiteBanner}</p>
    </div>
  );
}
