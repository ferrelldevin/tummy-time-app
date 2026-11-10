import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hasTypedText, resetTypedText, watchTypedText } from "./typed-text";

function field(type = "text", value = ""): HTMLInputElement {
  const input = document.createElement("input");
  input.type = type;
  input.value = value;
  document.body.append(input);
  return input;
}

function type(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

beforeEach(() => {
  watchTypedText();
});
afterEach(() => {
  resetTypedText();
  document.body.replaceChildren();
});

describe("typed text, for the update rule", () => {
  it("nothing typed: no", () => {
    field();
    expect(hasTypedText()).toBe(false);
  });

  it("a value the app filled in itself does not count", () => {
    field("date", "2026-11-10");
    expect(hasTypedText()).toBe(false);
  });

  it("text typed in a field, a PIN field or a text area counts", () => {
    const text = field();
    type(text, "AB");
    expect(hasTypedText()).toBe(true);
    type(text, "");
    expect(hasTypedText()).toBe(false);

    type(field("password"), "1");
    expect(hasTypedText()).toBe(true);
    resetTypedText();
    watchTypedText();

    const area = document.createElement("textarea");
    document.body.append(area);
    type(area, "x");
    expect(hasTypedText()).toBe(true);
  });

  it("stops counting when the field leaves the screen (saved, or another screen)", () => {
    const text = field();
    type(text, "12");
    text.remove();
    expect(hasTypedText()).toBe(false);
  });

  it("ticking a box is not typing", () => {
    const box = field("checkbox");
    box.checked = true;
    box.dispatchEvent(new Event("input", { bubbles: true }));
    expect(hasTypedText()).toBe(false);
  });
});
