import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { axeViolations } from "../test/axe";
import { en } from "../strings/en";
import { Spinner } from "./Spinner";

afterEach(cleanup);

describe("Spinner", () => {
  it("has a text alternative in a status region", () => {
    render(<Spinner />);
    expect(screen.getByRole("status").textContent).toBe(en.states.loading);
  });

  it("accepts a custom label", () => {
    render(<Spinner label="Saving..." />);
    expect(screen.getByRole("status").textContent).toBe("Saving...");
  });

  it("hides the ring from screen readers", () => {
    const { container } = render(<Spinner />);
    expect(container.querySelector(".spinner__ring")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("has no axe violations", async () => {
    const { container } = render(<Spinner />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
