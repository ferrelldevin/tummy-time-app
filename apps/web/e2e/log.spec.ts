import { expect, test, type Browser, type Page } from "@playwright/test";
import { axeViolations } from "./axe";
import { doubleTextSize, sidewaysOverflow } from "./layout";

/**
 * The tummy time log and sync in a real browser, through the real family-code-pin provider,
 * the real API and the real database (Block 6). PINs are made up and only used against the
 * throwaway test database.
 */

/** Sideways scroll check. One small local helper, so it can be swapped for a shared one later. */
async function noSidewaysScroll(page: Page): Promise<void> {
  expect(await sidewaysOverflow(page)).toBeLessThanOrEqual(0);
}

async function targetsAtLeast44(page: Page, where: string): Promise<void> {
  const targets = page.locator("a:visible, button:visible, input:visible");
  const count = await targets.count();
  expect(count).toBeGreaterThan(3);
  for (let i = 0; i < count; i += 1) {
    const box = await targets.nth(i).boundingBox();
    const name =
      (await targets.nth(i).getAttribute("aria-label")) ?? (await targets.nth(i).innerText());
    expect(box?.width ?? 0, `${where}: ${name} width`).toBeGreaterThanOrEqual(44);
    expect(box?.height ?? 0, `${where}: ${name} height`).toBeGreaterThanOrEqual(44);
  }
}

/** Presses Tab until the target has focus. Fails if it never does. */
async function tabTo(page: Page, target: ReturnType<Page["getByRole"]>): Promise<void> {
  for (let i = 0; i < 40; i += 1) {
    if (await target.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  await expect(target).toBeFocused();
}

/** Creates an account. Answers its family code. */
async function signUp(page: Page, pin: string): Promise<string> {
  await page.goto("/create-account");
  await page.getByLabel("PIN", { exact: true }).fill(pin);
  await page.getByLabel("Type the PIN again", { exact: true }).fill(pin);
  await page.getByRole("button", { name: "Create account" }).click();
  const code = (await page.getByTestId("family-code").innerText()).trim();
  await page.getByRole("button", { name: "I saved my code" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Log" })).toBeVisible();
  return code;
}

async function signIn(page: Page, code: string, pin: string): Promise<void> {
  await page.goto("/sign-in");
  await page.getByLabel("Family code", { exact: true }).fill(code);
  await page.getByLabel("PIN", { exact: true }).fill(pin);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Log" })).toBeVisible();
}

/** "Add a time" through the form, for a time `minutesAgo` before now on the browser's clock. */
async function addTime(page: Page, minutesAgo: number, minutes: number): Promise<void> {
  await page.getByRole("link", { name: "Add a time" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Add a time" })).toBeVisible();
  const { day, time } = await page.evaluate((ago) => {
    const d = new Date(Date.now() - ago * 60_000);
    const two = (n: number) => String(n).padStart(2, "0");
    return {
      day: `${String(d.getFullYear())}-${two(d.getMonth() + 1)}-${two(d.getDate())}`,
      time: `${two(d.getHours())}:${two(d.getMinutes())}`,
    };
  }, minutesAgo);
  await page.getByLabel("Day", { exact: true }).fill(day);
  await page.getByLabel("Start time", { exact: true }).fill(time);
  await page.getByLabel("Minutes", { exact: true }).fill(String(minutes));
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Log" })).toBeVisible();
}

async function hasLocalDatabase(page: Page): Promise<boolean> {
  return page.evaluate(async () =>
    (await indexedDB.databases()).some((d) => d.name === "tummy-time"),
  );
}

async function newPhone(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  return context.newPage();
}

test("keyboard only: start and stop the timer, hear it is saved, and see it in the log", async ({
  page,
}) => {
  await signUp(page, "593082");
  await page.goto("/start-tummy-time");
  await expect(page.getByRole("heading", { level: 1, name: "Start tummy time" })).toBeVisible();
  const timer = page.getByRole("timer");
  await expect(timer).toHaveAttribute("aria-live", "off");
  await expect(timer).toContainText("0 seconds");

  const control = page.getByRole("button", { name: "Start" });
  await tabTo(page, control);
  await page.keyboard.press("Enter");
  await expect(page.getByText("The timer is running.")).toBeVisible();
  // The running time is worked out from the start time; it moves on by itself.
  await expect(timer).toContainText("1 second");
  const stop = page.getByRole("button", { name: "Stop and save" });
  await expect(stop).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("status").filter({ hasText: "of tummy time. Every minute counts." }),
  ).toBeVisible();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  await tabTo(page, page.getByRole("link", { name: "See your log" }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "Log" })).toBeFocused();
  await expect(page.getByRole("heading", { level: 2, name: "Today" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Delete .* seconds?$/ })).toHaveCount(1);
});

test("keyboard only: delete an entry, then Undo it, and focus follows", async ({ page }) => {
  await signUp(page, "674153");
  await addTime(page, 30, 5);
  const del = page.getByRole("button", { name: /^Delete .*, 5 minutes$/ });
  await tabTo(page, del);
  await page.keyboard.press("Enter");
  const undo = page.getByRole("button", { name: "Undo" });
  await expect(undo).toBeFocused();
  await expect(page.getByText(/^Deleted .*, 5 minutes\.$/)).toBeVisible();
  // No time limit: Undo is still there after a while.
  await page.waitForTimeout(1500);
  await expect(undo).toBeVisible();
  expect(await axeViolations(page)).toEqual([]);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: /^Delete .*, 5 minutes$/ })).toBeFocused();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  // It is back on the server too: a fresh load shows it.
  await page.reload();
  await expect(page.getByRole("button", { name: /^Delete .*, 5 minutes$/ })).toBeVisible();
});

test("two phones on one account: add on A, open B, it is there; delete on B, open A, it is gone", async ({
  browser,
}) => {
  const a = await newPhone(browser);
  const b = await newPhone(browser);
  try {
    const code = await signUp(a, "847361");
    await addTime(a, 45, 12);
    await expect(a.getByText("Saved", { exact: true })).toBeVisible();

    await signIn(b, code, "847361");
    await expect(b.getByRole("button", { name: /^Delete .*, 12 minutes$/ })).toBeVisible();

    await b.getByRole("button", { name: /^Delete .*, 12 minutes$/ }).click();
    await expect(b.getByRole("button", { name: "Undo" })).toBeVisible();
    await expect(b.getByText("Saved", { exact: true })).toBeVisible();

    await a.goto("/log");
    await expect(a.getByText("No tummy time yet")).toBeVisible();
    await expect(a.getByRole("button", { name: /^Delete / })).toHaveCount(0);
  } finally {
    await a.context().close();
    await b.context().close();
  }
});

test("offline: a new time says Saved on this phone, then Saved once back online", async ({
  page,
  context,
}) => {
  await signUp(page, "315790");
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await context.setOffline(true);
  await addTime(page, 20, 8);
  await expect(page.getByText("Saved on this phone", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Delete .*, 8 minutes$/ })).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  // It reached the server.
  const answer = await page.request.get("/api/logs?since=0");
  expect(answer.status()).toBe(200);
  const body = (await answer.json()) as { entries: { durationSeconds: number }[] };
  expect(body.entries.map((e) => e.durationSeconds)).toEqual([480]);
});

test("sign out deletes this phone's copy of the log", async ({ page }) => {
  await signUp(page, "908246");
  await addTime(page, 15, 3);
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  expect(await hasLocalDatabase(page)).toBe(true);
  await page.goto("/account");
  await page.getByRole("button", { name: "Sign out on this phone" }).click();
  await expect(page.getByText("You are signed out on this phone.")).toBeVisible();
  await expect.poll(() => hasLocalDatabase(page)).toBe(false);
  const stored = await page.evaluate(() => ({
    local: localStorage.length,
    session: sessionStorage.length,
  }));
  expect(stored).toEqual({ local: 0, session: 0 });
});

test("the log screens: axe, 320 px with no sideways scroll, 44 px targets, When to call one tap away", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await signUp(page, "261947");
  await addTime(page, 25, 4);
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  const screens: [string, string][] = [
    ["/log", "Log"],
    ["/start-tummy-time", "Start tummy time"],
    ["/log/add", "Add a time"],
  ];
  for (const [path, title] of screens) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page).toHaveTitle(`${title} | Tummy Time`);
    expect(await axeViolations(page), path).toEqual([]);
    await noSidewaysScroll(page);
    await targetsAtLeast44(page, path);
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "When to call" })
      .click();
    await expect(page.getByRole("heading", { level: 1, name: "When to call" })).toBeVisible();
  }

  // Add a time with every error showing.
  await page.goto("/log/add");
  await page.getByLabel("Day", { exact: true }).fill("");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByLabel("Day", { exact: true })).toBeFocused();
  await expect(page.getByRole("alert")).toContainText("Pick the day.");
  expect(await axeViolations(page)).toEqual([]);
  await noSidewaysScroll(page);

  // The timer running, and the log with an Undo showing.
  await page.goto("/start-tummy-time");
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByRole("button", { name: "Stop and save" })).toBeVisible();
  expect(await axeViolations(page)).toEqual([]);
  await page.getByRole("button", { name: "Stop and save" }).click();
  await page.goto("/log");
  await page.getByRole("button", { name: /^Delete .*, 4 minutes$/ }).click();
  await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
  expect(await axeViolations(page)).toEqual([]);
  await targetsAtLeast44(page, "/log with Undo");
});

test("the timer and the log hold at 200% text with no sideways scroll", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await signUp(page, "730518");
  await addTime(page, 10, 9);
  for (const path of ["/start-tummy-time", "/log"]) {
    await page.goto(path);
    await doubleTextSize(page);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await noSidewaysScroll(page);
  }
});

test("the timer respects reduced motion and the start control is much bigger than 44 px", async ({
  browser,
}) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  try {
    await signUp(page, "482916");
    await page.goto("/start-tummy-time");
    const control = page.getByRole("button", { name: "Start" });
    const box = await control.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(88);
    const transition = await control.evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(transition).toBe("0s");
  } finally {
    await context.close();
  }
});
