import type { SafetyCard } from "@tummy/shared";
import { EMERGENCY_LINE } from "@tummy/shared";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { en } from "../strings/en";
import { axeViolations } from "../test/axe";
import { WhenToCall } from "./WhenToCall";

afterEach(cleanup);

const placeholderCard: SafetyCard = {
  emergencyLine: EMERGENCY_LINE,
  callToday: ["Sample item one.", "Sample item two."],
  status: "placeholder",
};
const approvedCard: SafetyCard = {
  ...placeholderCard,
  status: "approved",
  approvedBy: "Sample Clinician",
  approvedOn: "2000-01-01",
};

const show = (card: SafetyCard | null) =>
  render(
    <MemoryRouter>
      <WhenToCall card={card} />
    </MemoryRouter>,
  );

// The safety card keeps its own tests (CLAUDE.md, "Always").
describe("When to call: emergency line", () => {
  it("is exactly the fixed sentence", () => {
    expect(en.whenToCall.emergencyLine).toBe("Trouble breathing or turning blue: call 911.");
  });

  it("shows on a placeholder card", () => {
    show(placeholderCard);
    expect(screen.getByText("Trouble breathing or turning blue: call 911.")).toBeDefined();
  });

  it("shows on an approved card", () => {
    show(approvedCard);
    expect(screen.getByText("Trouble breathing or turning blue: call 911.")).toBeDefined();
  });

  it("still shows when the content file could not be read", () => {
    show(null);
    expect(screen.getByText("Trouble breathing or turning blue: call 911.")).toBeDefined();
    expect(screen.getByText(en.whenToCall.problem, { exact: false })).toBeDefined();
  });

  it("shows the fixed text even if a card carries different words", () => {
    show({ ...placeholderCard, emergencyLine: "Call later." } as unknown as SafetyCard);
    expect(screen.getByText("Trouble breathing or turning blue: call 911.")).toBeDefined();
    expect(screen.queryByText("Call later.")).toBeNull();
  });

  it("appears before the call today items", () => {
    show(placeholderCard);
    const line = screen.getByText(EMERGENCY_LINE);
    const item = screen.getByText("Sample item one.");
    expect(line.compareDocumentPosition(item) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("When to call: card", () => {
  it("shows the draft banner for a placeholder card", () => {
    show(placeholderCard);
    expect(screen.getByText(en.draftLabel, { exact: false })).toBeDefined();
  });

  it("hides the draft banner once approved", () => {
    show(approvedCard);
    expect(screen.queryByText(en.draftLabel, { exact: false })).toBeNull();
  });

  it("lists the call today items, the care team line and the not-advice note", () => {
    show(placeholderCard);
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual(
      placeholderCard.callToday,
    );
    expect(screen.getByText("Talk to your baby's care team.")).toBeDefined();
    expect(
      screen.getByText("This app does not replace advice from your baby's care team."),
    ).toBeDefined();
  });

  it.each([
    ["placeholder", placeholderCard],
    ["approved", approvedCard],
    ["unreadable", null],
  ] as const)("has no axe violations (%s)", async (_name, card) => {
    const { container } = show(card);
    expect(await axeViolations(container)).toEqual([]);
  });
});
