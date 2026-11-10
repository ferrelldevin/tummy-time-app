import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axeViolations } from "../test/axe";
import { en } from "../strings/en";
import { EmptyState, ErrorState, LoadingState, OfflineNotice } from "./StateViews";

afterEach(cleanup);

describe("standard states", () => {
  it("loading shows text, not only a ring", () => {
    render(<LoadingState />);
    expect(screen.getByRole("status").textContent).toBe(en.states.loading);
  });

  it("empty explains itself", () => {
    render(<EmptyState />);
    expect(screen.getByRole("heading", { name: en.states.emptyTitle })).toBeDefined();
    expect(screen.getByText(en.states.emptyBody)).toBeDefined();
  });

  it("error gives a way forward that works", () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);
    expect(screen.getByRole("alert").textContent).toContain(en.states.errorTitle);
    fireEvent.click(screen.getByRole("button", { name: en.states.tryAgain }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("offline notice says what still works", () => {
    render(<OfflineNotice />);
    expect(screen.getByRole("status").textContent).toContain(en.states.offlineBody);
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <main>
        <LoadingState />
        <EmptyState />
        <ErrorState onRetry={() => undefined} />
        <OfflineNotice />
      </main>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
