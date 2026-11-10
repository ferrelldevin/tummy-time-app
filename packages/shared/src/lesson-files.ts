import { parse as parseYaml } from "yaml";
import { describeIssues, lessonSchema, type Lesson, type ParseResult } from "./content.js";

// Kept apart from content.ts on purpose: the YAML reader is large, and the "When to call" screen
// must not have to load it. Only the lesson screens import this file.

function parseYamlText(source: string): ParseResult<unknown> {
  try {
    return { ok: true, value: parseYaml(source) as unknown };
  } catch (error) {
    const message =
      error instanceof Error ? (error.message.split("\n")[0] ?? "unreadable") : "unreadable";
    return { ok: false, errors: [`file: the settings at the top are not valid YAML (${message})`] };
  }
}

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n([\s\S]*))?$/;

/**
 * Reads a lesson file: settings between two lines of `---`, then the lesson text in Markdown.
 * `fileName` is checked against the lesson's id so a file and its address cannot disagree.
 */
export function parseLessonFile(fileName: string, source: string): ParseResult<Lesson> {
  const match = FRONT_MATTER.exec(source.charCodeAt(0) === 0xfeff ? source.slice(1) : source);
  if (!match) {
    return {
      ok: false,
      errors: ["file: must start with a line of --- , the settings, and another line of ---"],
    };
  }
  const settings = parseYamlText(match[1] ?? "");
  if (!settings.ok) {
    return settings;
  }
  if (
    typeof settings.value !== "object" ||
    settings.value === null ||
    Array.isArray(settings.value)
  ) {
    return {
      ok: false,
      errors: ["file: the settings at the top must be a list of name: value lines"],
    };
  }
  const result = lessonSchema.safeParse({ ...settings.value, body: (match[2] ?? "").trim() });
  if (!result.success) {
    return { ok: false, errors: describeIssues(result.error) };
  }
  const expected = fileName.replace(/^.*[\\/]/, "").replace(/\.md$/, "");
  if (result.data.id !== expected) {
    return {
      ok: false,
      errors: [
        `id: is "${result.data.id}" but the file is named "${expected}.md". They must match`,
      ],
    };
  }
  return { ok: true, value: result.data };
}

export interface LessonIndex {
  /** Valid lessons, sorted by id. */
  lessons: Lesson[];
  /** Files that failed, with plain-words reasons. Never shown to caregivers. */
  problems: { file: string; errors: string[] }[];
}

/**
 * Builds the list of lessons from a map of file path to file text. The app builds the map by
 * globbing `content/lessons/*.md`, so adding a file adds a lesson with no code change.
 */
export function buildLessonIndex(files: Record<string, string>): LessonIndex {
  const lessons: Lesson[] = [];
  const problems: LessonIndex["problems"] = [];
  for (const [file, source] of Object.entries(files)) {
    const result = parseLessonFile(file, source);
    if (result.ok) {
      lessons.push(result.value);
    } else {
      problems.push({ file, errors: result.errors });
    }
  }
  lessons.sort((a, b) => a.id.localeCompare(b.id));
  return { lessons, problems };
}
