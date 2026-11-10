import type { Lesson } from "@tummy/shared";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { en } from "../strings/en";
import { axeViolations } from "../test/axe";
import { LessonView } from "./LessonView";
import { Lessons } from "./Lessons";

afterEach(cleanup);

const base: Lesson = {
  id: "sample",
  title: "Sample lesson",
  goal: "A sample goal.",
  body: "Sample body text.",
  steps: [{ text: "Sample step one." }, { text: "Sample step two." }],
  pathways: [],
  status: "placeholder",
};
const approved: Lesson = {
  ...base,
  status: "approved",
  approvedBy: "Sample Clinician",
  approvedOn: "2000-01-01",
};

const wrap = (node: React.ReactNode) => render(<MemoryRouter>{node}</MemoryRouter>);

describe("Lessons list", () => {
  it("links each lesson by its title", () => {
    wrap(<Lessons lessons={[base, { ...approved, id: "other", title: "Other lesson" }]} />);
    expect(screen.getByRole("link", { name: "Sample lesson" }).getAttribute("href")).toBe(
      "/lessons/sample",
    );
    expect(screen.getByRole("link", { name: "Other lesson" }).getAttribute("href")).toBe(
      "/lessons/other",
    );
  });

  it("marks only the drafts", () => {
    wrap(<Lessons lessons={[base, { ...approved, id: "other", title: "Other lesson" }]} />);
    expect(screen.getAllByText(en.draftLabel)).toHaveLength(1);
  });

  it("shows an empty state with no lessons", () => {
    wrap(<Lessons lessons={[]} />);
    expect(screen.getByText(en.lessons.emptyBody)).toBeDefined();
  });

  it("has no axe violations", async () => {
    const { container } = wrap(<Lessons lessons={[base, approved]} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe("Lesson screen", () => {
  it("shows the draft banner for a placeholder lesson and not for an approved one", () => {
    wrap(<LessonView lesson={base} />);
    expect(screen.getByText(en.draftLabel, { exact: false })).toBeDefined();
    cleanup();
    wrap(<LessonView lesson={approved} />);
    expect(screen.queryByText(en.draftLabel, { exact: false })).toBeNull();
  });

  it("shows the goal, body, steps and ends with where to get help", () => {
    const { container } = wrap(<LessonView lesson={base} />);
    expect(screen.getByText("A sample goal.")).toBeDefined();
    expect(screen.getByText("Sample body text.")).toBeDefined();
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "Sample step one.",
      "Sample step two.",
    ]);
    const help = screen.getByText("Talk to your baby's care team.");
    const last = container.querySelector(".stack")?.lastElementChild;
    expect(last).not.toBeNull();
    expect(help.compareDocumentPosition(screen.getByText(en.lessons.backToList))).toBeTruthy();
    expect(screen.getByRole("link", { name: en.nav.whenToCall }).getAttribute("href")).toBe(
      "/when-to-call",
    );
  });

  it("shows a step image with its alt text", () => {
    wrap(
      <LessonView
        lesson={{ ...base, steps: [{ text: "Step", image: "/media/a.jpg", alt: "A drawing" }] }}
      />,
    );
    const img = screen.getByRole("img", { name: "A drawing" });
    expect(img.getAttribute("src")).toBe("/media/a.jpg");
  });

  it("shows a video with a captions track and a transcript", () => {
    const { container } = wrap(
      <LessonView
        lesson={{
          ...base,
          videoUrl: "/media/v.mp4",
          captionsUrl: "/media/v.vtt",
          transcript: "Words spoken in the video.",
        }}
      />,
    );
    expect(container.querySelector("video")?.getAttribute("src")).toBe("/media/v.mp4");
    expect(container.querySelector("video track")?.getAttribute("src")).toBe("/media/v.vtt");
    expect(screen.getByText("Words spoken in the video.")).toBeDefined();
  });

  it("does not turn hostile lesson text into markup", () => {
    const { container } = wrap(
      <LessonView lesson={{ ...base, body: "<script>x</script><img src=x onerror=alert(1)>" }} />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
  });

  it("has no axe violations", async () => {
    const { container } = wrap(
      <LessonView
        lesson={{
          ...base,
          steps: [{ text: "Step", image: "/media/a.jpg", alt: "A drawing" }],
          videoUrl: "/media/v.mp4",
          captionsUrl: "/media/v.vtt",
          transcript: "Words.",
        }}
      />,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
