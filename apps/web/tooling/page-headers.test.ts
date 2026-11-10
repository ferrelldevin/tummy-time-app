import { describe, expect, it } from "vitest";
import { pageSecurityHeaders, parseAddHeaders } from "./page-headers";

const CSP = `add_header Content-Security-Policy "default-src 'self'" always;`;

describe("reading nginx's add_header lines", () => {
  it("reads the real file, and it holds the policy and the other security headers", () => {
    const headers = pageSecurityHeaders();
    expect(headers["Content-Security-Policy"]).toContain("default-src 'self'");
    expect(Object.keys(headers).sort()).toEqual([
      "Content-Security-Policy",
      "Cross-Origin-Opener-Policy",
      "Referrer-Policy",
      "Strict-Transport-Security",
      "X-Content-Type-Options",
      "X-Frame-Options",
    ]);
  });

  it("reads lines with tabs or several spaces, with or without always, and skips comments", () => {
    expect(
      parseAddHeaders(
        `# a comment\n${CSP}\n\tadd_header\tX-One   "1";\r\n  add_header X-Two "2"  always;`,
      ),
    ).toEqual({ "Content-Security-Policy": "default-src 'self'", "X-One": "1", "X-Two": "2" });
  });

  it.each([
    ["an escaped quote", `add_header X-One "a \\" b";`],
    ["no quotes", "add_header X-One 1;"],
    ["single quotes", "add_header X-One '1';"],
    ["a value split over two lines", `add_header X-One "a\nb";`],
    ["a comment after the line", `add_header X-One "1"; # why`],
    ["two on one line", `add_header X-One "1"; add_header X-Two "2";`],
    ["the same header twice", `add_header X-One "1";\nadd_header X-One "2";`],
    ["an include", "include /etc/nginx/more.conf;"],
  ])("refuses %s instead of guessing", (_name, extra) => {
    expect(() => parseAddHeaders(`${CSP}\n${extra}`)).toThrow();
  });

  it("refuses a file with no policy at all", () => {
    expect(() => parseAddHeaders(`add_header X-One "1";`)).toThrow(/Content-Security-Policy/);
  });
});
