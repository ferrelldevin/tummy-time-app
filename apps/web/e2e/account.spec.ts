import { expect, test, type Page } from "@playwright/test";
import { axeViolations } from "./axe";

/**
 * Sign-up, sign-in and sessions in a real browser, through the real family-code-pin provider,
 * the real API and the real database (no fakes). The API runs with APP_ORIGIN set to this
 * app's address, so every state-changing request here also passes the real cross-site check.
 *
 * PINs here are made up and only used against the throwaway test database.
 */

const PIN = "482916";

async function noSidewaysScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

async function checkScreen(page: Page, title: string): Promise<void> {
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(page).toHaveTitle(`${title} | Tummy Time`);
  expect(await axeViolations(page)).toEqual([]);
  await noSidewaysScroll(page);
}

/** Presses Tab until `name` has focus. Fails if it never does. */
async function tabTo(page: Page, role: "button" | "link" | "textbox", name: string): Promise<void> {
  const target =
    role === "textbox"
      ? page.getByLabel(name, { exact: true })
      : page.getByRole(role, { name, exact: true });
  for (let i = 0; i < 30; i += 1) {
    if (await target.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  await expect(target).toBeFocused();
}

/** Creates an account with the keyboard only. Returns the family code read from the screen. */
async function signUpWithKeyboard(page: Page, pin = PIN): Promise<string> {
  await page.goto("/create-account");
  await checkScreen(page, "Create account");
  await expect(
    page.getByText("This app does not replace advice from your baby's care team."),
  ).toBeVisible();
  await tabTo(page, "textbox", "PIN");
  await page.keyboard.type(pin);
  await tabTo(page, "textbox", "Type the PIN again");
  await page.keyboard.type(pin);
  await page.keyboard.press("Enter");
  const heading = page.getByRole("heading", { level: 1, name: "Your family code" });
  await expect(heading).toBeFocused();
  const code = (await page.getByTestId("family-code").innerText()).trim();
  expect(code).toMatch(/^[2-9A-HJKMNP-Z]{4} [2-9A-HJKMNP-Z]{4} [2-9A-HJKMNP-Z]{4}$/);
  return code;
}

async function signInWithKeyboard(page: Page, code: string, pin = PIN): Promise<void> {
  await page.goto("/sign-in");
  await checkScreen(page, "Sign in");
  await tabTo(page, "textbox", "Family code");
  await page.keyboard.type(code);
  await tabTo(page, "textbox", "PIN");
  await page.keyboard.type(pin);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "Log" })).toBeVisible();
}

test("keyboard only: create an account, see the code once, sign out, sign in again", async ({
  page,
  context,
}) => {
  const code = await signUpWithKeyboard(page);
  // Your family code screen: advice and the plain note that it cannot be recovered yet.
  await expect(
    page.getByText("You will only see it this one time.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("We cannot get this code back for you yet.", { exact: false }),
  ).toBeVisible();
  await checkScreen(page, "Your family code");

  // The session is an HttpOnly, Secure, SameSite=Lax __Host- cookie; scripts cannot see it,
  // and the app stores nothing itself.
  const cookies = await context.cookies();
  expect(cookies).toHaveLength(1);
  expect(cookies[0]).toMatchObject({
    name: "__Host-tummy_session",
    path: "/",
    domain: "127.0.0.1",
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
  });
  const stored = await page.evaluate(() => ({
    cookie: document.cookie,
    local: localStorage.length,
    session: sessionStorage.length,
    history: JSON.stringify(history.state),
  }));
  expect(stored.cookie).toBe("");
  expect(stored.local).toBe(0);
  expect(stored.session).toBe(0);
  expect(stored.history).not.toContain(code.slice(0, 4));

  await tabTo(page, "button", "I saved my code");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "Log" })).toBeFocused();

  // Reload: the code is gone for good from this phone, the session stays.
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Log" })).toBeVisible();
  expect(await page.content()).not.toContain(code);

  // Account screen, then sign out on this phone with the keyboard.
  await tabTo(page, "link", "Account");
  await page.keyboard.press("Enter");
  await checkScreen(page, "Your account");
  await expect(page.getByText("Signed in on 1 phone.")).toBeVisible();
  await tabTo(page, "button", "Sign out on this phone");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "Signed out" })).toBeVisible();
  await expect(page.getByText("You are signed out on this phone.")).toBeVisible();
  await checkScreen(page, "Signed out");
  expect(await context.cookies()).toHaveLength(0);

  // The Log now needs sign-in again; Home, Lessons and When to call do not.
  await page.goto("/log");
  await checkScreen(page, "Welcome");
  for (const [path, title] of [
    ["/", "Tummy Time"],
    ["/lessons", "Lessons"],
    ["/when-to-call", "When to call"],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  }

  // Sign in again, typing the code in lower case with dashes.
  await signInWithKeyboard(page, code.toLowerCase().replaceAll(" ", "-"));
});

test("two phones on one account: sign out on one leaves the other; sign out everywhere ends both", async ({
  browser,
}) => {
  const phoneA = await browser.newContext();
  const phoneB = await browser.newContext();
  const a = await phoneA.newPage();
  const b = await phoneB.newPage();
  try {
    const code = await signUpWithKeyboard(a, "730518");
    await a.getByRole("button", { name: "I saved my code" }).click();
    await expect(a.getByRole("heading", { level: 1, name: "Log" })).toBeVisible();

    await signInWithKeyboard(b, code, "730518");
    // Different phones, different sessions.
    const tokenA = (await phoneA.cookies())[0]?.value;
    const tokenB = (await phoneB.cookies())[0]?.value;
    expect(tokenA).toBeDefined();
    expect(tokenA).not.toBe(tokenB);

    await a.goto("/account");
    await expect(a.getByText("Signed in on 2 phones.")).toBeVisible();

    // Phone A signs out. Phone B is still signed in.
    await a.getByRole("button", { name: "Sign out on this phone" }).click();
    await expect(a.getByText("You are signed out on this phone.")).toBeVisible();
    await b.goto("/log");
    await expect(b.getByRole("heading", { level: 1, name: "Log" })).toBeVisible();
    await a.goto("/log");
    await expect(a.getByRole("heading", { level: 1, name: "Welcome" })).toBeVisible();

    // Phone A signs in again; then phone B signs out everywhere. Both end.
    await signInWithKeyboard(a, code, "730518");
    await b.goto("/account");
    await expect(b.getByText("Signed in on 2 phones.")).toBeVisible();
    await b.getByRole("button", { name: "Sign out on all phones" }).click();
    await expect(b.getByText("You are signed out on all phones.")).toBeVisible();
    await a.goto("/log");
    await expect(a.getByRole("heading", { level: 1, name: "Welcome" })).toBeVisible();
    await b.goto("/log");
    await expect(b.getByRole("heading", { level: 1, name: "Welcome" })).toBeVisible();
  } finally {
    await phoneA.close();
    await phoneB.close();
  }
});

test("errors are shown in words, announced, tied to the fields, and take focus", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();

  // Nothing typed: focus goes to the first field with a problem.
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const alert = page.getByRole("alert");
  await expect(alert).toContainText("Type your family code.");
  await expect(alert).toContainText("Type a 6-digit PIN.");
  const codeField = page.getByLabel("Family code", { exact: true });
  await expect(codeField).toBeFocused();
  await expect(codeField).toHaveAttribute("aria-invalid", "true");
  await expect(codeField).toHaveAccessibleDescription(/Type your family code\./);
  expect(await axeViolations(page)).toEqual([]);

  // A code that matches no account: the same words as a wrong PIN, focus on the message.
  await codeField.fill("2345 6789 ABCD");
  await page.getByLabel("PIN", { exact: true }).fill(PIN);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(alert).toContainText("That family code and PIN do not match.");
  await expect(page.locator(".error-summary")).toBeFocused();
  await expect(codeField).toHaveAccessibleDescription(/do not match/);
  await expect(page.getByLabel("PIN", { exact: true })).toHaveAccessibleDescription(/do not match/);
  expect(await axeViolations(page)).toEqual([]);

  // Show PIN works and paste is not blocked.
  const pin = page.getByLabel("PIN", { exact: true });
  await expect(pin).toHaveAttribute("type", "password");
  await expect(pin).toHaveAttribute("inputmode", "numeric");
  await page.getByRole("button", { name: "Show PIN" }).click();
  await expect(pin).toHaveAttribute("type", "text");
  await pin.fill("");
  await pin.focus();
  await page.evaluate(() => {
    const data = new DataTransfer();
    data.setData("text/plain", "730518");
    document.activeElement?.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }),
    );
  });
  const pasteBlocked = await page.evaluate(() => {
    const event = new ClipboardEvent("paste", { bubbles: true, cancelable: true });
    document.activeElement?.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(pasteBlocked).toBe(false);
});

test("new screens hold at 320 px, have 44 px targets and keep When to call one tap away", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  for (const [path, title] of [
    ["/welcome", "Welcome"],
    ["/sign-in", "Sign in"],
    ["/create-account", "Create account"],
    ["/signed-out", "Signed out"],
  ] as const) {
    await page.goto(path);
    await checkScreen(page, title);
    const targets = page.locator("a:visible, button:visible");
    const count = await targets.count();
    for (let i = 0; i < count; i += 1) {
      const box = await targets.nth(i).boundingBox();
      const name = await targets.nth(i).innerText();
      expect(box?.width ?? 0, `${path}: ${name} width`).toBeGreaterThanOrEqual(44);
      expect(box?.height ?? 0, `${path}: ${name} height`).toBeGreaterThanOrEqual(44);
    }
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "When to call" })
      .click();
    await expect(page.getByRole("heading", { level: 1, name: "When to call" })).toBeVisible();
  }
});

test("the family code and account screens hold at 320 px with no violations", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await signUpWithKeyboard(page, "261947");
  await checkScreen(page, "Your family code");
  await page.getByRole("button", { name: "I saved my code" }).click();
  await page.goto("/account");
  await checkScreen(page, "Your account");
  // Delete with a wrong PIN is announced; with the right one the account is gone.
  await page.getByLabel("Your PIN", { exact: true }).fill("482916");
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page.getByRole("alert")).toContainText("That PIN is not right.");
  expect(await axeViolations(page)).toEqual([]);
  await page.getByLabel("Your PIN", { exact: true }).fill("261947");
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page.getByText("Your account is deleted.")).toBeVisible();
  await page.goto("/log");
  await expect(page.getByRole("heading", { level: 1, name: "Welcome" })).toBeVisible();
});

test("the API refuses a state-changing request from another origin, through the real proxy", async ({
  page,
}) => {
  await page.goto("/");
  const foreign = await page.request.post("/api/auth/sign-up/finish", {
    headers: { origin: "https://evil.example", "x-tummy-request": "1" },
    data: { pin: "593082" },
  });
  expect(foreign.status()).toBe(403);
  const noHeader = await page.request.post("/api/auth/sign-up/finish", {
    headers: { origin: "http://127.0.0.1:4173" },
    data: { pin: "593082" },
  });
  expect(noHeader.status()).toBe(403);
});
