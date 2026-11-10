/**
 * An approximate Flesch-Kincaid grade level, written for this project (no library).
 * It is a rough guide, not a verdict: the syllable count is a simple vowel-group rule and
 * very short strings (a single button label) score badly even when they are plain.
 * The style guide asks for 6th to 8th grade; the test enforces 8 or lower.
 */
export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length === 0) {
    return 0;
  }
  if (w.length <= 3) {
    return 1;
  }
  const trimmed = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  const groups = trimmed.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

export function gradeLevel(text: string): number {
  const sentences = text
    .split(/[.!?]+(?:\s|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
  const words = text.split(/\s+/).filter((w) => /[a-z]/i.test(w));
  if (sentences.length === 0 || words.length === 0) {
    return 0;
  }
  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  return 0.39 * (words.length / sentences.length) + 11.8 * (syllables / words.length) - 15.59;
}
