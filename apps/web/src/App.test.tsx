import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { en } from "./strings/en";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("App", () => {
  it("renders the Tummy Time heading", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => undefined)),
    );
    render(<App />);
    expect(screen.getByRole("heading", { level: 1, name: "Tummy Time" })).toBeDefined();
  });

  it("says the server is reachable when the health check passes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(Response.json({ ok: true }))),
    );
    render(<App />);
    expect(await screen.findByText(en.server.reachable)).toBeDefined();
  });

  it("says it can't reach the server when the health check fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("offline"))),
    );
    render(<App />);
    expect(await screen.findByText(en.server.unreachable)).toBeDefined();
  });
});
