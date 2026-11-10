import type { Page } from "@playwright/test";

/**
 * How many pixels the page can scroll sideways. 0 means it cannot.
 *
 * The page scrolls inside .app-scroll (the bottom bar sits under that area, not on top of it),
 * so content that is too wide would scroll there and the document itself would not show it.
 * Both are measured and the larger is returned.
 */
export function sidewaysOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const areas = [document.documentElement, ...document.querySelectorAll(".app-scroll")];
    return Math.max(...areas.map((el) => el.scrollWidth - el.clientWidth));
  });
}

/**
 * Doubles the text size, as a person can in their browser settings, and checks that it took.
 *
 * It sets the size on the root element from script. A <style> tag added by the test would be
 * refused by the page's Content Security Policy (no inline styles), the size would not change,
 * and the test would pass without testing anything; so this also fails if the size did not
 * double.
 */
export async function doubleTextSize(page: Page): Promise<void> {
  const sizes = await page.evaluate(() => {
    const root = document.documentElement;
    const before = Number.parseFloat(getComputedStyle(root).fontSize);
    root.style.setProperty("font-size", "200%", "important");
    return { before, after: Number.parseFloat(getComputedStyle(root).fontSize) };
  });
  if (!(sizes.before > 0) || Math.abs(sizes.after - sizes.before * 2) > 0.5) {
    throw new Error(
      `Text size did not double: ${String(sizes.before)} to ${String(sizes.after)} px`,
    );
  }
}
