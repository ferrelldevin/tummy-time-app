import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { axeViolations } from "../test/axe";
import { Link } from "./Link";

afterEach(cleanup);

function renderLink(appearance?: "link" | "primary") {
  return render(
    <MemoryRouter>
      <Link to="/lessons" {...(appearance ? { appearance } : {})}>
        Lessons
      </Link>
    </MemoryRouter>,
  );
}

describe("Link", () => {
  it("is a real link with the right address", () => {
    renderLink();
    expect(screen.getByRole("link", { name: "Lessons" }).getAttribute("href")).toBe("/lessons");
  });

  it("can look like a button and is still a link", () => {
    renderLink("primary");
    const link = screen.getByRole("link", { name: "Lessons" });
    expect(link.className).toContain("btn--primary");
  });

  it("has no axe violations", async () => {
    const { container } = renderLink();
    expect(await axeViolations(container)).toEqual([]);
  });
});
