import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { axeViolations } from "../test/axe";
import { en } from "../strings/en";
import { Alert } from "./Alert";

afterEach(cleanup);

describe("Alert", () => {
  it("announces errors right away and says Problem in words", () => {
    render(<Alert kind="error">Try again.</Alert>);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain(en.alert.error);
    expect(alert.textContent).toContain("Try again.");
  });

  it("uses a polite status for notes", () => {
    render(<Alert>Hello.</Alert>);
    expect(screen.getByRole("status").textContent).toContain(en.alert.info);
  });

  it("hides the icon from screen readers", () => {
    const { container } = render(<Alert kind="success">Saved.</Alert>);
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("has no axe violations in any kind", async () => {
    const { container } = render(
      <>
        <Alert>One</Alert>
        <Alert kind="success">Two</Alert>
        <Alert kind="error">Three</Alert>
      </>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
