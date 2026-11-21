import type { Page } from "@playwright/test";

/**
 * How many pixels the page can scroll sideways. 0 means it cannot.
 *
 * The page scrolls inside .app-scroll (the bottom bar sits under that area, not on top of it),
 * so content that is too wide would scroll there and the document itself would not show it.
 * Both are measured, along with any box that sticks out past the screen edge, and the largest
 * is returned.
 */
export function sidewaysOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const areas = [document.documentElement, ...document.querySelectorAll(".app-scroll")];
    const scroll = Math.max(...areas.map((el) => el.scrollWidth - el.clientWidth));
    // A box can also stick out past the screen edge inside a card that clips it, which scrolls
    // nothing but cuts off what is there. Measure every box that takes up space.
    const width = document.documentElement.clientWidth;
    let stickOut = 0;
    for (const el of document.body.querySelectorAll("*")) {
      // Shapes inside a drawing are clipped by the drawing's own box; measure the <svg> itself.
      if (el.parentElement?.closest("svg")) continue;
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      stickOut = Math.max(stickOut, Math.round(box.right - width), Math.round(-box.left));
    }
    return Math.max(scroll, stickOut);
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
