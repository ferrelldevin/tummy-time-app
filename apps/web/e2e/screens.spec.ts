import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { axeViolations } from "./axe";
import { sidewaysOverflow } from "./layout";

const screens = [
  // Start tummy time and the Log need sign-in (Blocks 4 and 6). Signed out, they show the
  // Welcome screen. The signed-in screens are checked in log.spec.ts.
  { path: "/start-tummy-time", title: "Welcome", draft: false },
  { path: "/baby-crying", title: "Baby crying? Try this", draft: true },
  { path: "/when-to-call", title: "When to call", draft: true },
  { path: "/lessons", title: "Lessons", draft: true },
  { path: "/lessons/first-lesson", title: "First lesson (placeholder)", draft: true },
  // The Log needs sign-in (Block 4). Signed out, it shows the Welcome screen. The signed-in Log
  // is checked in account.spec.ts.
  { path: "/log", title: "Welcome", draft: false },
  { path: "/welcome", title: "Welcome", draft: false },
  { path: "/sign-in", title: "Sign in", draft: false },
  { path: "/create-account", title: "Create account", draft: false },
  { path: "/signed-out", title: "Signed out", draft: false },
  { path: "/no-such-page", title: "Page not found", draft: false },
];

for (const { path, title, draft } of screens) {
  test(`${path} (${title}) has its heading and no accessibility violations`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page).toHaveTitle(`${title} | Tummy Time`);
    if (draft) {
      await expect(page.getByText("Draft. Not yet reviewed by a clinician.")).toBeVisible();
    }
    expect(await axeViolations(page)).toEqual([]);
  });
}

test("Home action buttons lead to their screens", async ({ page }) => {
  await page.goto("/");
  // Signed out, Start tummy time asks the person to sign in first (Block 6).
  await page.getByRole("link", { name: "Start tummy time" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Welcome" })).toBeFocused();
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
  "/lessons/first-lesson",
  "/log",
]) {
  test(`${path} holds at 320 px wide with no sideways scroll`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await sidewaysOverflow(page);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(await axeViolations(page)).toEqual([]);
  });
}

test("every link and button is at least 44 by 44 px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  for (const path of ["/", "/when-to-call", "/lessons", "/lessons/first-lesson"]) {
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
  const overflow = await sidewaysOverflow(page);
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page.getByRole("link", { name: "When to call" })).toBeVisible();
});

test("the style guide is not part of the production build", async ({ page }) => {
  await page.goto("/styleguide");
  await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
  await expect(page.getByText("Style guide (development only)")).toHaveCount(0);
});

// Proof that "a new lesson appears by adding one file, with no code change": the screen is
// compared with whatever files are in content/lessons when the test runs. The app finds the
// files with a glob at build time, so a file added to the folder changes this list by itself.
test("the lessons list shows exactly the files in content/lessons", async ({ page }) => {
  const dir = resolve(import.meta.dirname, "../../../content/lessons");
  const titles = readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => /^title:\s*(.+)$/m.exec(readFileSync(resolve(dir, f), "utf8"))?.[1]?.trim());
  expect(titles.length).toBeGreaterThan(0);
  await page.goto("/lessons");
  const links = page.locator("ul.lesson-list a");
  await expect(links).toHaveCount(titles.length);
  expect((await links.allInnerTexts()).sort()).toEqual([...titles].sort());
});

test("the emergency line shows on When to call and the screen opens in one tap from a lesson", async ({
  page,
}) => {
  await page.goto("/lessons/first-lesson");
  await page.getByRole("navigation").getByRole("link", { name: "When to call" }).click();
  await expect(page.getByTestId("emergency-line")).toHaveText(
    "Trouble breathing or turning blue: call 911.",
  );
});

test("an unknown lesson shows page not found", async ({ page }) => {
  await page.goto("/lessons/no-such-lesson");
  await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
  expect(await axeViolations(page)).toEqual([]);
});
