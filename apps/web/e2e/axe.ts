import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

/**
 * Waits until every fade or slide that is going to end has ended. A button's background fades
 * for a moment when it changes (styles.css, .btn). If axe measures colors halfway through the
 * fade, it reports a contrast the person never rests on, and whether it does depends on timing.
 * The check is of the screen as it settles, so wait for it to settle. An animation that never
 * ends is not waited for.
 */
async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const ending = document
      .getAnimations()
      .filter((animation) => Number.isFinite(animation.effect?.getComputedTiming().endTime));
    await Promise.all(ending.map((animation) => animation.finished.catch(() => undefined)));
  });
}

/** Runs axe with every WCAG 2.0 to 2.2 A and AA rule plus best practices. Contrast is on. */
export async function axeViolations(page: Page) {
  await settle(page);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  return results.violations;
}
