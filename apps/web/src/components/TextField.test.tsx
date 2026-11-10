import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { axeViolations } from "../test/axe";
import { TextField } from "./TextField";

afterEach(cleanup);

describe("TextField", () => {
  it("connects the label to the input", () => {
    render(<TextField label="Your code" />);
    expect(screen.getByLabelText("Your code")).toBeDefined();
  });

  it("marks required fields in words", () => {
    render(<TextField label="Your code" required />);
    expect(screen.getByLabelText("Your code (required)")).toBeDefined();
  });

  it("ties the hint to the input", () => {
    render(<TextField label="Your code" hint="Six letters." />);
    const input = screen.getByLabelText("Your code");
    const hintId = input.getAttribute("aria-describedby");
    expect(hintId).toBeTruthy();
    expect(document.getElementById(hintId ?? "")?.textContent).toBe("Six letters.");
  });

  it("shows the error as text, marks the input invalid and ties them together", () => {
    render(<TextField label="Your code" error="Enter your code." />);
    const input = screen.getByLabelText("Your code");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const errorId = input.getAttribute("aria-describedby");
    expect(document.getElementById(errorId ?? "")?.textContent).toContain("Enter your code.");
  });

  it("is not invalid when there is no error", () => {
    render(<TextField label="Your code" />);
    expect(screen.getByLabelText("Your code").getAttribute("aria-invalid")).toBeNull();
  });

  it("has no axe violations, with or without an error", async () => {
    const { container } = render(
      <>
        <TextField label="One" hint="A hint." />
        <TextField label="Two" error="A problem." />
      </>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
