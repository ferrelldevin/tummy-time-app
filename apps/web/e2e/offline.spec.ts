import { expect, test } from "@playwright/test";
import { axeViolations } from "./axe";
import { doubleTextSize, sidewaysOverflow } from "./layout";
import {
  addTime,
  cachedEntries,
  hasLocalDatabase,
  signIn,
  signUp,
  tapNav,
  targetsAtLeast44,
  waitForServiceWorker,
} from "./offline-helpers";

/**
 * Offline (Block 7), against the production build with its service worker really running.
 * Each test loads the app once with signal, switches the network off, and reloads: from then on
 * every file comes from the worker's cache. PINs are made up, for the throwaway test database.
 */

const EMERGENCY_LINE = "Trouble breathing or turning blue: call 911.";

test("after one visit with signal, the app, a lesson and When to call open with none", async ({
  page,
  context,
}) => {
  // Only Home is visited: the lesson and log files must come from the cache, never loaded yet.
  await page.goto("/");
  await waitForServiceWorker(page);
  await context.setOffline(true);

  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Tummy Time" })).toBeVisible();
  await expect(page.getByText("You are offline.")).toBeVisible();

  await tapNav(page, "Lessons");
  await expect(page.getByRole("heading", { level: 1, name: "Lessons" })).toBeVisible();
  await page.locator("ul.lesson-list a").first().click();
  await expect(page.getByRole("heading", { level: 1 })).not.toHaveText("Lessons");
  await expect(page.getByText("Draft. Not yet reviewed by a clinician.").first()).toBeVisible();

  await tapNav(page, "When to call");
  await expect(page.getByTestId("emergency-line")).toHaveText(EMERGENCY_LINE);

  // An address typed or opened from a bookmark, straight to a screen, with no signal.
  await page.goto("/lessons/first-lesson");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.goto("/when-to-call");
  await expect(page.getByTestId("emergency-line")).toHaveText(EMERGENCY_LINE);
});

test("signed in, offline: the app opens on the phone's copy, a new time is saved here, then reaches the server and the other phone", async ({
  browser,
}) => {
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  try {
    const code = await signUp(a, "264813");
    await waitForServiceWorker(a);
    await expect(a.getByText("Saved", { exact: true })).toBeVisible();

    await a.context().setOffline(true);
    await a.reload();
    // Signed in, not confirmed yet: the log, not Welcome or an error.
    await expect(a.getByRole("heading", { level: 1, name: "Log" })).toBeVisible();
    await expect(a.getByRole("banner").getByRole("link", { name: "Account" })).toBeVisible();
    await addTime(a, 20, 8);
    await expect(a.getByText("Saved on this phone", { exact: true })).toBeVisible();
    await expect(a.getByRole("button", { name: /^Delete .*, 8 minutes$/ })).toBeVisible();

    await a.context().setOffline(false);
    await expect(a.getByText("Saved", { exact: true })).toBeVisible();

    await signIn(b, code, "264813");
    await expect(b.getByRole("button", { name: /^Delete .*, 8 minutes$/ })).toBeVisible();
  } finally {
    await a.context().close();
    await b.context().close();
  }
});

test("offline, sign-in and create account say they need a connection and do not pretend", async ({
  page,
  context,
}) => {
  await page.goto("/sign-in");
  await waitForServiceWorker(page);
  await context.setOffline(true);
  await page.reload();

  const sentence = page.getByText(
    "You need a connection to sign in. Try again when you are back online.",
  );
  await expect(sentence).toBeVisible();
  await page.getByLabel("Family code", { exact: true }).fill("ABCD-EFGH-JKMN");
  await page.getByLabel("PIN", { exact: true }).fill("482916");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator(".needs-connection")).toBeFocused();
  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
  expect(await axeViolations(page)).toEqual([]);

  await page.getByRole("link", { name: "Create account" }).last().click();
  await expect(
    page.getByText(
      "You need a connection to create an account. Try again when you are back online.",
    ),
  ).toBeVisible();

  // The Log, signed out and offline, explains too.
  await tapNav(page, "Log");
  await expect(page.getByRole("heading", { level: 1, name: "Welcome" })).toBeVisible();
  await expect(
    page.getByText("You need a connection to sign in or create an account."),
  ).toBeVisible();
});

test("offline, signing out says it needs a connection and keeps this phone's copy", async ({
  page,
  context,
}) => {
  await signUp(page, "371946");
  await waitForServiceWorker(page);
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.getByRole("banner").getByRole("link", { name: "Account" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Your account" })).toBeVisible();

  await context.setOffline(true);
  await expect(
    page.getByText(
      "You need a connection to sign out or delete your account. You are still signed in on this phone.",
    ),
  ).toBeVisible();
  for (const button of ["Sign out on this phone", "Sign out on all phones"]) {
    await page.getByRole("button", { name: button }).click();
    await expect(page.locator(".needs-connection")).toBeFocused();
    await expect(page.getByRole("heading", { level: 1, name: "Your account" })).toBeVisible();
  }
  expect(await hasLocalDatabase(page)).toBe(true);
  expect(await context.cookies()).toHaveLength(1);

  // Back online, it works as before.
  await context.setOffline(false);
  await page.getByRole("button", { name: "Sign out on this phone" }).click();
  await expect(page.getByText("You are signed out on this phone.")).toBeVisible();
  await expect.poll(() => hasLocalDatabase(page)).toBe(false);
});

test("the worker's caches hold no API answer, family code, session or log entry", async ({
  page,
  context,
}) => {
  const code = await signUp(page, "605829");
  await waitForServiceWorker(page);
  await addTime(page, 40, 6);
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.getByRole("banner").getByRole("link", { name: "Account" }).click();
  await expect(page.getByText("Signed in on 1 phone.")).toBeVisible();
  // Some offline use too: an open, an entry, and back.
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Your account" })).toBeVisible();
  await tapNav(page, "Log");
  await addTime(page, 10, 3);
  await context.setOffline(false);
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  const logs = (await (await page.request.get("/api/logs?since=0")).json()) as {
    entries: { id: string; startedAt: string }[];
  };
  expect(logs.entries).toHaveLength(2);
  const session = (await context.cookies()).find((c) => c.name === "__Host-tummy_session");
  expect(session?.value.length ?? 0).toBeGreaterThan(10);

  const entries = await cachedEntries(page);
  expect(entries.length).toBeGreaterThan(5);
  const secrets = [
    code,
    code.replace(/[^A-Za-z0-9]/g, ""),
    session?.value ?? "",
    ...logs.entries.flatMap((e) => [e.id, e.startedAt]),
  ];
  for (const entry of entries) {
    expect(entry.url, entry.url).not.toContain("/api/");
    for (const secret of secrets) {
      expect(entry.body.includes(secret), `${entry.url} holds account data`).toBe(false);
      expect(entry.url.includes(secret), `${entry.url} holds account data`).toBe(false);
    }
  }
  // And every cached file is one of the app's own.
  for (const entry of entries) {
    expect(new URL(entry.url).origin).toBe("http://127.0.0.1:4173");
  }
});

test("after sign-out, nothing from the account is left, and lessons and When to call still open offline", async ({
  page,
  context,
}) => {
  await signUp(page, "839027");
  await waitForServiceWorker(page);
  await addTime(page, 30, 4);
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.goto("/account");
  await page.getByRole("button", { name: "Sign out on this phone" }).click();
  await expect(page.getByText("You are signed out on this phone.")).toBeVisible();
  await expect.poll(() => hasLocalDatabase(page)).toBe(false);
  expect(await context.cookies()).toHaveLength(0);
  // No other database either (the worker keeps none), and nothing in the two storages.
  const stored = await page.evaluate(async () => ({
    databases: (await indexedDB.databases()).map((d) => d.name),
    local: localStorage.length,
    session: sessionStorage.length,
  }));
  expect(stored).toEqual({ databases: [], local: 0, session: 0 });
  for (const entry of await cachedEntries(page)) {
    expect(entry.url).not.toContain("/api/");
  }

  await context.setOffline(true);
  await page.goto("/lessons/first-lesson");
  await expect(page.getByText("Draft. Not yet reviewed by a clinician.").first()).toBeVisible();
  await page.goto("/when-to-call");
  await expect(page.getByTestId("emergency-line")).toHaveText(EMERGENCY_LINE);
  // Opening the app offline after sign-out made no new copy of the log.
  expect(await hasLocalDatabase(page)).toBe(false);
});

test("Add to your home screen: from Home, axe, 320 px with no sideways scroll, 44 px targets", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/");
  await page.getByRole("link", { name: "Add Tummy Time to your home screen" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Add to your home screen" }),
  ).toBeVisible();
  await expect(page).toHaveTitle("Add to your home screen | Tummy Time");
  await expect(page.getByRole("heading", { level: 2, name: "On an iPhone" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "On an Android phone" })).toBeVisible();
  await expect(page.locator("ol.steps li")).toHaveCount(8);
  expect(await axeViolations(page)).toEqual([]);
  expect(await sidewaysOverflow(page)).toBeLessThanOrEqual(0);
  await targetsAtLeast44(page, ".app-shell", "/add-to-home-screen");
  await doubleTextSize(page);
  expect(await sidewaysOverflow(page)).toBeLessThanOrEqual(0);
});

test("the manifest and icons are served, and the page links them", async ({ page }) => {
  await page.goto("/");
  const manifest = await page.request.get("/manifest.webmanifest");
  expect(manifest.status()).toBe(200);
  const body = (await manifest.json()) as { icons: { src: string }[]; display: string };
  expect(body.display).toBe("standalone");
  for (const icon of body.icons) {
    const answer = await page.request.get(icon.src);
    expect(answer.status(), icon.src).toBe(200);
    expect(answer.headers()["content-type"]).toBe("image/png");
  }
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/manifest.webmanifest",
  );
});
