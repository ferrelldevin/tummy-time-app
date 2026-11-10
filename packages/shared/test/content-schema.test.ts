import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { EMERGENCY_LINE, parseSafetyCardFile } from "../src/index.js";
import { buildLessonIndex, parseLessonFile } from "../src/lesson-files.js";

// This test is the content gate. It runs under `pnpm test`, so CI runs it on every pull request.
// It replaces the Block 1 placeholder, which only failed on any file. Now every file is parsed.
const contentDir = fileURLToPath(new URL("../../../content/", import.meta.url));
const lessonsDir = `${contentDir}lessons/`;

const read = (path: string) => readFileSync(path, "utf8");
const lessonFiles = readdirSync(lessonsDir).filter((f) => f !== ".gitkeep");

/** A valid lesson file to start from. Tests change one thing at a time. */
function lessonFile(settings: string, body = "Some text."): string {
  return `---\nid: sample\ntitle: Sample\ngoal: A sample goal.\nstatus: placeholder\n${settings}---\n\n${body}\n`;
}
const errorsOf = (source: string) => {
  const result = parseLessonFile("sample.md", source);
  return result.ok ? [] : result.errors;
};

describe("content/ folder", () => {
  it("holds only the files we know how to check", () => {
    const top = readdirSync(contentDir).sort();
    expect(top).toEqual(["README.md", "lessons", "safety-card.json"]);
    for (const file of lessonFiles) {
      expect(file, "lesson files end in .md").toMatch(/\.md$/);
    }
  });

  it("has at least one lesson", () => {
    expect(lessonFiles.length).toBeGreaterThan(0);
  });

  it.each(lessonFiles)("lesson %s matches the schema", (file) => {
    const result = parseLessonFile(file, read(`${lessonsDir}${file}`));
    expect(result.ok ? [] : result.errors).toEqual([]);
  });

  it("the safety card matches the schema", () => {
    const result = parseSafetyCardFile(read(`${contentDir}safety-card.json`));
    expect(result.ok ? [] : result.errors).toEqual([]);
  });

  it("the placeholder lesson and safety card are both still placeholders", () => {
    const lesson = parseLessonFile("first-lesson.md", read(`${lessonsDir}first-lesson.md`));
    const card = parseSafetyCardFile(read(`${contentDir}safety-card.json`));
    expect(lesson.ok && lesson.value.status).toBe("placeholder");
    expect(card.ok && card.value.status).toBe("placeholder");
  });
});

describe("approval rule", () => {
  it("rejects an approved lesson with no name and no date", () => {
    const errors = errorsOf(lessonFile("").replace("status: placeholder", "status: approved"));
    expect(errors.some((e) => e.startsWith("approvedBy:"))).toBe(true);
    expect(errors.some((e) => e.startsWith("approvedOn:"))).toBe(true);
  });

  it("rejects an approved lesson whose name is only spaces", () => {
    const source = lessonFile('approvedBy: "   "\napprovedOn: 2000-01-01\n').replace(
      "status: placeholder",
      "status: approved",
    );
    expect(errorsOf(source).some((e) => e.startsWith("approvedBy:"))).toBe(true);
  });

  it("rejects a date that is not a date", () => {
    const source = lessonFile("approvedBy: Sample Clinician\napprovedOn: soon\n").replace(
      "status: placeholder",
      "status: approved",
    );
    expect(errorsOf(source).some((e) => e.startsWith("approvedOn:"))).toBe(true);
  });

  it("accepts an approved lesson with a name and a date", () => {
    const source = lessonFile("approvedBy: Sample Clinician\napprovedOn: 2000-01-01\n").replace(
      "status: placeholder",
      "status: approved",
    );
    expect(errorsOf(source)).toEqual([]);
  });

  it("rejects an approved safety card with no name and date", () => {
    const result = parseSafetyCardFile(
      JSON.stringify({ emergencyLine: EMERGENCY_LINE, callToday: ["Item"], status: "approved" }),
    );
    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.errors.map((e) => e.split(":")[0])).toEqual([
      "approvedBy",
      "approvedOn",
    ]);
  });

  it("rejects a status other than placeholder or approved", () => {
    expect(errorsOf(lessonFile("").replace("status: placeholder", "status: final")).length).toBe(1);
  });
});

describe("images and video", () => {
  it("rejects a step image with no alt text", () => {
    const errors = errorsOf(lessonFile("steps:\n  - text: Step\n    image: /media/a.jpg\n"));
    expect(errors).toEqual([expect.stringMatching(/^steps\.0\.alt: is required/)]);
  });

  it("rejects a step image whose alt text is only spaces", () => {
    const errors = errorsOf(
      lessonFile('steps:\n  - text: Step\n    image: /media/a.jpg\n    alt: "  "\n'),
    );
    expect(errors).toHaveLength(1);
  });

  it("accepts a step image with alt text", () => {
    expect(
      errorsOf(lessonFile("steps:\n  - text: Step\n    image: /media/a.jpg\n    alt: A drawing\n")),
    ).toEqual([]);
  });

  it("rejects a video with no captions and no transcript", () => {
    const errors = errorsOf(lessonFile("videoUrl: /media/v.mp4\n"));
    expect(errors.some((e) => e.startsWith("captionsUrl:"))).toBe(true);
    expect(errors.some((e) => e.startsWith("transcript:"))).toBe(true);
  });

  it("rejects a video with captions but no transcript", () => {
    const errors = errorsOf(lessonFile("videoUrl: /media/v.mp4\ncaptionsUrl: /media/v.vtt\n"));
    expect(errors).toEqual([expect.stringMatching(/^transcript:/)]);
  });

  it("accepts a video with captions and a transcript", () => {
    expect(
      errorsOf(
        lessonFile(
          "videoUrl: /media/v.mp4\ncaptionsUrl: /media/v.vtt\ntranscript: Words spoken.\n",
        ),
      ),
    ).toEqual([]);
  });

  it.each([
    "https://example.com/v.mp4",
    "//example.com/v.mp4",
    "http://example.com/a.jpg",
    "javascript:alert(1)",
    "data:text/html,hi",
    "media/relative.mp4",
    "/\\example.com/v.mp4",
  ])("rejects an asset that is not on our own server: %s", (path) => {
    const video = errorsOf(
      lessonFile(`videoUrl: '${path}'\ncaptionsUrl: /media/v.vtt\ntranscript: Words.\n`),
    );
    expect(video.some((e) => e.startsWith("videoUrl:"))).toBe(true);
    const image = errorsOf(
      lessonFile(`steps:\n  - text: Step\n    image: '${path}'\n    alt: A drawing\n`),
    );
    expect(image.some((e) => e.startsWith("steps.0.image:"))).toBe(true);
  });
});

describe("other rules", () => {
  it("rejects a misspelled setting name instead of ignoring it", () => {
    expect(errorsOf(lessonFile("aprovedBy: Someone\n")).length).toBe(1);
  });

  it("rejects raw HTML in the lesson text", () => {
    const errors = errorsOf(lessonFile("", "Hello <script>alert(1)</script>"));
    expect(errors).toEqual([expect.stringMatching(/^body: raw HTML is not allowed/)]);
  });

  it("rejects a file whose name and id disagree", () => {
    const result = parseLessonFile("other-name.md", lessonFile(""));
    expect(result.ok ? [] : result.errors[0]).toMatch(/must match/);
  });

  it("rejects a file with no settings block", () => {
    expect(errorsOf("Just text.").length).toBe(1);
  });

  it("rejects settings that are not valid YAML", () => {
    expect(errorsOf("---\nid: [unclosed\n---\ntext")[0]).toMatch(/not valid YAML/);
  });

  it("keeps checks empty for now", () => {
    expect(errorsOf(lessonFile("checks:\n  - question: Q\n")).length).toBe(1);
    expect(errorsOf(lessonFile("checks: []\n"))).toEqual([]);
  });
});

describe("safety card emergency line", () => {
  const card = (line: string) =>
    parseSafetyCardFile(
      JSON.stringify({ emergencyLine: line, callToday: ["Item"], status: "placeholder" }),
    );

  it("is exactly the fixed sentence", () => {
    expect(EMERGENCY_LINE).toBe("Trouble breathing or turning blue: call 911.");
  });

  it("is accepted when unchanged", () => {
    expect(card(EMERGENCY_LINE).ok).toBe(true);
  });

  it.each(["Call 911.", "Trouble breathing or turning blue: call 911", ""])(
    "is refused when changed to %j",
    (line) => {
      expect(card(line).ok).toBe(false);
    },
  );

  it("is refused when left out", () => {
    expect(
      parseSafetyCardFile(JSON.stringify({ callToday: ["Item"], status: "placeholder" })).ok,
    ).toBe(false);
  });

  it("is refused when the file is not valid JSON", () => {
    expect(parseSafetyCardFile("{ not json").ok).toBe(false);
  });

  it("needs at least one call today item", () => {
    const result = parseSafetyCardFile(
      JSON.stringify({ emergencyLine: EMERGENCY_LINE, callToday: [], status: "placeholder" }),
    );
    expect(result.ok).toBe(false);
  });
});

describe("adding a lesson takes one file and no code change", () => {
  const first = lessonFile("").replace("id: sample", "id: a-first");
  const second = lessonFile("").replace("id: sample", "id: b-second").replace("Sample", "Second");

  it("a new file in the folder becomes a new lesson in the index", () => {
    const before = buildLessonIndex({ "/content/lessons/a-first.md": first });
    expect(before.lessons.map((l) => l.id)).toEqual(["a-first"]);
    const after = buildLessonIndex({
      "/content/lessons/a-first.md": first,
      "/content/lessons/b-second.md": second,
    });
    expect(after.lessons.map((l) => l.id)).toEqual(["a-first", "b-second"]);
    expect(after.problems).toEqual([]);
  });

  it("a bad file is reported and left out, and the good ones stay", () => {
    const index = buildLessonIndex({
      "/content/lessons/a-first.md": first,
      "/content/lessons/bad.md": "not a lesson",
    });
    expect(index.lessons.map((l) => l.id)).toEqual(["a-first"]);
    expect(index.problems.map((p) => p.file)).toEqual(["/content/lessons/bad.md"]);
  });

  it("the real lesson folder builds into an index with no problems", () => {
    const files = Object.fromEntries(lessonFiles.map((f) => [f, read(`${lessonsDir}${f}`)]));
    const index = buildLessonIndex(files);
    expect(index.problems).toEqual([]);
    expect(index.lessons).toHaveLength(lessonFiles.length);
  });
});
