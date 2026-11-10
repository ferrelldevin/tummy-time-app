import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { listenForInstall, resetInstall } from "../install/install-prompt";
import { en } from "../strings/en";
import { stubApi } from "../test/api-stub";
import { axeViolations } from "../test/axe";

const t = en.install;

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

/** Chrome's "you may offer to install" event, as a test-made stand-in. */
function offerInstall() {
  const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
    prompt: vi.fn(() => Promise.resolve()),
    userChoice: Promise.resolve({ outcome: "accepted" as const }),
  });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

beforeEach(() => {
  listenForInstall();
});
afterEach(() => {
  cleanup();
  resetInstall();
  vi.unstubAllGlobals();
});

describe("Add to your home screen", () => {
  it("is open to everyone, with numbered steps for iPhone and Android, and passes axe", async () => {
    stubApi({ signedIn: false });
    const { container } = renderAt("/add-to-home-screen");
    expect(await screen.findByRole("heading", { level: 1, name: t.title })).toBeDefined();
    const iphone = screen.getByRole("heading", { level: 2, name: t.iphoneTitle });
    const android = screen.getByRole("heading", { level: 2, name: t.androidTitle });
    const lists = screen.getAllByRole("list").filter((l) => l.tagName === "OL");
    expect(lists).toHaveLength(2);
    const [first, second] = lists;
    if (!first || !second) throw new Error("two lists expected");
    expect(
      within(first)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual([...t.iphoneSteps]);
    expect(
      within(second)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual([...t.androidSteps]);
    // Each list follows its own heading.
    expect(iphone.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(android.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // No install button unless the browser offers it.
    expect(screen.queryByRole("button", { name: t.installButton })).toBeNull();
    expect(await axeViolations(container)).toEqual([]);
  });

  it("is linked from Home and from the account screen", async () => {
    stubApi({ signedIn: true });
    renderAt("/");
    expect(
      (await screen.findByRole("link", { name: en.home.addToHomeScreen })).getAttribute("href"),
    ).toBe("/add-to-home-screen");
    cleanup();
    stubApi({ signedIn: true });
    renderAt("/account");
    expect(
      (await screen.findByRole("link", { name: en.account.manage.addToHomeScreen })).getAttribute(
        "href",
      ),
    ).toBe("/add-to-home-screen");
  });

  it("where the browser offers to install, this page (and only this page) has an Install button", async () => {
    stubApi({ signedIn: false });
    renderAt("/");
    await screen.findByRole("heading", { level: 1 });
    const event = offerInstall();
    // The browser's own install bar is held back too.
    expect(event.defaultPrevented).toBe(true);
    expect(screen.queryByRole("button", { name: t.installButton })).toBeNull();

    fireEvent.click(screen.getByRole("link", { name: en.home.addToHomeScreen }));
    const button = await screen.findByRole("button", { name: t.installButton });
    expect(screen.getByText(t.canInstall)).toBeDefined();
    await act(async () => {
      fireEvent.click(button);
      await Promise.resolve();
    });
    expect(event.prompt).toHaveBeenCalledTimes(1);
    // The offer can be used once.
    expect(screen.queryByRole("button", { name: t.installButton })).toBeNull();
  });

  it("once installed, the button goes away", async () => {
    stubApi({ signedIn: false });
    renderAt("/add-to-home-screen");
    await screen.findByRole("heading", { level: 1, name: t.title });
    offerInstall();
    expect(await screen.findByRole("button", { name: t.installButton })).toBeDefined();
    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });
    expect(screen.queryByRole("button", { name: t.installButton })).toBeNull();
  });
});
