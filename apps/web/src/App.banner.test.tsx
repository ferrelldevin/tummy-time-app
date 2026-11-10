import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { stubApi } from "./test/api-stub";
import { axeViolations } from "./test/axe";
import { en } from "./strings/en";

// Pretend the build was made with SITE_BANNER=test: the real component, forced on.
vi.mock("./components/SiteBanner", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./components/SiteBanner")>();
  return { ...actual, SiteBanner: () => <actual.SiteBanner show /> };
});

beforeEach(() => {
  stubApi({ signedIn: true });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("test site banner in the app shell", () => {
  it.each(["/", "/when-to-call", "/lessons", "/no-such-page"])(
    "shows on %s and the page has no axe violations",
    async (path) => {
      const { container } = render(
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>,
      );
      expect(await screen.findByText(en.testSiteBanner)).toBeDefined();
      expect(await axeViolations(container)).toEqual([]);
    },
  );
});
