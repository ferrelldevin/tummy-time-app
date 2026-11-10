import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { axeViolations } from "../test/axe";
import { en } from "../strings/en";
import { SkipLink } from "./SkipLink";

afterEach(cleanup);

describe("SkipLink", () => {
  it("points at the target and uses the catalog text", () => {
    render(<SkipLink targetId="main" />);
    const link = screen.getByRole("link", { name: en.skipLink });
    expect(link.getAttribute("href")).toBe("#main");
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <>
        <SkipLink targetId="main" />
        <main id="main">
          <h1>Title</h1>
        </main>
      </>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
