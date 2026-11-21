import type { Lesson } from "@tummy/shared";
import type { Profile } from "./store";

/**
 * Which lessons a caregiver sees first, from their "Getting started" answers. PROPOSED: the real
 * pathways (open question 5) come from the client. Each lesson file lists its `pathways` tags;
 * this function only decides which tags apply.
 *
 * - "core": everyone.
 * - "born-early": any answer except "born on time" (corrected age matters).
 * - "starting" / "crying" / "going-well": from "How is tummy time going?".
 * - "spit-up" / "equipment" / "head-turn": the topics the care team mentioned.
 */
export function tagsFor(profile: Profile): Set<string> {
  const tags = new Set<string>(["core"]);
  if (profile.born !== "on-time") tags.add("born-early");
  if (profile.going === "not-started") tags.add("starting");
  if (profile.going === "crying") tags.add("crying");
  if (profile.going === "going-well") tags.add("going-well");
  for (const t of profile.topics) tags.add(t);
  return tags;
}

/**
 * The plan: lessons that match, in their file order, with a "crying" lesson moved up to second
 * when the caregiver said their baby cries (that is the reason families stop, per the brief).
 */
export function planFor(profile: Profile, lessons: readonly Lesson[]): Lesson[] {
  const tags = tagsFor(profile);
  const matched = lessons.filter((l) => l.pathways.some((p) => tags.has(p)));
  if (profile.going !== "crying") return matched;
  const crying = matched.filter(
    (l) => l.pathways.includes("crying") && !l.pathways.includes("core"),
  );
  const rest = matched.filter((l) => !crying.includes(l));
  return [...rest.slice(0, 1), ...crying, ...rest.slice(1)];
}
