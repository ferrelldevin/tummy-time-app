import { expect, test, type Page } from "@playwright/test";

/**
 * The page's Content Security Policy, in a real browser (threat model #6).
 *
 * The preview server these tests use sends the same security headers as nginx, read from
 * nginx's own file (tooling/page-headers.ts). So this checks two things nothing else does:
 * that the policy is strict, and that the app works under it without breaking it once.
 */

interface Violation {
  directive: string;
  blocked: string;
}

/** Collects every policy violation the browser reports on this page, across navigations. */
async function watchPolicy(page: Page): Promise<Violation[]> {
  const seen: Violation[] = [];
  await page.exposeFunction("tummyReportViolation", (violation: Violation) => {
    seen.push(violation);
  });
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      const report = Reflect.get(window, "tummyReportViolation") as
        ((violation: { directive: string; blocked: string }) => void) | undefined;
      report?.({ directive: event.effectiveDirective, blocked: event.blockedURI });
    });
  });
  return seen;
}

test("the page is sent with a strict policy: own files only, no inline script, no eval", async ({
  request,
}) => {
  const response = await request.get("/");
  const policy = response.headers()["content-security-policy"] ?? "";
  const directives = new Map(
    policy.split(";").map((part) => {
      const [name = "", ...values] = part.trim().split(/\s+/);
      return [name, values.join(" ")] as const;
    }),
  );
  expect(directives.get("default-src")).toBe("'self'");
  expect(directives.get("script-src")).toBe("'self'");
  expect(directives.get("style-src")).toBe("'self'");
  expect(directives.get("connect-src")).toBe("'self'");
  expect(directives.get("object-src")).toBe("'none'");
  expect(directives.get("base-uri")).toBe("'none'");
  expect(directives.get("frame-ancestors")).toBe("'none'");
  expect(policy).not.toContain("unsafe-inline");
  expect(policy).not.toContain("unsafe-eval");
  expect(policy).not.toMatch(/https?:|\*/);
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["referrer-policy"]).toBe("no-referrer");
});

test("the policy is live: an inline script and code made from text are both refused", async ({
  page,
}) => {
  const seen = await watchPolicy(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // Both are started from here but run by the page itself a moment later, so the browser treats
  // them as the page's own doing. (Code a test runs directly is let through by the browser's
  // debugging channel, which would prove nothing.)
  await page.evaluate(() => {
    const script = document.createElement("script");
    script.textContent = "window.tummyInlineRan = true;";
    document.body.append(script);
    // A string handed to setTimeout is code made from text, like eval.
    // eslint-disable-next-line @typescript-eslint/no-implied-eval -- the point of this test: the page must not be able to do this
    setTimeout("window.tummyTextRan = true;", 0);
  });
  await expect
    .poll(() => seen.map((violation) => violation.directive).sort())
    .toEqual(["script-src", "script-src-elem"]);
  const ran = await page.evaluate(() => ({
    inline: Reflect.get(window, "tummyInlineRan") === true,
    madeFromText: Reflect.get(window, "tummyTextRan") === true,
  }));
  expect(ran).toEqual({ inline: false, madeFromText: false });
});

test("no screen breaks the policy, signed out or signed in", async ({ page }) => {
  const seen = await watchPolicy(page);

  const signedOut: [string, string][] = [
    ["/", "Tummy Time"],
    ["/when-to-call", "When to call"],
    ["/baby-crying", "Baby crying? Try this"],
    ["/lessons", "Lessons"],
    ["/lessons/first-lesson", "First lesson (placeholder)"],
    ["/add-to-home-screen", "Add to your home screen"],
    ["/welcome", "Welcome"],
    ["/sign-in", "Sign in"],
    ["/no-such-page", "Page not found"],
  ];
  for (const [path, title] of signedOut) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: title }), path).toBeVisible();
  }

  // Create an account, run the timer, save, and open the log: every screen that talks to the
  // API and to this phone's own copy of the log.
  await page.goto("/create-account");
  await page.getByLabel("PIN", { exact: true }).fill("385016");
  await page.getByLabel("Type the PIN again", { exact: true }).fill("385016");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByRole("button", { name: "I saved my code" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Log" })).toBeVisible();
  await page.goto("/start-tummy-time");
  await page.getByRole("button", { name: "Start" }).click();
  await page.getByRole("button", { name: "Stop and save" }).click();
  await page.goto("/log/add");
  await expect(page.getByRole("heading", { level: 1, name: "Add a time" })).toBeVisible();
  await page.goto("/account");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // The service worker installs from our own file. (Only the page's own violations are seen
  // here; the worker's script runs in its own scope and reports nothing to the page.)
  await expect
    .poll(() =>
      page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.active?.state),
    )
    .toBe("activated");

  // Last, break the policy once on purpose, on this very page. Seeing exactly that one report
  // proves the listener was still attached after every navigation above (so an empty list would
  // not have been empty by accident) and that no earlier report was still on its way.
  await page.evaluate(() => {
    const script = document.createElement("script");
    script.textContent = "window.tummyInlineRan = true;";
    document.body.append(script);
  });
  await expect.poll(() => seen.length).toBeGreaterThan(0);
  expect(seen).toEqual([{ directive: "script-src-elem", blocked: "inline" }]);
});
