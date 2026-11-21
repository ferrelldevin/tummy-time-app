import { beforeEach, describe, expect, it } from "vitest";
import { planStore } from "./store";

describe("plan store", () => {
  beforeEach(() => {
    planStore.clear();
  });

  it("leaves nothing in storage after clear", () => {
    planStore.saveProfile({ age: "2-4m", born: "28-33", topics: [], going: "some" });
    planStore.markDone("why-tummy-time");
    expect(localStorage.getItem("tummy-plan")).not.toBeNull();
    planStore.clear();
    expect(localStorage.getItem("tummy-plan")).toBeNull();
    expect(planStore.get()).toEqual({ profile: null, done: [] });
  });

  it("follows a sign-out in another tab, so this tab cannot write the old answers back", () => {
    planStore.saveProfile({ age: "2-4m", born: "28-33", topics: [], going: "some" });
    // Another tab clears it: this tab only hears a storage event.
    localStorage.removeItem("tummy-plan");
    window.dispatchEvent(new StorageEvent("storage", { key: "tummy-plan", newValue: null }));
    expect(planStore.get().profile).toBeNull();
    planStore.markDone("safe-setup");
    expect(JSON.parse(localStorage.getItem("tummy-plan") ?? "{}")).toEqual({
      profile: null,
      done: ["safe-setup"],
    });
  });
});
