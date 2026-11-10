import axe from "axe-core";

/**
 * Runs axe on a rendered piece of the page and returns the violations.
 * The color-contrast rule is off here ONLY because jsdom has no layout or real colors, so the
 * rule cannot give a true answer. Contrast is covered two other ways: design/tokens.test.ts
 * checks every token pair, and the Playwright suite runs axe with contrast on in a real browser.
 */
export async function axeViolations(container: Element): Promise<axe.Result[]> {
  const results = await axe.run(container, {
    rules: { "color-contrast": { enabled: false } },
    runOnly: {
      type: "tag",
      values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"],
    },
  });
  return results.violations;
}
