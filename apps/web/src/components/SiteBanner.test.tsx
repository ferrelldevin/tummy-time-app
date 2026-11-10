import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { axeViolations } from "../test/axe";
import { en } from "../strings/en";
import { SiteBanner, isTestSite } from "./SiteBanner";

afterEach(cleanup);

describe("SiteBanner", () => {
  it("says the fixed words from the string catalog when on", () => {
    expect(en.testSiteBanner).toBe("Test site. Sample data.");
    render(<SiteBanner show />);
    expect(screen.getByText("Test site. Sample data.")).toBeDefined();
  });

  it("draws nothing when off", () => {
    const { container } = render(<SiteBanner show={false} />);
    expect(container.innerHTML).toBe("");
  });

  it("is off in a normal build (SITE_BANNER not set when the tests run)", () => {
    const { container } = render(<SiteBanner />);
    expect(container.innerHTML).toBe("");
  });

  it("only the value test turns it on", () => {
    expect(isTestSite("test")).toBe(true);
    for (const value of ["", "off", "true", "1", "Test"]) {
      expect(isTestSite(value)).toBe(false);
    }
  });

  it("has no axe violations", async () => {
    const { container } = render(<SiteBanner show />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
