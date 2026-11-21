import { useSyncExternalStore } from "react";
import type { AgeChoice, BornChoice } from "./corrected-age";

/**
 * The "Getting started" answers and lesson progress. Kept ON THIS PHONE ONLY (localStorage), never
 * sent to the server, and holding no personal information: two age ranges, a few yes/no topics,
 * and which lessons are done. docs/data-map.md lists these as PROPOSED, waiting for Devin's OK.
 *
 * Nothing here is study data. The quick-check answers are not stored at all; only "done".
 */

export const topicChoices = ["spit-up", "equipment", "head-turn"] as const;
export type Topic = (typeof topicChoices)[number];

export const goingChoices = ["not-started", "crying", "some", "going-well"] as const;
export type Going = (typeof goingChoices)[number];

export interface Profile {
  age: AgeChoice;
  born: BornChoice;
  topics: Topic[];
  going: Going;
}

export interface PlanState {
  profile: Profile | null;
  done: string[];
}

const KEY = "tummy-plan";
const EMPTY: PlanState = { profile: null, done: [] };
let state: PlanState = read();
const listeners = new Set<() => void>();

function read(): PlanState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<PlanState>;
    return {
      profile: parsed.profile ?? null,
      done: Array.isArray(parsed.done) ? parsed.done.filter((d) => typeof d === "string") : [],
    };
  } catch {
    return EMPTY;
  }
}

function write(next: PlanState): void {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage blocked (for example a private window): keep it for this visit only.
  }
  for (const l of listeners) l();
}

// Another tab on this phone changed the plan (for example, signed out there): read it again, so
// this tab does not write the old answers back.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY && e.key !== null) return;
    state = read();
    for (const l of listeners) l();
  });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
const getState = (): PlanState => state;

export const planStore = {
  get: getState,
  subscribe,
  saveProfile(profile: Profile) {
    write({ ...state, profile });
  },
  markDone(lessonId: string) {
    if (!state.done.includes(lessonId)) write({ ...state, done: [...state.done, lessonId] });
  },
  /** "Start over": forgets the answers and progress on this phone. */
  clear() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      // Nothing stored.
    }
    // Not write(): that would store the empty state again, and sign-out must leave nothing.
    state = EMPTY;
    for (const l of listeners) l();
  },
  /** Tests only: read again from storage. */
  reload() {
    state = read();
  },
};

export function usePlan(): PlanState {
  return useSyncExternalStore(subscribe, getState, getState);
}
