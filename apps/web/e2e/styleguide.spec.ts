import { expect, test } from "@playwright/test";
import { axeViolations } from "./axe";
import { sidewaysOverflow } from "./layout";

// Runs against the development server, the only place /styleguide exists.

test("style guide has no accessibility violations", async ({ page }) => {
  await page.goto("/styleguide");
  await expect(
    page.getByRole("heading", { level: 1, name: "Style guide (development only)" }),
  ).toBeVisible();
  expect(await axeViolations(page)).toEqual([]);
});

test("style guide holds at 320 px wide with no sideways scroll", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/styleguide");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const overflow = await sidewaysOverflow(page);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("dialog traps focus, closes on Escape and returns focus to the opener", async ({ page }) => {
  await page.goto("/styleguide");
  const opener = page.getByRole("button", { name: "Open dialog" });
  await opener.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Example dialog" });
  await expect(dialog).toBeVisible();
  expect(await axeViolations(page)).toEqual([]);

  // Tab many times. A modal dialog makes the rest of the page inert, so focus may sit inside the
  // dialog or leave the page for the browser's own controls (then document.activeElement is the
  // body). It must never land on the page behind the dialog.
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    const where = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body || el === document.documentElement) {
        return "browser";
      }
      return el.closest("dialog") ? "dialog" : "page";
    });
    expect(where).not.toBe("page");
  }

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});

test("dialog closes with its Close button and returns focus", async ({ page }) => {
  await page.goto("/styleguide");
  const opener = page.getByRole("button", { name: "Open dialog" });
  await opener.click();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(opener).toBeFocused();
});

test("reduced motion stops the spinner from animating", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/styleguide");
  // Wait for the style guide itself. Until its lazy file arrives, the only spinner on the page
  // is the loading fallback, which is then removed (reading it gives an empty style).
  await expect(
    page.getByRole("heading", { level: 1, name: "Style guide (development only)" }),
  ).toBeVisible();
  const name = await page
    .locator(".spinner__ring")
    .first()
    .evaluate((el) => getComputedStyle(el).animationName);
  expect(name).toBe("none");
});

test("the spinner animates when motion is allowed", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/styleguide");
  // Wait for the style guide itself. Until its lazy file arrives, the only spinner on the page
  // is the loading fallback, which is then removed (reading it gives an empty style).
  await expect(
    page.getByRole("heading", { level: 1, name: "Style guide (development only)" }),
  ).toBeVisible();
  const name = await page
    .locator(".spinner__ring")
    .first()
    .evaluate((el) => getComputedStyle(el).animationName);
  expect(name).toBe("spin");
});
