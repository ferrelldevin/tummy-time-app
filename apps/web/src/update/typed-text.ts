/**
 * Knows whether a form field on screen holds text the person typed, for the update rule
 * (can-update.ts). A field counts once the person has typed in it, and stops counting when it
 * is empty again or leaves the screen. A value the app filled in itself (for example today's
 * date in Add a time) does not count. Nothing is stored: only references to fields on the page.
 */
type Field = HTMLInputElement | HTMLTextAreaElement;

const NOT_TEXT = new Set(["checkbox", "radio", "button", "submit", "reset", "hidden", "file"]);
const typedIn = new Set<Field>();
let listening = false;

function onInput(event: Event) {
  const target = event.target;
  if (target instanceof HTMLTextAreaElement) {
    typedIn.add(target);
  } else if (target instanceof HTMLInputElement && !NOT_TEXT.has(target.type)) {
    typedIn.add(target);
  }
}

/** Starts listening. Call once, early (main.tsx). Safe to call again. */
export function watchTypedText(doc: Document = document): void {
  if (listening) return;
  listening = true;
  doc.addEventListener("input", onInput, true);
}

export function hasTypedText(): boolean {
  for (const field of typedIn) {
    if (!field.isConnected) {
      typedIn.delete(field);
    } else if (field.value !== "") {
      return true;
    }
  }
  return false;
}

/** For tests: forget every field and stop listening. */
export function resetTypedText(doc: Document = document): void {
  doc.removeEventListener("input", onInput, true);
  typedIn.clear();
  listening = false;
}
