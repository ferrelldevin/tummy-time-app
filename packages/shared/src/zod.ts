import { z } from "zod";

/**
 * Every schema file in this package imports `z` from HERE, never from "zod" directly
 * (test/zod-import.test.ts checks). That guarantees the setting below is in place before the
 * first schema is made, whatever order the files are bundled in.
 *
 * The setting, for browsers only: Zod can check objects faster by writing a small function at
 * run time. To learn whether it may, it tries `new Function("")` once, when the first object
 * schema is made. Our page's Content Security Policy forbids exactly that (no code made from
 * text, ever), so the browser refuses and reports a policy violation on every page load, and
 * Zod carries on the slower way. "jitless" tells it not to try, so the page's violation report
 * stays empty unless something is really wrong (apps/web/e2e/policy.spec.ts checks it is).
 *
 * The API runs in Node, where there is no `document` and no such policy, so it keeps the
 * faster way.
 */
if ("document" in globalThis) {
  z.config({ jitless: true });
}

export { z };
