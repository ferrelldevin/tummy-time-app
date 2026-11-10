// jsdom has no IndexedDB: fake-indexeddb puts an in-memory one in its place (IDBRequest and the
// rest too). Each test gets a new, empty one, so no test sees another's log entries.
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach } from "vitest";

beforeEach(() => {
  Object.assign(globalThis, { indexedDB: new IDBFactory() });
});

// jsdom does not implement the modal parts of <dialog>. This stand-in mimics the parts the
// tests need: showModal() opens it, close() closes it and fires "close", like a real browser.
// Real focus trapping and Escape are proved in a real browser by e2e/styleguide.spec.ts.
if (typeof HTMLDialogElement !== "undefined") {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (this.hasAttribute("open")) {
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    }
  };
}
