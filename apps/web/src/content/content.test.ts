import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { parseSafetyCardFile } from "@tummy/shared";
import { parseLessonFile } from "@tummy/shared/lesson-files";
import { describe, expect, it } from "vitest";
import { gradeLevel } from "../strings/readability";
import { lessonIndex } from "./lessons";
import { safetyCard } from "./safety-card";

// Reading level of the content files, and proof the app's glob finds every lesson file.
const contentDir = `${resolve(import.meta.dirname, "../../../../content")}/`;
const lessonFiles = readdirSync(`${contentDir}lessons`).filter((f) => f.endsWith(".md"));

/** Takes the Markdown marks out so the scorer sees only words. */
const plain = (s: string) =>
  s
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#*_`>]/g, "")
    .replace(/^\s*(?:[-+]|\d+\.)\s+/gm, "");
const sentence = (s: string) => {
  const t = plain(s).trim();
  return /[.!?]$/.test(t) ? t : `${t}.`;
};

describe("content reading level", () => {
  it.each(lessonFiles)("lesson %s scores at 8th grade or lower", (file) => {
    const result = parseLessonFile(file, readFileSync(`${contentDir}lessons/${file}`, "utf8"));
    if (!result.ok) {
      throw new Error(result.errors.join("; "));
    }
    const lesson = result.value;
    const corpus = [
      lesson.title,
      lesson.goal,
      lesson.body,
      ...lesson.steps.map((s) => s.text),
      lesson.transcript ?? "",
    ]
      .filter(Boolean)
      .map(sentence)
      .join(" ");
    expect(gradeLevel(corpus)).toBeLessThanOrEqual(8);
  });

  it("the safety card scores at 8th grade or lower", () => {
    const result = parseSafetyCardFile(readFileSync(`${contentDir}safety-card.json`, "utf8"));
    if (!result.ok) {
      throw new Error(result.errors.join("; "));
    }
    const corpus = [result.value.emergencyLine, ...result.value.callToday].map(sentence).join(" ");
    expect(gradeLevel(corpus)).toBeLessThanOrEqual(8);
  });
});

describe("the app finds content by itself", () => {
  it("lists every lesson file in content/lessons, found by the glob in content/index.ts", () => {
    expect(lessonIndex.problems).toEqual([]);
    expect(lessonIndex.lessons.map((l) => `${l.id}.md`).sort()).toEqual([...lessonFiles].sort());
  });

  it("loads the safety card", () => {
    expect(safetyCard.ok).toBe(true);
  });
});
