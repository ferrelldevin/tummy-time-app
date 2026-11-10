import { buildLessonIndex } from "@tummy/shared/lesson-files";

// Content is bundled when the app is built. Nothing is fetched while the app runs.
// The glob finds every file in content/lessons, so a new lesson file shows up with no code change.
// This file is loaded only by the lesson screens, so the YAML reader stays out of first load.
const lessonFiles = import.meta.glob<string>("../../../../content/lessons/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});

/** Lessons that pass the schema. A file that fails is left out; `pnpm test` names it and why. */
export const lessonIndex = buildLessonIndex(lessonFiles);
