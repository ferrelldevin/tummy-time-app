import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { axeViolations } from "./axe";
import { sidewaysOverflow } from "./layout";
import { NEXT_BUILD_COOKIE } from "./next-build-preview";
import {
  buildLabel,
  signUp,
  tapNav,
  targetsAtLeast44,
  waitForServiceWorker,
} from "./offline-helpers";

/**
 * A new version reaching a phone (Block 7, threat model #17), with the real service worker.
 *
 * How a "new version" is made here: playwright.config.ts builds the app twice. dist/ is labelled
 * "local"; dist-e2e-next/ is the same code labelled "e2e-next", so its index.html, and with it
 * the worker's file list and sw.js, differ, just as after a real deploy. A browser that carries
 * the test cookie is served the second build (e2e/next-build-preview.ts); no other test sees it.
 *
 * "Coming back to the front" is played by sending the page a visibilitychange event while it is
 * visible, which is what the browser sends when a person switches back to the app.
 */

async function deployNextVersion(context: BrowserContext): Promise<void> {
  const [name, value] = NEXT_BUILD_COOKIE.split("=");
  await context.addCookies([
    { name: name ?? "", value: value ?? "", url: "http://127.0.0.1:4173", sameSite: "Lax" },
  ]);
}

async function comeBackToTheFront(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

const notice = (page: Page) => page.locator(".update-notice");

/** A mark that only survives while the page is not reloaded. */
async function markPage(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as { stillThisPage: boolean }).stillThisPage = true;
  });
}
async function samePage(page: Page): Promise<boolean> {
  return page.evaluate(
    () => (window as unknown as { stillThisPage?: boolean }).stillThisPage === true,
  );
}

test("a new version shows Update available; Update now, by keyboard, switches to it (axe, 320 px, 44 px)", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  // A screen with typed text, so no safe moment can apply the update before the button does.
  await page.goto("/sign-in");
  await waitForServiceWorker(page);
  await page.getByLabel("Family code", { exact: true }).fill("ABCD");
  await deployNextVersion(context);
  await comeBackToTheFront(page);
  await expect(notice(page)).toBeVisible();
  // Inside a polite live region that was on the page before it appeared.
  await expect(page.locator(".update-slot")).toHaveAttribute("role", "status");
  await expect(notice(page)).toContainText(
    "Update available. Update now to get the newest version of the app and its lessons.",
  );
  // Typed text holds the safe moments back; the page was not reloaded by itself.
  await comeBackToTheFront(page);
  await page.waitForTimeout(500);
  expect(await buildLabel(page)).toBe("local");
  await expect(page.getByLabel("Family code", { exact: true })).toHaveValue("ABCD");

  expect(await axeViolations(page)).toEqual([]);
  expect(await sidewaysOverflow(page)).toBeLessThanOrEqual(0);
  await targetsAtLeast44(page, ".update-notice", "update notice");

  // Keyboard: the notice's button comes right after the header and before the screen itself.
  // From the first field, Shift+Tab goes back to it; once more, to the header's Sign in.
  const button = page.getByRole("button", { name: "Update now" });
  await page.getByLabel("Family code", { exact: true }).focus();
  await page.keyboard.press("Shift+Tab");
  await expect(button).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("banner").getByRole("link", { name: "Sign in" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(button).toBeFocused();
  await page.keyboard.press("Enter");
  await expect.poll(() => buildLabel(page)).toBe("e2e-next");
  await expect(notice(page)).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
});

test("by itself: never under a running timer, even at safe moments; at the next safe moment once it stops", async ({
  page,
  context,
}) => {
  await signUp(page, "518274");
  await waitForServiceWorker(page);
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Start tummy time" }).first().click();
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByRole("button", { name: "Stop and save" })).toBeVisible();

  await deployNextVersion(context);
  await comeBackToTheFront(page);
  await expect(notice(page)).toBeVisible();
  await markPage(page);

  // Safe moments, all held back by the running timer. The notice is at the top of each screen.
  for (const [nav, title] of [
    ["When to call", "When to call"],
    ["Home", "Tummy Time"],
    ["Log", "Log"],
    ["Lessons", "Lessons"],
  ] as const) {
    await tapNav(page, nav);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.locator("main > :first-child")).toContainText("Update available.");
    await comeBackToTheFront(page);
  }
  // The button too: it says to stop the timer first.
  await page.getByRole("button", { name: "Update now" }).click();
  await expect(notice(page)).toContainText("Stop the timer first. Then you can update.");
  // Waiting here is the point: a reload, if one were coming, comes within this time.
  await page.waitForTimeout(1500);
  expect(await samePage(page)).toBe(true);
  expect(await buildLabel(page)).toBe("local");

  // The timer is still running, on the old version.
  await tapNav(page, "Log");
  await page.getByRole("link", { name: "Start tummy time" }).first().click();
  await page.getByRole("button", { name: "Stop and save" }).click();
  await expect(page.getByText("of tummy time. Every minute counts.")).toBeVisible();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  expect(await samePage(page)).toBe(true);

  // Stopped and saved: the next screen change is a safe moment, and it switches.
  await page.getByRole("link", { name: "See your log" }).click();
  await expect.poll(() => buildLabel(page)).toBe("e2e-next");
  expect(await samePage(page).catch(() => false)).toBe(false);
  await expect(page.getByRole("heading", { level: 1, name: "Log" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Delete / })).toHaveCount(1);
});

test("by itself: coming back to the front with nothing going on switches to it", async ({
  page,
  context,
}) => {
  await page.goto("/lessons");
  await waitForServiceWorker(page);
  await deployNextVersion(context);
  await comeBackToTheFront(page);
  await expect(notice(page)).toBeVisible();
  await comeBackToTheFront(page);
  await expect.poll(() => buildLabel(page)).toBe("e2e-next");
  await expect(page.getByRole("heading", { level: 1, name: "Lessons" })).toBeVisible();
});
