import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { axeViolations } from "./test/axe";
import { en } from "./strings/en";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(Response.json({ ok: true }))),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Home", () => {
  it("renders the Tummy Time heading and the two main actions", async () => {
    renderAt("/");
    expect(screen.getByRole("heading", { level: 1, name: "Tummy Time" })).toBeDefined();
    expect(screen.getByRole("link", { name: en.home.startTummyTime }).getAttribute("href")).toBe(
      "/start-tummy-time",
    );
    expect(screen.getByRole("link", { name: en.home.babyCrying }).getAttribute("href")).toBe(
      "/baby-crying",
    );
    await screen.findByText(en.server.reachable);
  });

  it("says the server is reachable when the health check passes", async () => {
    renderAt("/");
    expect(await screen.findByText(en.server.reachable)).toBeDefined();
  });

  it("says it can't reach the server when the health check fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("offline"))),
    );
    renderAt("/");
    expect(await screen.findByText(en.server.unreachable)).toBeDefined();
  });

  it("has no axe violations", async () => {
    const { container } = renderAt("/");
    await screen.findByText(en.server.reachable);
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe("When to call is one tap away from every screen", () => {
  const paths = [
    "/",
    "/start-tummy-time",
    "/baby-crying",
    "/lessons",
    "/log",
    "/when-to-call",
    "/no-such-page",
  ];
  it.each(paths)("%s has the When to call link in the bottom bar", async (path) => {
    renderAt(path);
    const nav = screen.getByRole("navigation", { name: en.nav.label });
    const link = Array.from(nav.querySelectorAll("a")).find(
      (a) => a.textContent === en.nav.whenToCall,
    );
    expect(link?.getAttribute("href")).toBe("/when-to-call");
    await screen.findByRole("heading", { level: 1 });
  });

  it("the bottom bar lists Home, Lessons, Log and When to call", () => {
    renderAt("/");
    const nav = screen.getByRole("navigation", { name: en.nav.label });
    expect(Array.from(nav.querySelectorAll("a")).map((a) => a.textContent)).toEqual([
      en.nav.home,
      en.nav.lessons,
      en.nav.log,
      en.nav.whenToCall,
    ]);
  });
});

describe("placeholder screens", () => {
  const screens = [
    ["/start-tummy-time", en.startTummyTime.title],
    ["/baby-crying", en.babyCrying.title],
    ["/when-to-call", en.whenToCall.title],
    ["/lessons", en.lessons.title],
    ["/log", en.log.title],
  ] as const;

  it.each(screens)("%s shows its title and the draft label", (path, title) => {
    renderAt(path);
    expect(screen.getByRole("heading", { level: 1, name: title })).toBeDefined();
    expect(screen.getByText(en.draftLabel, { exact: false })).toBeDefined();
  });

  it.each(screens)("%s has no axe violations", async (path) => {
    const { container } = renderAt(path);
    expect(await axeViolations(container)).toEqual([]);
  });

  it("shows a way home on an unknown address", () => {
    renderAt("/no-such-page");
    expect(screen.getByRole("heading", { level: 1, name: en.notFound.title })).toBeDefined();
    expect(screen.getByRole("link", { name: en.notFound.backHome })).toBeDefined();
  });
});

describe("navigation", () => {
  it("sets the page title on load, without moving focus", () => {
    renderAt("/when-to-call");
    expect(document.title).toBe(`${en.whenToCall.title} | ${en.appName}`);
    expect(document.activeElement).toBe(document.body);
  });

  it("sets the page title and moves focus to the h1 after going to another screen", async () => {
    renderAt("/");
    expect(document.title).toBe(en.appName);
    fireEvent.click(screen.getByRole("link", { name: en.nav.whenToCall }));
    const heading = await screen.findByRole("heading", { level: 1, name: en.whenToCall.title });
    expect(document.title).toBe(`${en.whenToCall.title} | ${en.appName}`);
    expect(document.activeElement).toBe(heading);
    fireEvent.click(screen.getByRole("link", { name: en.nav.home }));
    const home = await screen.findByRole("heading", { level: 1, name: en.home.title });
    expect(document.title).toBe(en.appName);
    expect(document.activeElement).toBe(home);
  });

  it("marks the current bottom bar item", () => {
    renderAt("/lessons");
    expect(screen.getByRole("link", { name: en.nav.lessons }).getAttribute("aria-current")).toBe(
      "page",
    );
    expect(screen.getByRole("link", { name: en.nav.home }).getAttribute("aria-current")).toBeNull();
  });
});

describe("shell", () => {
  it("starts with a skip link that points at the main area", () => {
    renderAt("/");
    const skip = screen.getByRole("link", { name: en.skipLink });
    expect(skip.getAttribute("href")).toBe("#main");
    expect(document.getElementById("main")?.tagName).toBe("MAIN");
  });

  it("shows the offline notice while offline and hides it when back online", () => {
    const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    renderAt("/");
    expect(screen.getByText(en.states.offlineBody)).toBeDefined();
    online.mockReturnValue(true);
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(screen.queryByText(en.states.offlineBody)).toBeNull();
    online.mockRestore();
  });
});
