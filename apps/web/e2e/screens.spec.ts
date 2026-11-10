import { expect, test } from "@playwright/test";
import { axeViolations } from "./axe";

const screens = [
  { path: "/start-tummy-time", title: "Start tummy time" },
  { path: "/baby-crying", title: "Baby crying? Try this" },
  { path: "/when-to-call", title: "When to call" },
  { path: "/lessons", title: "Lessons" },
  { path: "/log", title: "Log" },
  { path: "/no-such-page", title: "Page not found" },
];

for (const { path, title } of screens) {
  test(`${title} screen has its heading and no accessibility violations`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page).toHaveTitle(`${title} | Tummy Time`);
    if (path !== "/no-such-page" && path !== "/lessons" && path !== "/log") {
      await expect(page.getByText("Draft. Not yet reviewed by a clinician.")).toBeVisible();
    }
    expect(await axeViolations(page)).toEqual([]);
  });
}

test("Home action buttons lead to their placeholder screens", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Start tummy time" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Start tummy time" })).toBeFocused();
  await page.goBack();
  await page.getByRole("link", { name: "Baby crying? Try this" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Baby crying? Try this" }),
  ).toBeFocused();
});

for (const path of [
  "/",
  "/start-tummy-time",
  "/baby-crying",
  "/when-to-call",
  "/lessons",
  "/log",
]) {
  test(`${path} holds at 320 px wide with no sideways scroll`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    expect(await axeViolations(page)).toEqual([]);
  });
}

test("every link and button is at least 44 by 44 px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  for (const path of ["/", "/when-to-call"]) {
    await page.goto(path);
    const targets = page.locator("a:visible, button:visible");
    const count = await targets.count();
    expect(count).toBeGreaterThan(4);
    for (let i = 0; i < count; i++) {
      const box = await targets.nth(i).boundingBox();
      const name = await targets.nth(i).innerText();
      expect(box?.width ?? 0, `${path}: ${name} width`).toBeGreaterThanOrEqual(44);
      expect(box?.height ?? 0, `${path}: ${name} height`).toBeGreaterThanOrEqual(44);
    }
  }
});

test("the page holds at 200% text size with no sideways scroll", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/");
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page.getByRole("link", { name: "When to call" })).toBeVisible();
});

test("the style guide is not part of the production build", async ({ page }) => {
  await page.goto("/styleguide");
  await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
  await expect(page.getByText("Style guide (development only)")).toHaveCount(0);
});
