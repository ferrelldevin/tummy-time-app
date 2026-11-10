import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

/** Runs axe with every WCAG 2.0 to 2.2 A and AA rule plus best practices. Contrast is on. */
export async function axeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  return results.violations;
}
