import { expect, type Page } from "@playwright/test";

/**
 * Helpers for the offline and update tests (Block 7). The sign-up, sign-in and add-a-time steps
 * are the same as in log.spec.ts; they are repeated here rather than moved, so the Block 6 tests
 * stay exactly as they were reviewed.
 */

/** Waits until the service worker has every file and is in charge of this page. */
export async function waitForServiceWorker(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
}

/** The build label in <meta name="tummy-build">, or null while the page is reloading. */
export async function buildLabel(page: Page): Promise<string | null> {
  try {
    return await page.evaluate(
      () => document.querySelector('meta[name="tummy-build"]')?.getAttribute("content") ?? null,
    );
  } catch {
    return null;
  }
}

export interface CachedEntry {
  cache: string;
  url: string;
  type: string;
  body: string;
}

/** Every entry in every Cache Storage cache, with the text of every text-like answer. */
export function cachedEntries(page: Page): Promise<CachedEntry[]> {
  return page.evaluate(async () => {
    const out: CachedEntry[] = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) {
        const response = await cache.match(request);
        const type = response?.headers.get("content-type") ?? "";
        const textLike = /text|javascript|json|manifest|svg|xml/.test(type);
        const body = response && textLike ? await response.text() : "";
        out.push({ cache: name, url: request.url, type, body });
      }
    }
    return out;
  });
}

export async function hasLocalDatabase(page: Page): Promise<boolean> {
  return page.evaluate(async () =>
    (await indexedDB.databases()).some((d) => d.name === "tummy-time"),
  );
}

/** Creates an account. Answers its family code. */
export async function signUp(page: Page, pin: string): Promise<string> {
  await page.goto("/create-account");
  await page.getByLabel("PIN", { exact: true }).fill(pin);
  await page.getByLabel("Type the PIN again", { exact: true }).fill(pin);
  await page.getByRole("button", { name: "Create account" }).click();
  const code = (await page.getByTestId("family-code").innerText()).trim();
  await page.getByRole("button", { name: "I saved my code" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Log" })).toBeVisible();
  return code;
}

export async function signIn(page: Page, code: string, pin: string): Promise<void> {
  await page.goto("/sign-in");
  await page.getByLabel("Family code", { exact: true }).fill(code);
  await page.getByLabel("PIN", { exact: true }).fill(pin);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Log" })).toBeVisible();
}

/** "Add a time" through the form, from the Log screen. */
export async function addTime(page: Page, minutesAgo: number, minutes: number): Promise<void> {
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

export async function targetsAtLeast44(page: Page, scope: string, where: string): Promise<void> {
  const targets = page.locator(`${scope} :is(a, button, input):visible`);
  const count = await targets.count();
  expect(count, where).toBeGreaterThan(0);
  for (let i = 0; i < count; i += 1) {
    const box = await targets.nth(i).boundingBox();
    const name = await targets.nth(i).innerText();
    expect(box?.width ?? 0, `${where}: ${name} width`).toBeGreaterThanOrEqual(44);
    expect(box?.height ?? 0, `${where}: ${name} height`).toBeGreaterThanOrEqual(44);
  }
}

/** Goes to a screen with the bottom bar, as a person would (a screen change, not a reload). */
export async function tapNav(page: Page, name: string): Promise<void> {
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name }).click();
}
