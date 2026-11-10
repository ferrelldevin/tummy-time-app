import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { LOCAL_DB_NAME, startLogSync, wipeLocalData } from "./log/local-data";
import { openLogStore } from "./log/store";
import { en } from "./strings/en";
import { apiError, stubApi } from "./test/api-stub";
import { axeViolations } from "./test/axe";

/**
 * Opening the app with no signal (Block 7). GET /api/me cannot reach the server, so this
 * phone's copy of the log decides: it exists only while signed in. The real browser, offline,
 * is in e2e/offline.spec.ts.
 */

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

let online = true;
beforeEach(() => {
  online = true;
  vi.spyOn(navigator, "onLine", "get").mockImplementation(() => online);
});

afterEach(async () => {
  cleanup();
  await wipeLocalData();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function databaseNames(): Promise<string[]> {
  return (await indexedDB.databases()).map((d) => d.name ?? "");
}

/** What a signed-in phone leaves: its copy of the log, with one entry saved earlier. */
async function copyOfTheLog(): Promise<void> {
  const store = await openLogStore(() => undefined);
  await store.saveChange(
    {
      id: "00000000-0000-4000-8000-000000000001",
      startedAt: new Date(Date.now() - 30 * 60_000).toISOString(),
      durationSeconds: 300,
      deletedAt: null,
      rev: 1,
      notSaved: false,
    },
    { op: "put", body: { startedAt: new Date().toISOString(), durationSeconds: 300 } },
  );
  // Sent already: only the entry stays.
  const change = await store.nextChange();
  if (change) await store.changeSent(change, null);
  store.close();
}

function goOnline() {
  online = true;
  act(() => {
    window.dispatchEvent(new Event("online"));
  });
}

describe("the server cannot be reached when the app opens", () => {
  it("with a copy of the log here: signed in, not confirmed yet, and the log works", async () => {
    await copyOfTheLog();
    online = false;
    stubApi({
      signedIn: true,
      replies: {
        "GET /api/me": ["network-error"],
        "GET /api/logs?since=0": ["network-error"],
      },
    });
    const { container } = renderAt("/log");
    expect(await screen.findByRole("heading", { level: 1, name: en.log.title })).toBeDefined();
    expect(screen.getByRole("link", { name: en.account.headerAccount })).toBeDefined();
    // Offline with nothing waiting to go: the phone's copy is what there is.
    expect(await screen.findByText(en.log.sync.saved)).toBeDefined();
    expect(await databaseNames()).toContain(LOCAL_DB_NAME);
    expect(await axeViolations(container)).toEqual([]);

    // An entry made now waits on this phone.
    const sync = await startLogSync();
    await act(async () => {
      await sync.add({ startedAt: new Date().toISOString(), durationSeconds: 120 });
    });
    expect(await screen.findByText(en.log.sync.local)).toBeDefined();
  });

  it("the account screen does not claim a phone count it has not checked", async () => {
    await copyOfTheLog();
    online = false;
    stubApi({ signedIn: true, replies: { "GET /api/me": ["network-error"] } });
    renderAt("/account");
    expect(await screen.findByText(en.account.manage.checkLater, { exact: false })).toBeDefined();
    expect(screen.queryByText(en.account.manage.onePhone, { exact: false })).toBeNull();
  });

  it("asks the server again when the phone is back online, and then it is confirmed", async () => {
    await copyOfTheLog();
    online = false;
    const api = stubApi({ signedIn: true, replies: { "GET /api/me": ["network-error"] } });
    renderAt("/account");
    await screen.findByText(en.account.manage.checkLater, { exact: false });
    goOnline();
    expect(await screen.findByText(en.account.manage.onePhone, { exact: false })).toBeDefined();
    expect(api.calls.filter((c) => c.url === "/api/me")).toHaveLength(2);
  });

  it("asks again when the app comes back to the front", async () => {
    await copyOfTheLog();
    const api = stubApi({ signedIn: true, replies: { "GET /api/me": ["network-error"] } });
    renderAt("/account");
    await screen.findByText(en.account.manage.checkLater, { exact: false });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(await screen.findByText(en.account.manage.onePhone, { exact: false })).toBeDefined();
    expect(api.calls.filter((c) => c.url === "/api/me")).toHaveLength(2);
  });

  it("a 401 once back online deletes the copy and says this phone was signed out", async () => {
    await copyOfTheLog();
    online = false;
    stubApi({
      signedIn: false,
      replies: {
        "GET /api/me": ["network-error"],
        "GET /api/logs?since=0": ["network-error"],
      },
    });
    renderAt("/log");
    expect(await screen.findByRole("heading", { level: 1, name: en.log.title })).toBeDefined();
    goOnline();
    expect(await screen.findByText(en.account.signedOut.plain)).toBeDefined();
    await waitFor(async () => {
      expect(await databaseNames()).not.toContain(LOCAL_DB_NAME);
    });
  });

  it("with no copy here: signed out, and Welcome says sign-in needs a connection", async () => {
    online = false;
    stubApi({ signedIn: true, replies: { "GET /api/me": ["network-error"] } });
    const { container } = renderAt("/log");
    expect(
      await screen.findByRole("heading", { level: 1, name: en.account.welcome.title }),
    ).toBeDefined();
    expect(screen.getByText(en.account.welcome.needsConnection)).toBeDefined();
    const header = screen.getByRole("banner");
    expect(header.querySelector('a[href="/sign-in"]')?.textContent).toBe(en.account.headerSignIn);
    // Asking never made an empty database.
    expect(await databaseNames()).toEqual([]);
    expect(await axeViolations(container)).toEqual([]);
  });

  it("with no copy here, back online, the server may still say signed in", async () => {
    online = false;
    stubApi({ signedIn: true, replies: { "GET /api/me": ["network-error"] } });
    renderAt("/");
    expect(await screen.findByRole("link", { name: en.account.headerSignIn })).toBeDefined();
    goOnline();
    expect(await screen.findByRole("link", { name: en.account.headerAccount })).toBeDefined();
  });

  it("an error answer from the server is not 'no signal': the error state, as before", async () => {
    await copyOfTheLog();
    stubApi({ signedIn: true, replies: { "GET /api/me": [apiError("internal", 500)] } });
    renderAt("/log");
    expect(await screen.findByRole("button", { name: en.states.tryAgain })).toBeDefined();
    // Nothing was deleted either.
    expect(await databaseNames()).toContain(LOCAL_DB_NAME);
    fireEvent.click(screen.getByRole("button", { name: en.states.tryAgain }));
    expect(await screen.findByRole("heading", { level: 1, name: en.log.title })).toBeDefined();
  });
});
