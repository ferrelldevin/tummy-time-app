import type { Lesson } from "@tummy/shared";
import { describe, expect, it } from "vitest";
import { planFor, tagsFor } from "./pathways";
import type { Profile } from "./store";

function lesson(id: string, pathways: string[], order: number): Lesson {
  return {
    id,
    title: id,
    goal: "g",
    body: "b",
    steps: [],
    checks: [],
    pathways,
    order,
    minutes: 2,
    status: "placeholder",
  };
}

const lessons = [
  lesson("why", ["core"], 10),
  lesson("tubes", ["equipment"], 15),
  lesson("setup", ["core"], 20),
  lesson("corrected", ["born-early"], 30),
  lesson("cries", ["crying"], 45),
  lesson("chest", ["core", "crying"], 50),
  lesson("play", ["going-well", "core"], 70),
];

const base: Profile = { age: "2-4m", born: "28-33", topics: [], going: "some" };

describe("plan", () => {
  it("everyone gets the core lessons; born early adds corrected age", () => {
    expect(planFor(base, lessons).map((l) => l.id)).toEqual([
      "why",
      "setup",
      "corrected",
      "chest",
      "play",
    ]);
    expect(planFor({ ...base, born: "on-time" }, lessons).map((l) => l.id)).not.toContain(
      "corrected",
    );
  });

  it("adds the topics the care team mentioned", () => {
    expect(tagsFor({ ...base, topics: ["equipment"] }).has("equipment")).toBe(true);
    expect(planFor({ ...base, topics: ["equipment"] }, lessons).map((l) => l.id)).toContain(
      "tubes",
    );
  });

  it("moves the crying lesson up to second when the baby cries", () => {
    const ids = planFor({ ...base, going: "crying" }, lessons).map((l) => l.id);
    expect(ids.slice(0, 2)).toEqual(["why", "cries"]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
