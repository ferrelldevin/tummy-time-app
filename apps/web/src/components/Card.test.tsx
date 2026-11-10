import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { axeViolations } from "../test/axe";
import { Card } from "./Card";

afterEach(cleanup);

describe("Card", () => {
  it("shows its title as the requested heading level", () => {
    render(
      <Card title="Example" headingLevel={3}>
        <p>Body</p>
      </Card>,
    );
    expect(screen.getByRole("heading", { level: 3, name: "Example" })).toBeDefined();
    expect(screen.getByText("Body")).toBeDefined();
  });

  it("works without a title", () => {
    render(
      <Card>
        <p>Body</p>
      </Card>,
    );
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <main>
        <Card title="Example">
          <p>Body</p>
        </Card>
      </main>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
