import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { axeViolations } from "../e2e/axe";
import { doubleTextSize, sidewaysOverflow } from "../e2e/layout";

const nav = (page: Page) => page.getByRole("navigation", { name: "Main" });

/** Fails the test on any script error or blocked resource (a CSP refusal is a console error). */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  return errors;
}

async function noViolations(page: Page) {
  expect(await axeViolations(page)).toEqual([]);
}

test("the whole demo click path works, passes axe on every screen, with no errors", async ({
  page,
}) => {
  const errors = watchErrors(page);
  await page.goto("/");
  await expect(page.getByText("Test site. Sample data.")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Tummy Time" })).toBeVisible();
  await noViolations(page);

  // Getting started: 4 questions, then the plan.
  await page.getByRole("link", { name: "Get started" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("alert")).toHaveText("Pick one answer to go on.");
  await noViolations(page);
  await page.getByLabel("2 to 4 months").check();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel("Early (28 to 33 weeks)").check();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel("None of these, or not sure").check();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel("My baby cries or fusses").check();
  const scroller = page.locator(".app-scroll");
  await scroller.evaluate((el) => {
    el.scrollTo(0, el.scrollHeight);
  });
  expect(await scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "See my plan" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Your plan" })).toBeFocused();
  // A new screen opens at the top, header in sight, even from far down the last one.
  expect(await scroller.evaluate((el) => el.scrollTop)).toBe(0);
  await expect(page.getByText("About 0 to 2 months")).toBeVisible();
  await noViolations(page);

  // A lesson: quick check, mark as done, next lesson.
  await page.getByRole("link", { name: "Start the first lesson" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Why tummy time matters" }),
  ).toBeVisible();
  await page.getByLabel("When your baby falls asleep").check();
  await expect(page.getByText("Not quite.")).toBeVisible();
  await page.getByLabel("When your baby is awake and you are watching").check();
  await expect(page.getByText("That's right.")).toBeVisible();
  await noViolations(page);
  await page.getByRole("button", { name: "Mark as done" }).click();
  await expect(page.getByText("Done. Nice work.")).toBeVisible();
  await page.getByRole("link", { name: /^Next lesson: When your baby fusses/ }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "When your baby fusses" }),
  ).toBeVisible();

  // Home shows the plan's progress and the corrected age.
  await nav(page).getByRole("link", { name: "Home" }).click();
  await expect(page.getByText(/^1 of \d+ lessons done$/)).toBeVisible();
  await expect(page.getByText(/Corrected age: 0 to 2 months/)).toBeVisible();
  await noViolations(page);

  // Baby crying? coach: skip the breathing, pick an idea, still crying.
  await page.getByRole("link", { name: /^Baby crying\? Try this/ }).click();
  await page.getByRole("button", { name: "Start breathing" }).click();
  await page.getByRole("button", { name: "Try one thing" }).click();
  await page.getByRole("button", { name: /chest/ }).click();
  await page.getByRole("button", { name: "Still crying" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "It is OK to stop" })).toBeVisible();
  await noViolations(page);

  // When to call is one tap away and keeps the fixed emergency line.
  await nav(page).getByRole("link", { name: "When to call" }).click();
  await expect(page.getByTestId("emergency-line")).toHaveText(
    "Trouble breathing or turning blue: call 911.",
  );

  // Signed out, the big Start tummy time button opens a timer that saves nothing.
  await nav(page).getByRole("link", { name: "Home" }).click();
  await page.getByRole("link", { name: "Start tummy time" }).click();
  await page.getByRole("button", { name: "Start" }).click();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await expect(page.getByText(/^That was .* of tummy time|^That was very short/)).toBeVisible();
  await noViolations(page);

  // Sign in as the sample family; the log shows the made-up week; start and stop the timer.
  await nav(page).getByRole("link", { name: "Log" }).click();
  await page.getByRole("link", { name: "Sign in" }).first().click();
  await page.getByLabel("Family code").fill("DEMQ 2345 TEST");
  await page.getByLabel("PIN", { exact: true }).fill("246810");
  await page.getByRole("button", { name: "Sign in" }).click();
  await nav(page).getByRole("link", { name: "Log" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "This week" })).toBeVisible();
  await noViolations(page);
  await page.getByRole("link", { name: "Start tummy time" }).click();
  await page.getByRole("button", { name: "Start" }).click();
  await page.waitForTimeout(2200);
  await page.getByRole("button", { name: "Stop and save" }).click();
  await expect(page.getByText(/Saved .* of tummy time/)).toBeVisible();

  // About: the demo panel can reset everything for the next viewer.
  await nav(page).getByRole("link", { name: "Home" }).click();
  await page.getByRole("link", { name: "About this app" }).click();
  await expect(page.getByText("DEMQ 2345 TEST")).toBeVisible();
  await noViolations(page);
  await page.getByRole("button", { name: "Reset the demo" }).click();
  await expect(page.getByRole("link", { name: "Get started" })).toBeVisible();

  expect(errors).toEqual([]);
});

test("nothing scrolls sideways at 200% text size on the main screens", async ({ page }) => {
  await page.goto("/");
  await doubleTextSize(page);
  const h1 = page.getByRole("heading", { level: 1 });
  // Wait for each screen's own heading, so the check measures that screen and not a loading one.
  for (const [name, heading] of [
    ["Lessons", "Lessons"],
    ["Log", "Welcome"],
    ["When to call", "When to call"],
    ["Home", "Tummy Time"],
  ] as const) {
    await nav(page).getByRole("link", { name }).click();
    await expect(h1).toHaveText(heading);
    expect(await sidewaysOverflow(page), name).toBeLessThanOrEqual(0);
  }
  await page.getByRole("link", { name: /^Baby crying\? Try this/ }).click();
  await expect(h1).toHaveText("Baby crying? Try this");
  expect(await sidewaysOverflow(page), "Baby crying?").toBeLessThanOrEqual(0);
});

test("with reduced motion asked for, nothing animates", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("link", { name: /^Baby crying\? Try this/ }).click();
  await page.getByRole("button", { name: "Start breathing" }).click();
  const running = await page.evaluate(() => document.getAnimations().length);
  expect(running).toBe(0);
});

test("the night theme follows the phone's dark mode and passes axe, contrast included", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  const h1 = page.getByRole("heading", { level: 1 });
  await expect(h1).toBeVisible();
  // There is no server in the demo, so Home says what is true instead of "Server is reachable".
  await expect(page.getByText(/^Demo with sample data\./)).toBeVisible();
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe("rgb(15, 24, 27)");
  await noViolations(page);
  // Signed out, Log opens Welcome.
  for (const [name, heading] of [
    ["Lessons", "Lessons"],
    ["Log", "Welcome"],
    ["When to call", "When to call"],
  ] as const) {
    await nav(page).getByRole("link", { name }).click();
    await expect(h1).toHaveText(heading);
    await noViolations(page);
  }
  await nav(page).getByRole("link", { name: "Lessons" }).click();
  await page
    .getByRole("link", { name: /Why tummy time matters/ })
    .first()
    .click();
  await expect(h1).toHaveText("Why tummy time matters");
  await noViolations(page);
  await nav(page).getByRole("link", { name: "Home" }).click();
  await page.getByRole("link", { name: /^Baby crying\? Try this/ }).click();
  await expect(h1).toHaveText("Baby crying? Try this");
  await noViolations(page);
});

test("each Getting started question opens at the top, from far down the last one", async ({
  page,
}) => {
  // A short screen, so every question is taller than the screen and the check means something.
  await page.setViewportSize({ width: 320, height: 480 });
  await page.goto("/");
  await page.getByRole("link", { name: "Get started" }).click();
  const scroller = page.locator(".app-scroll");
  for (const [answer, next] of [
    ["2 to 4 months", "Question 2 of 4"],
    ["Early (28 to 33 weeks)", "Question 3 of 4"],
  ] as const) {
    await page.getByLabel(answer).check();
    await scroller.evaluate((el) => {
      el.scrollTo(0, el.scrollHeight);
    });
    expect(await scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText(next)).toBeInViewport();
    expect(await scroller.evaluate((el) => el.scrollTop)).toBe(0);
  }
});
