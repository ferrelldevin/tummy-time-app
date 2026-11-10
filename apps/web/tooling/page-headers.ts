import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The page's security headers, read from the one file nginx sends them from
 * (infra/nginx-security-headers.conf). The preview server the browser tests use sends the same
 * headers, so every browser test runs under the real Content Security Policy. If the policy
 * and the app ever disagree, the tests find out, not a family's phone.
 */
const HEADERS_FILE = resolve(import.meta.dirname, "../../../infra/nginx-security-headers.conf");

/** Reads `add_header Name "value" always;` lines. Throws if the file has none it understands. */
export function parseAddHeaders(text: string): Record<string, string> {
  const headers = new Map<string, string>();
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (/^include\s/.test(trimmed)) {
      throw new Error(`This file must hold every header itself, with no include: ${trimmed}`);
    }
    if (!/^add_header\s/.test(trimmed)) {
      continue;
    }
    const match = /^add_header\s+(\S+)\s+"([^"\\]*)"(?:\s+always)?;$/.exec(trimmed);
    if (!match?.[1] || match[2] === undefined) {
      throw new Error(`Cannot read this add_header line: ${trimmed}`);
    }
    if (headers.has(match[1])) {
      // nginx would send both, and a browser enforces both. One line per header, so what the
      // tests run under is exactly what nginx sends.
      throw new Error(`The header ${match[1]} is set twice.`);
    }
    headers.set(match[1], match[2]);
  }
  if (!headers.has("Content-Security-Policy")) {
    throw new Error("No Content-Security-Policy found in the nginx security headers file.");
  }
  return Object.fromEntries(headers);
}

export function pageSecurityHeaders(): Record<string, string> {
  return parseAddHeaders(readFileSync(HEADERS_FILE, "utf8"));
}
