import type { Plugin } from "vite";

/** The label index.html carries in its build meta tag. Letters, digits, dot, dash, underscore. */
const BUILD_ID_SHAPE = /^[A-Za-z0-9._-]{1,64}$/;

/**
 * Fills `%TUMMY_BUILD_ID%` in index.html with a label for this build, so anyone can see which
 * version a phone runs (developer tools, <meta name="tummy-build">). It is not secret and holds
 * nothing about a person. Block 8 can set TUMMY_BUILD_ID to the commit when it deploys.
 */
export function buildIdPlugin(buildId: string): Plugin {
  if (!BUILD_ID_SHAPE.test(buildId)) {
    throw new Error(`TUMMY_BUILD_ID must match ${String(BUILD_ID_SHAPE)}, got "${buildId}".`);
  }
  return {
    name: "tummy-build-id",
    transformIndexHtml(html) {
      return html.replace("%TUMMY_BUILD_ID%", buildId);
    },
  };
}
