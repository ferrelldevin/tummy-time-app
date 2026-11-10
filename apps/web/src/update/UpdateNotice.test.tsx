import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { en } from "../strings/en";
import { stubApi } from "../test/api-stub";
import { axeViolations } from "../test/axe";
import type { Updater, UpdateView } from "./updater";
import { setUpdater } from "./updates";

const t = en.update;

/** A stand-in updater whose view the test sets. */
function fakeUpdater(initial: UpdateView) {
  let view = initial;
  const listeners = new Set<() => void>();
  const fake: Updater = {
    start: () => Promise.resolve(),
    stop: () => undefined,
    getView: () => view,
    subscribe: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    screenChanged: vi.fn(),
    updateNow: vi.fn(),
  };
  return {
    fake,
    set(next: Partial<UpdateView>) {
      view = { ...view, ...next };
      for (const l of listeners) l();
    },
  };
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  setUpdater(null);
  vi.unstubAllGlobals();
});

describe("the update notice", () => {
  it("is an empty polite live region until a new version waits", async () => {
    stubApi();
    const u = fakeUpdater({ ready: false, heldByTimer: false, updating: false });
    setUpdater(u.fake);
    renderAt("/");
    await screen.findByText(en.server.reachable);
    expect(screen.queryByText(t.title)).toBeNull();
    const main = screen.getByRole("main");
    const region = main.querySelector(".update-slot");
    expect(region?.getAttribute("role")).toBe("status");

    act(() => {
      u.set({ ready: true });
    });
    // It appears inside the live region that was already there, so it is announced politely.
    expect(region?.textContent).toContain(t.title);
    expect(region?.textContent).toContain(t.body);
  });

  it.each(["/", "/lessons", "/when-to-call", "/sign-in", "/add-to-home-screen"])(
    "shows at the top of %s, with a button that works by keyboard, and passes axe",
    async (path) => {
      stubApi();
      const u = fakeUpdater({ ready: true, heldByTimer: false, updating: false });
      setUpdater(u.fake);
      const { container } = renderAt(path);
      await screen.findByRole("heading", { level: 1 });
      const main = screen.getByRole("main");
      expect(main.firstElementChild?.textContent).toContain(t.title);
      const button = screen.getByRole("button", { name: t.button });
      button.focus();
      expect(document.activeElement).toBe(button);
      fireEvent.click(button);
      expect(u.fake.updateNow).toHaveBeenCalledTimes(1);
      expect(await axeViolations(container)).toEqual([]);
    },
  );

  it("says to stop the timer first when the timer holds the update", async () => {
    stubApi();
    const u = fakeUpdater({ ready: true, heldByTimer: true, updating: false });
    setUpdater(u.fake);
    renderAt("/");
    expect(await screen.findByText(t.stopTimerFirst)).toBeDefined();
  });

  it("says it is updating while the page is about to reload", async () => {
    stubApi();
    const u = fakeUpdater({ ready: true, heldByTimer: false, updating: true });
    setUpdater(u.fake);
    renderAt("/");
    expect((await screen.findByRole("button", { name: t.updating })).hasAttribute("disabled")).toBe(
      true,
    );
  });

  it("moving to another screen is a safe moment; the first screen is not", async () => {
    stubApi();
    const u = fakeUpdater({ ready: false, heldByTimer: false, updating: false });
    setUpdater(u.fake);
    renderAt("/");
    await screen.findByText(en.server.reachable);
    expect(u.fake.screenChanged).not.toHaveBeenCalled();
    const nav = screen.getByRole("navigation", { name: en.nav.label });
    const link = Array.from(nav.querySelectorAll("a")).find(
      (a) => a.textContent === en.nav.whenToCall,
    );
    if (!link) throw new Error("no When to call link");
    fireEvent.click(link);
    await screen.findByRole("heading", { level: 1, name: en.whenToCall.title });
    expect(u.fake.screenChanged).toHaveBeenCalledTimes(1);
  });
});
