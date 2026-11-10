import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../App";
import { en } from "../../strings/en";
import { apiError, stubApi } from "../../test/api-stub";
import { axeViolations } from "../../test/axe";

const a = en.account;

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function field(name: RegExp | string): HTMLInputElement {
  return screen.getByLabelText(name, { selector: "input" });
}

function describedText(input: HTMLElement): string {
  return (input.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" | ");
}

describe("what needs sign-in", () => {
  it("the Log sends a signed-out person to Welcome", async () => {
    stubApi({ signedIn: false });
    const { container } = renderAt("/log");
    expect(await screen.findByRole("heading", { level: 1, name: a.welcome.title })).toBeDefined();
    expect(screen.getByRole("link", { name: a.welcome.createAccount }).getAttribute("href")).toBe(
      "/create-account",
    );
    expect(await axeViolations(container)).toEqual([]);
  });

  it("the account screen needs sign-in too", async () => {
    stubApi({ signedIn: false });
    renderAt("/account");
    expect(await screen.findByRole("heading", { level: 1, name: a.welcome.title })).toBeDefined();
  });

  it.each(["/", "/lessons", "/when-to-call"])("%s stays open when signed out", async (path) => {
    stubApi({ signedIn: false });
    renderAt(path);
    const heading = await screen.findByRole("heading", { level: 1 });
    expect(heading.textContent).not.toBe(a.welcome.title);
  });

  it("the header offers Sign in when signed out and Account when signed in", async () => {
    stubApi({ signedIn: false });
    renderAt("/");
    expect((await screen.findByRole("link", { name: a.headerSignIn })).getAttribute("href")).toBe(
      "/sign-in",
    );
    cleanup();
    stubApi({ signedIn: true });
    renderAt("/");
    expect((await screen.findByRole("link", { name: a.headerAccount })).getAttribute("href")).toBe(
      "/account",
    );
  });

  it.each(["/welcome", "/sign-in", "/create-account", "/signed-out"])(
    "%s keeps When to call one tap away",
    async (path) => {
      stubApi();
      renderAt(path);
      await screen.findByRole("heading", { level: 1 });
      const nav = screen.getByRole("navigation", { name: en.nav.label });
      const link = Array.from(nav.querySelectorAll("a")).find(
        (el) => el.textContent === en.nav.whenToCall,
      );
      expect(link?.getAttribute("href")).toBe("/when-to-call");
    },
  );
});

describe("Sign in", () => {
  it("has labelled fields with the right types and autocomplete values", async () => {
    stubApi();
    const { container } = renderAt("/sign-in");
    await screen.findByRole("heading", { level: 1, name: a.signIn.title });
    const code = field(a.signIn.codeLabel);
    const pin = field(a.signIn.pinLabel);
    expect(code.getAttribute("autocomplete")).toBe("username");
    expect(code.getAttribute("type")).toBe("text");
    expect(pin.getAttribute("type")).toBe("password");
    expect(pin.getAttribute("inputmode")).toBe("numeric");
    expect(pin.getAttribute("autocomplete")).toBe("current-password");
    expect(describedText(code)).toContain(a.signIn.codeHint);
    expect(await axeViolations(container)).toEqual([]);
  });

  it("Show PIN switches the field between hidden and shown", async () => {
    stubApi();
    renderAt("/sign-in");
    const pin = await screen.findByLabelText(a.signIn.pinLabel, { selector: "input" });
    const toggle = screen.getByRole("button", { name: a.pin.show });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(toggle);
    expect(pin.getAttribute("type")).toBe("text");
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(toggle);
    expect(pin.getAttribute("type")).toBe("password");
  });

  it("an empty form shows each problem, ties it to its field, announces it, and moves focus to the first", async () => {
    stubApi();
    const { container } = renderAt("/sign-in");
    await screen.findByRole("heading", { level: 1, name: a.signIn.title });
    fireEvent.click(screen.getByRole("button", { name: a.signIn.submit }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(a.errors.codeMissing);
    expect(alert.textContent).toContain(a.errors.pinMissing);
    const code = field(a.signIn.codeLabel);
    expect(code.getAttribute("aria-invalid")).toBe("true");
    expect(describedText(code)).toContain(a.errors.codeMissing);
    expect(describedText(field(a.signIn.pinLabel))).toContain(a.errors.pinMissing);
    await waitFor(() => {
      expect(document.activeElement).toBe(code);
    });
    expect(await axeViolations(container)).toEqual([]);
  });

  it("a wrong code or PIN is announced, focus moves to the message, and the fields point to it", async () => {
    const api = stubApi({
      replies: { "POST /api/auth/sign-in/finish": [apiError("sign_in_failed", 401)] },
    });
    renderAt("/sign-in");
    await screen.findByRole("heading", { level: 1, name: a.signIn.title });
    fireEvent.change(field(a.signIn.codeLabel), { target: { value: "abcd-efgh-jkmn" } });
    fireEvent.change(field(a.signIn.pinLabel), { target: { value: "482916" } });
    fireEvent.click(screen.getByRole("button", { name: a.signIn.submit }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(a.errors.signInFailed);
    await waitFor(() => {
      expect(document.activeElement?.contains(alert)).toBe(true);
    });
    expect(describedText(field(a.signIn.codeLabel))).toContain(a.errors.signInFailed);
    expect(describedText(field(a.signIn.pinLabel))).toContain(a.errors.signInFailed);

    // What was sent: our custom header, our own cookies only, our Origin kept.
    const sent = api.calls.find((c) => c.url === "/api/auth/sign-in/finish");
    expect(sent?.method).toBe("POST");
    expect(sent?.headers["x-tummy-request"]).toBe("1");
    expect(sent?.credentials).toBe("same-origin");
    expect(sent?.referrerPolicy).toBe("same-origin");
    expect(sent?.body).toEqual({ familyCode: "abcd-efgh-jkmn", pin: "482916" });
  });

  it.each([
    ["account_locked", 429, a.errors.locked],
    ["rate_limited", 429, a.errors.rateLimited],
  ] as const)("%s has its own plain message", async (code, status, text) => {
    stubApi({ replies: { "POST /api/auth/sign-in/finish": [apiError(code, status)] } });
    renderAt("/sign-in");
    await screen.findByRole("heading", { level: 1, name: a.signIn.title });
    fireEvent.change(field(a.signIn.codeLabel), { target: { value: "ABCD EFGH JKMN" } });
    fireEvent.change(field(a.signIn.pinLabel), { target: { value: "482916" } });
    fireEvent.click(screen.getByRole("button", { name: a.signIn.submit }));
    expect((await screen.findByRole("alert")).textContent).toContain(text);
  });

  it("a network failure says so", async () => {
    stubApi({ replies: { "POST /api/auth/sign-in/finish": ["network-error"] } });
    renderAt("/sign-in");
    await screen.findByRole("heading", { level: 1, name: a.signIn.title });
    fireEvent.change(field(a.signIn.codeLabel), { target: { value: "ABCD EFGH JKMN" } });
    fireEvent.change(field(a.signIn.pinLabel), { target: { value: "482916" } });
    fireEvent.click(screen.getByRole("button", { name: a.signIn.submit }));
    expect((await screen.findByRole("alert")).textContent).toContain(a.errors.network);
  });

  it("the button is disabled only while signing in, then the Log opens", async () => {
    let release: (r: Response) => void = () => undefined;
    stubApi();
    const fetchStub = globalThis.fetch;
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string, init?: RequestInit) =>
        input === "/api/auth/sign-in/finish"
          ? new Promise<Response>((resolve) => {
              release = resolve;
            })
          : fetchStub(input, init),
      ),
    );
    renderAt("/sign-in");
    await screen.findByRole("heading", { level: 1, name: a.signIn.title });
    const button = screen.getByRole("button", { name: a.signIn.submit });
    expect(button.hasAttribute("disabled")).toBe(false);
    fireEvent.change(field(a.signIn.codeLabel), { target: { value: "ABCD EFGH JKMN" } });
    fireEvent.change(field(a.signIn.pinLabel), { target: { value: "482916" } });
    fireEvent.click(button);
    const busy = await screen.findByRole("button", { name: a.signIn.submitting });
    expect(busy.hasAttribute("disabled")).toBe(true);
    stubApi({ signedIn: true });
    release(Response.json({ signedIn: true }));
    expect(await screen.findByRole("heading", { level: 1, name: en.log.title })).toBeDefined();
  });
});

describe("Create account and Your family code", () => {
  it("shows the care team line, and labelled new-password PIN fields", async () => {
    stubApi();
    const { container } = renderAt("/create-account");
    await screen.findByRole("heading", { level: 1, name: a.create.title });
    expect(screen.getByText(a.create.notAdvice)).toBeDefined();
    expect(a.create.notAdvice).toBe("This app does not replace advice from your baby's care team.");
    for (const label of [a.create.pinLabel, a.create.confirmLabel]) {
      const input = field(label);
      expect(input.getAttribute("type")).toBe("password");
      expect(input.getAttribute("inputmode")).toBe("numeric");
      expect(input.getAttribute("autocomplete")).toBe("new-password");
    }
    expect(await axeViolations(container)).toEqual([]);
  });

  it("two different PINs: the second field gets the error and focus", async () => {
    stubApi();
    renderAt("/create-account");
    await screen.findByRole("heading", { level: 1, name: a.create.title });
    fireEvent.change(field(a.create.pinLabel), { target: { value: "482916" } });
    fireEvent.change(field(a.create.confirmLabel), { target: { value: "482917" } });
    fireEvent.click(screen.getByRole("button", { name: a.create.submit }));
    expect((await screen.findByRole("alert")).textContent).toContain(a.errors.pinMismatch);
    const confirm = field(a.create.confirmLabel);
    expect(describedText(confirm)).toContain(a.errors.pinMismatch);
    await waitFor(() => {
      expect(document.activeElement).toBe(confirm);
    });
  });

  it("a PIN the server says is too easy: the PIN field gets the error and focus", async () => {
    stubApi({ replies: { "POST /api/auth/sign-up/finish": [apiError("weak_pin", 400)] } });
    renderAt("/create-account");
    await screen.findByRole("heading", { level: 1, name: a.create.title });
    fireEvent.change(field(a.create.pinLabel), { target: { value: "135135" } });
    fireEvent.change(field(a.create.confirmLabel), { target: { value: "135135" } });
    fireEvent.click(screen.getByRole("button", { name: a.create.submit }));
    expect((await screen.findByRole("alert")).textContent).toContain(a.errors.weakPin);
    const pin = field(a.create.pinLabel);
    await waitFor(() => {
      expect(document.activeElement).toBe(pin);
    });
  });

  it("on success shows the code once, in three groups, with the advice; nothing is stored", async () => {
    localStorage.clear();
    sessionStorage.clear();
    stubApi({
      replies: {
        "POST /api/auth/sign-up/finish": [{ status: 201, body: { familyCode: "ABCD EFGH JKMN" } }],
      },
    });
    const { container } = renderAt("/create-account");
    await screen.findByRole("heading", { level: 1, name: a.create.title });
    fireEvent.change(field(a.create.pinLabel), { target: { value: "482916" } });
    fireEvent.change(field(a.create.confirmLabel), { target: { value: "482916" } });
    fireEvent.click(screen.getByRole("button", { name: a.create.submit }));

    const heading = await screen.findByRole("heading", { level: 1, name: a.familyCode.title });
    await waitFor(() => {
      expect(document.activeElement).toBe(heading);
    });
    expect(document.title).toBe(`${a.familyCode.title} | ${en.appName}`);
    expect(screen.getByTestId("family-code").textContent).toBe("ABCD EFGH JKMN");
    expect(screen.getByText(/A B C D, E F G H, J K M N/)).toBeDefined();
    expect(screen.getByText(a.familyCode.saveIt)).toBeDefined();
    expect(screen.getByText(a.familyCode.noRecovery)).toBeDefined();
    expect(await axeViolations(container)).toEqual([]);

    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(JSON.stringify(window.history.state ?? null)).not.toContain("ABCD");

    fireEvent.click(screen.getByRole("button", { name: a.familyCode.done }));
    expect(await screen.findByRole("heading", { level: 1, name: en.log.title })).toBeDefined();
    expect(screen.queryByText("ABCD EFGH JKMN")).toBeNull();
  });
});

describe("Your account", () => {
  it("shows how many phones are signed in and has no axe violations", async () => {
    stubApi({ signedIn: true, phones: 2 });
    const { container } = renderAt("/account");
    await screen.findByRole("heading", { level: 1, name: a.manage.title });
    expect(await screen.findByText(/Signed in on 2 phones\./)).toBeDefined();
    expect(await axeViolations(container)).toEqual([]);
  });

  it.each([
    [a.manage.signOut, "/api/auth/sign-out", a.signedOut.thisPhone],
    [a.manage.signOutEverywhere, "/api/auth/sign-out-everywhere", a.signedOut.everywhere],
  ])("%s signs out and says so", async (button, url, message) => {
    const api = stubApi({
      signedIn: true,
      replies: { [`POST ${url}`]: [{ status: 200, body: { signedOut: true } }] },
    });
    const { container } = renderAt("/account");
    await screen.findByRole("heading", { level: 1, name: a.manage.title });
    fireEvent.click(screen.getByRole("button", { name: button }));
    expect(await screen.findByRole("heading", { level: 1, name: a.signedOut.title })).toBeDefined();
    expect(screen.getByText(message)).toBeDefined();
    expect(api.calls.some((c) => c.url === url && c.method === "POST")).toBe(true);
    expect(await axeViolations(container)).toEqual([]);
    // Signed out now: the header offers Sign in again.
    expect(
      within(screen.getByRole("banner")).getByRole("link", { name: a.headerSignIn }),
    ).toBeDefined();
  });

  it("delete needs the PIN; a wrong one is announced and nothing happens", async () => {
    stubApi({
      signedIn: true,
      replies: { "DELETE /api/me": [apiError("sign_in_failed", 401)] },
    });
    renderAt("/account");
    await screen.findByRole("heading", { level: 1, name: a.manage.title });
    fireEvent.click(screen.getByRole("button", { name: a.manage.deleteSubmit }));
    expect((await screen.findByRole("alert")).textContent).toContain(a.errors.pinMissing);
    fireEvent.change(field(a.manage.deletePinLabel), { target: { value: "482916" } });
    fireEvent.click(screen.getByRole("button", { name: a.manage.deleteSubmit }));
    expect((await screen.findByRole("alert")).textContent).toContain(a.errors.wrongPin);
    expect(screen.getByRole("heading", { level: 1, name: a.manage.title })).toBeDefined();
  });

  it("delete with the PIN ends on 'Your account is deleted'", async () => {
    const api = stubApi({
      signedIn: true,
      replies: { "DELETE /api/me": [{ status: 200, body: { deleted: true } }] },
    });
    renderAt("/account");
    await screen.findByRole("heading", { level: 1, name: a.manage.title });
    fireEvent.change(field(a.manage.deletePinLabel), { target: { value: "482916" } });
    fireEvent.click(screen.getByRole("button", { name: a.manage.deleteSubmit }));
    expect(await screen.findByText(a.signedOut.deleted)).toBeDefined();
    expect(api.calls.find((c) => c.method === "DELETE")?.body).toEqual({ pin: "482916" });
  });
});
