import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// PLACEHOLDER. Block 5 adds the lesson schema and replaces `isValidated` with a real
// parse of each file (including: approved lessons need an approver name and date).
// Until then there are no lesson files, and any file added to content/ fails this test
// so nobody can add content that nothing checks.
const contentDir = fileURLToPath(new URL("../../../content/", import.meta.url));
const NOT_CONTENT = new Set(["README.md", ".gitkeep"]);

// Maps a content file path to the check that validates it. Empty until Block 5.
const validators = new Map<string, (text: string) => boolean>();

function isValidated(file: string): boolean {
  return validators.has(file);
}

describe("content/", () => {
  it("has every file other than README and .gitkeep validated (none yet)", () => {
    const files = readdirSync(contentDir, { recursive: true, encoding: "utf8" }).filter(
      (f) => !NOT_CONTENT.has(f),
    );
    const unvalidated = files.filter((f) => !isValidated(f));
    expect(unvalidated).toEqual([]);
  });
});
