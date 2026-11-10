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
