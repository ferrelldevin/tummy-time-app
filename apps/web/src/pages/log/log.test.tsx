import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../App";
import { LOCAL_DB_NAME, startLogSync, wipeLocalData } from "../../log/local-data";
import { timer } from "../../log/timer";
import { en } from "../../strings/en";
import { stubApi } from "../../test/api-stub";
import { axeViolations } from "../../test/axe";

/**
 * The log screens in jsdom, with the API stubbed and a fresh in-memory IndexedDB per test.
 * The real API, a real browser and two phones are in e2e/log.spec.ts.
 */

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

afterEach(async () => {
  cleanup();
  timer.stop(Date.now());
  await wipeLocalData();
  vi.unstubAllGlobals();
});

async function databaseNames(): Promise<string[]> {
  return (await indexedDB.databases()).map((d) => d.name ?? "");
}

/** Wraps the stubbed fetch so log writes fail as if there were no network. */
function logWritesFail(): void {
  const inner = globalThis.fetch;
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith("/api/logs/")) return Promise.reject(new TypeError("Failed to fetch"));
    return inner(input, init);
  });
}

async function addEntry(minutesAgo: number, durationSeconds: number) {
  const sync = await startLogSync();
  return sync.add({
    startedAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
    durationSeconds,
  });
}

describe("Start tummy time", () => {
  it("needs sign-in", async () => {
    stubApi({ signedIn: false });
    renderAt("/start-tummy-time");
    expect(await screen.findByRole("heading", { level: 1, name: en.account.welcome.title }));
  });

  it("has one large Start control, a timer screen readers can query, and no axe violations", async () => {
    stubApi({ signedIn: true });
    const { container } = renderAt("/start-tummy-time");
    await screen.findByRole("heading", { level: 1, name: en.startTummyTime.title });
    const timerRegion = screen.getByRole("timer");
    expect(timerRegion.getAttribute("aria-live")).toBe("off");
    expect(timerRegion.textContent).toContain("0 seconds");
    expect(screen.getByRole("button", { name: en.startTummyTime.start })).toBeDefined();
    await screen.findByText(en.log.sync.saved);
    expect(await axeViolations(container)).toEqual([]);
  });

  it("announces the start once, and the save once, with praise for the effort", async () => {
    stubApi({ signedIn: true });
    const now = vi.spyOn(Date, "now");
    now.mockReturnValue(1_800_000_000_000);
    renderAt("/start-tummy-time");
    await screen.findByText(en.log.sync.saved);
    fireEvent.click(screen.getByRole("button", { name: en.startTummyTime.start }));
    const status = screen.getByText(en.startTummyTime.started);
    expect(status.getAttribute("role")).toBe("status");
    now.mockReturnValue(1_800_000_000_000 + 5 * 60_000 + 400);
    fireEvent.click(screen.getByRole("button", { name: en.startTummyTime.stop }));
    expect(
      await screen.findByText("Saved 5 minutes of tummy time. Every minute counts."),
    ).toBeDefined();
    now.mockRestore();
    const sync = await startLogSync();
    expect(sync.getState().entries.map((e) => e.durationSeconds)).toEqual([300]);
  });

  it("does not save a tap that was too short", async () => {
    stubApi({ signedIn: true });
    renderAt("/start-tummy-time");
    await screen.findByText(en.log.sync.saved);
    fireEvent.click(screen.getByRole("button", { name: en.startTummyTime.start }));
    fireEvent.click(screen.getByRole("button", { name: en.startTummyTime.stop }));
    expect(await screen.findByText(en.startTummyTime.tooShort)).toBeDefined();
    expect((await startLogSync()).getState().entries).toEqual([]);
  });
});

describe("the log", () => {
  it("shows an empty state, with no axe violations", async () => {
    stubApi({ signedIn: true });
    const { container } = renderAt("/log");
    expect(await screen.findByText(en.log.emptyTitle)).toBeDefined();
    expect(await axeViolations(container)).toEqual([]);
  });

  it("groups entries by day, newest first, lengths in words", async () => {
    stubApi({ signedIn: true });
    logWritesFail();
    await addEntry(2 * 24 * 60, 600);
    await addEntry(30, 90);
    await addEntry(10, 300);
    const { container } = renderAt("/log");
    const today = await screen.findByRole("heading", { level: 2, name: en.log.today });
    const days = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(days[0]).toBe(en.log.today);
    expect(days).toHaveLength(2);
    const todayList = within(today.closest("section") ?? document.body).getAllByRole("listitem");
    expect(
      todayList.map((li) => li.querySelector(".log-entry__text span:last-child")?.textContent),
    ).toEqual(["5 minutes", "1 minute 30 seconds"]);
    // Waiting to be sent: the plain words say it is safe here.
    expect(await screen.findByText(en.log.sync.unreachable)).toBeDefined();
    expect(await axeViolations(container)).toEqual([]);
  });

  it("delete moves focus to an Undo that stays, and Undo puts the entry back", async () => {
    stubApi({ signedIn: true });
    logWritesFail();
    const entry = await addEntry(10, 300);
    renderAt("/log");
    const del = await screen.findByRole("button", { name: /^Delete .*5 minutes$/ });
    fireEvent.click(del);
    const undo = await screen.findByRole("button", { name: en.log.undo });
    await waitFor(() => {
      expect(document.activeElement).toBe(undo);
    });
    expect(screen.getByText(/^Deleted .*5 minutes\.$/).getAttribute("role")).toBe("status");
    expect(screen.queryByRole("button", { name: /^Delete / })).toBeNull();
    // No time limit: it is still there much later.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(screen.getByRole("button", { name: en.log.undo })).toBeDefined();
    fireEvent.click(undo);
    const back = await screen.findByRole("button", { name: /^Delete .*5 minutes$/ });
    await waitFor(() => {
      expect(document.activeElement).toBe(back);
    });
    expect(screen.queryByRole("button", { name: en.log.undo })).toBeNull();
    expect((await startLogSync()).getState().entries.map((e) => e.id)).toEqual([entry.id]);
  });

  it("marks an entry the server refused for good as not saved", async () => {
    // The stub answers 404 to every log write, so the change is dropped and marked.
    stubApi({ signedIn: true });
    await addEntry(10, 300);
    renderAt("/log");
    expect(await screen.findByText(en.log.notSaved)).toBeDefined();
  });
});

describe("Add a time", () => {
  it("shows errors in words, tied to the fields, and moves focus to the first one", async () => {
    stubApi({ signedIn: true });
    const { container } = renderAt("/log/add");
    await screen.findByRole("heading", { level: 1, name: en.addTime.title });
    expect(await axeViolations(container)).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: en.addTime.submit }));
    const time = screen.getByLabelText(en.addTime.timeLabel);
    await waitFor(() => {
      expect(document.activeElement).toBe(time);
    });
    expect(time.getAttribute("aria-invalid")).toBe("true");
    const described = (time.getAttribute("aria-describedby") ?? "")
      .split(" ")
      .map((id) => document.getElementById(id)?.textContent ?? "")
      .join(" ");
    expect(described).toContain(en.addTime.errors.timeMissing);
    expect(screen.getByRole("alert").textContent).toContain(en.addTime.errors.minutesMissing);
    expect(await axeViolations(container)).toEqual([]);
  });

  it("saves a time and shows it in the log, with praise", async () => {
    stubApi({ signedIn: true });
    logWritesFail();
    renderAt("/log/add");
    await screen.findByRole("heading", { level: 1, name: en.addTime.title });
    const earlier = new Date(Date.now() - 60 * 60_000);
    fireEvent.change(screen.getByLabelText(en.addTime.dayLabel), {
      target: {
        value: `${String(earlier.getFullYear())}-${String(earlier.getMonth() + 1).padStart(2, "0")}-${String(earlier.getDate()).padStart(2, "0")}`,
      },
    });
    fireEvent.change(screen.getByLabelText(en.addTime.timeLabel), {
      target: {
        value: `${String(earlier.getHours()).padStart(2, "0")}:${String(earlier.getMinutes()).padStart(2, "0")}`,
      },
    });
    fireEvent.change(screen.getByLabelText(en.addTime.minutesLabel), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: en.addTime.submit }));
    expect(await screen.findByRole("heading", { level: 1, name: en.log.title })).toBeDefined();
    expect(await screen.findByText(en.log.savedFlash)).toBeDefined();
    expect(await screen.findByText("7 minutes")).toBeDefined();
  });
});

describe("this phone's copy is deleted when it is no longer signed in (threat model #13)", () => {
  async function withData(): Promise<void> {
    await addEntry(10, 300);
    expect(await databaseNames()).toContain(LOCAL_DB_NAME);
  }

  it.each([
    ["Sign out on this phone", "/api/auth/sign-out", en.account.signedOut.thisPhone],
    ["Sign out on all phones", "/api/auth/sign-out-everywhere", en.account.signedOut.everywhere],
  ])("after %s", async (button, path, message) => {
    stubApi({
      signedIn: true,
      replies: { [`POST ${path}`]: [{ status: 200, body: { signedOut: true } }] },
    });
    await withData();
    renderAt("/account");
    fireEvent.click(await screen.findByRole("button", { name: button }));
    expect(await screen.findByText(message)).toBeDefined();
    await waitFor(async () => {
      expect(await databaseNames()).not.toContain(LOCAL_DB_NAME);
    });
  });

  it("after the account is deleted", async () => {
    stubApi({
      signedIn: true,
      replies: { "DELETE /api/me": [{ status: 200, body: { deleted: true } }] },
    });
    await withData();
    renderAt("/account");
    fireEvent.change(await screen.findByLabelText(en.account.manage.deletePinLabel), {
      target: { value: "482916" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.account.manage.deleteSubmit }));
    expect(await screen.findByText(en.account.signedOut.deleted)).toBeDefined();
    await waitFor(async () => {
      expect(await databaseNames()).not.toContain(LOCAL_DB_NAME);
    });
  });

  it("when the server answers 401 to sync, unsent changes and all", async () => {
    const api = stubApi({ signedIn: true });
    renderAt("/log");
    await screen.findByText(en.log.emptyTitle);
    // The session ends on the server (for example, signed out everywhere from another phone).
    api.setSignedIn(false);
    logWritesFailWith401();
    await addEntry(10, 300);
    expect(await screen.findByText(en.account.signedOut.plain)).toBeDefined();
    await waitFor(async () => {
      expect(await databaseNames()).not.toContain(LOCAL_DB_NAME);
    });
  });

  it("when the app opens and the server says this phone is signed out", async () => {
    stubApi({ signedIn: true });
    await withData();
    cleanup();
    stubApi({ signedIn: false });
    renderAt("/");
    await waitFor(async () => {
      expect(await databaseNames()).not.toContain(LOCAL_DB_NAME);
    });
  });

  it("before signing out with unsent times, it says so and lets the person stay", async () => {
    stubApi({
      signedIn: true,
      replies: { "POST /api/auth/sign-out": [{ status: 200, body: { signedOut: true } }] },
    });
    logWritesFail();
    await addEntry(10, 300);
    renderAt("/account");
    fireEvent.click(await screen.findByRole("button", { name: en.account.manage.signOut }));
    const warning = await screen.findByRole("alert");
    expect(warning.textContent).toContain(en.account.manage.unsentOne);
    expect(warning.textContent).toContain(en.account.manage.unsentLossOne);
    // Stay: still signed in, nothing deleted.
    fireEvent.click(screen.getByRole("button", { name: en.account.manage.stay }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(await databaseNames()).toContain(LOCAL_DB_NAME);
    // Sign out anyway: signed out and the copy is gone.
    fireEvent.click(screen.getByRole("button", { name: en.account.manage.signOut }));
    fireEvent.click(await screen.findByRole("button", { name: en.account.manage.signOutAnyway }));
    expect(await screen.findByText(en.account.signedOut.thisPhone)).toBeDefined();
    await waitFor(async () => {
      expect(await databaseNames()).not.toContain(LOCAL_DB_NAME);
    });
  });
});

/** Log writes answer 401, as the real API does once the session has ended. */
function logWritesFailWith401(): void {
  const inner = globalThis.fetch;
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith("/api/logs/")) {
      return Promise.resolve(
        Response.json(
          { error: { code: "unauthorized", message: "Please sign in." } },
          { status: 401 },
        ),
      );
    }
    return inner(input, init);
  });
}
