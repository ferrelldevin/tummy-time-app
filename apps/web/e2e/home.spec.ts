import { expect, test } from "@playwright/test";
import { axeViolations } from "./axe";

test("home page works on a phone and has no accessibility violations", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Tummy Time" })).toBeVisible();
  await expect(page.getByText("Server is reachable")).toBeVisible();
  await expect(page).toHaveTitle("Tummy Time");
  expect(await axeViolations(page)).toEqual([]);
});

test("Home, then When to call, then back (tap)", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "When to call" }).click();
  const heading = page.getByRole("heading", { level: 1, name: "When to call" });
  await expect(heading).toBeVisible();
  await expect(heading).toBeFocused();
  await expect(page).toHaveTitle("When to call | Tummy Time");
  expect(await axeViolations(page)).toEqual([]);

  await page.goBack();
  await expect(page.getByRole("heading", { level: 1, name: "Tummy Time" })).toBeFocused();
  await expect(page).toHaveTitle("Tummy Time");
});

test("keyboard only: Home, then When to call, then back", async ({ page }) => {
  await page.goto("/");
  // The skip link is the first stop and is visible when focused.
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to main content" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();

  // Tab through to the When to call link in the bottom bar.
  const target = page.getByRole("navigation", { name: "Main" }).getByRole("link", {
    name: "When to call",
  });
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((el) => el === document.activeElement)) {
      break;
    }
  }
  await expect(target).toBeFocused();
  // Focus must be clearly visible: a thick outline.
  const outline = await target.evaluate((el) => getComputedStyle(el).outlineWidth);
  expect(parseFloat(outline)).toBeGreaterThanOrEqual(3);

  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "When to call" })).toBeFocused();

  // Back with the keyboard: Home in the bottom bar.
  const home = page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Home" });
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Shift+Tab");
    if (await home.evaluate((el) => el === document.activeElement)) {
      break;
    }
  }
  await expect(home).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "Tummy Time" })).toBeFocused();
});

test("When to call is in the bottom bar on every screen", async ({ page }) => {
  for (const path of ["/", "/start-tummy-time", "/baby-crying", "/lessons", "/log"]) {
    await page.goto(path);
    await page.getByRole("link", { name: "When to call" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "When to call" })).toBeVisible();
  }
});
