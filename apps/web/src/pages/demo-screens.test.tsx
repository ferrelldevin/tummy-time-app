import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { planStore } from "../plan/store";
import { en } from "../strings/en";
import { stubApi } from "../test/api-stub";
import { axeViolations } from "../test/axe";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  planStore.clear();
  stubApi({ signedIn: false });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function answerAll() {
  renderAt("/getting-started");
  await screen.findByRole("heading", { level: 1, name: en.start.title });
  fireEvent.click(screen.getByLabelText(en.start.age.choices["2-4m"]));
  fireEvent.click(screen.getByRole("button", { name: en.start.next }));
  fireEvent.click(screen.getByLabelText(en.start.born.choices["28-33"]));
  fireEvent.click(screen.getByRole("button", { name: en.start.next }));
  fireEvent.click(screen.getByLabelText(en.start.topics.choices.equipment));
  fireEvent.click(screen.getByRole("button", { name: en.start.next }));
  fireEvent.click(screen.getByLabelText(en.start.going.choices.crying));
  fireEvent.click(screen.getByRole("button", { name: en.start.finish }));
}

describe("Getting started", () => {
  it("asks for an answer before going on, and says so", async () => {
    renderAt("/getting-started");
    await screen.findByRole("heading", { level: 1, name: en.start.title });
    fireEvent.click(screen.getByRole("button", { name: en.start.next }));
    expect(screen.getByRole("alert").textContent).toBe(en.start.pickOne);
    expect(screen.getByText(en.start.age.question)).toBeDefined();
  });

  it("saves only ranges and topics, then shows the plan with the matching lessons", async () => {
    await answerAll();
    expect(await screen.findByRole("heading", { level: 1, name: en.plan.title })).toBeDefined();
    expect(planStore.get().profile).toEqual({
      age: "2-4m",
      born: "28-33",
      topics: ["equipment"],
      going: "crying",
    });
    // The crying lesson is moved up; the equipment lesson is in; corrected age is shown.
    const titles = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(titles[1]).toContain("When your baby fusses");
    expect(titles.some((t) => t.includes("oxygen"))).toBe(true);
    expect(screen.getByText("About 0 to 2 months")).toBeDefined();
  });

  it("has no axe violations on a question or on the plan", async () => {
    const first = renderAt("/getting-started");
    await screen.findByRole("heading", { level: 1, name: en.start.title });
    expect(await axeViolations(first.container)).toEqual([]);
    cleanup();
    await answerAll();
    await screen.findByRole("heading", { level: 1, name: en.plan.title });
    expect(await axeViolations(document.body)).toEqual([]);
  });
});

describe("a lesson", () => {
  it("shows the video slot, a care-team gap, a quick check with feedback, and Mark as done", async () => {
    renderAt("/lessons/first-tries");
    await screen.findByRole("heading", { level: 1, name: "Short and often" });
    expect(screen.getByRole("heading", { name: en.lessons.videoSoon })).toBeDefined();
    expect(screen.getAllByText(`${en.lessons.careTeamNote}:`).length).toBe(1);
    fireEvent.click(screen.getByLabelText("One long try, once a day"));
    expect(screen.getByText(en.lessons.checkNotQuite)).toBeDefined();
    fireEvent.click(screen.getByLabelText("Short tries, a few times a day"));
    expect(screen.getByText(en.lessons.checkRight)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: en.lessons.markDone }));
    expect(screen.getByText(en.lessons.markedDone)).toBeDefined();
    expect(planStore.get().done).toEqual(["first-tries"]);
  });

  it("has no axe violations", async () => {
    const { container } = renderAt("/lessons/safe-setup");
    await screen.findByRole("heading", { level: 1, name: "Set up a safe spot" });
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe("Baby crying? coach", () => {
  it("goes breathe, one idea, then says it is OK to stop", async () => {
    vi.useFakeTimers();
    renderAt("/baby-crying");
    expect(
      screen.getByRole("heading", { level: 2, name: en.babyCrying.breatheTitle }),
    ).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: en.babyCrying.breatheStart }));
    for (let i = 0; i < 7; i += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(4000);
      });
    }
    fireEvent.click(screen.getByRole("button", { name: en.babyCrying.breatheDone }));
    fireEvent.click(screen.getByRole("button", { name: en.babyCrying.ideas[1] }));
    fireEvent.click(screen.getByRole("button", { name: en.babyCrying.stillCrying }));
    expect(screen.getByRole("heading", { level: 2, name: en.babyCrying.stopTitle })).toBeDefined();
    expect(screen.getByRole("link", { name: en.babyCrying.callLink })).toBeDefined();
  });

  it("has no axe violations", async () => {
    const { container } = renderAt("/baby-crying");
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe("About", () => {
  it("clears answers and progress on this phone", async () => {
    planStore.saveProfile({ age: "0-1m", born: "on-time", topics: [], going: "some" });
    renderAt("/about");
    fireEvent.click(screen.getByRole("button", { name: en.about.startOver }));
    expect(planStore.get().profile).toBeNull();
    expect(await screen.findByText(en.about.startOverDone, { exact: false })).toBeDefined();
  });
});
