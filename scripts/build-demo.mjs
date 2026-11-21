// Builds the client demo into apps/web/dist-demo (docs/demo.md).
//
// DEMO=1 turns on the pretend in-browser API and sample data (apps/web/src/demo/). After the
// build, one character is rewritten: a library in the lesson bundle (the YAML reader) writes
// the Unicode replacement character U+FFFD literally inside a template string. Some hosts,
// claude.ai Artifacts among them, refuse files that contain it, because it usually means a file
// was damaged. "�" is the same character written as an escape, so the code is unchanged.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const web = join(import.meta.dirname, "..", "apps", "web");
execFileSync("pnpm", ["exec", "vite", "build"], {
  cwd: web,
  stdio: "inherit",
  env: { ...process.env, DEMO: "1" },
});

const assets = join(web, "dist-demo", "assets");
for (const name of readdirSync(assets)) {
  if (!name.endsWith(".js")) continue;
  const file = join(assets, name);
  const text = readFileSync(file, "utf8");
  if (text.includes("�")) {
    writeFileSync(file, text.replaceAll("�", "\\uFFFD"));
    console.log(`build-demo: escaped U+FFFD in ${name}`);
  }
}
