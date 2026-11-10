import { useSyncExternalStore } from "react";

/**
 * Chrome (on Android, and on computers) offers to install a web app with an event,
 * "beforeinstallprompt", that the page may keep and use later. Safari never sends it, which is
 * why the Add to your home screen page has written steps for iPhone.
 *
 * We keep the event, and stop Chrome's own small install bar, so the only place that offers to
 * install is the Add to your home screen page, and only after the person opened it: no nagging
 * on any other screen. Nothing is stored.
 */

/** Chrome's event. Not in TypeScript's built-in types because it is not a web standard. */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let offer: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function set(next: BeforeInstallPromptEvent | null) {
  offer = next;
  for (const listener of listeners) listener();
}

function onOffer(event: Event) {
  event.preventDefault();
  set(event as BeforeInstallPromptEvent);
}

function onInstalled() {
  set(null);
}

/** Called once from main.tsx. The event can come early, before any screen asks for it. */
export function listenForInstall(win: Window = window): void {
  win.addEventListener("beforeinstallprompt", onOffer);
  win.addEventListener("appinstalled", onInstalled);
}

/** For tests: forget the offer and stop listening. */
export function resetInstall(win: Window = window): void {
  win.removeEventListener("beforeinstallprompt", onOffer);
  win.removeEventListener("appinstalled", onInstalled);
  set(null);
}

/** True while the browser has offered to install the app. */
export function useCanInstall(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => offer !== null,
    () => false,
  );
}

/** Shows the browser's own install question. The offer can be used once. */
export async function install(): Promise<void> {
  const current = offer;
  if (current === null) return;
  set(null);
  await current.prompt();
  await current.userChoice;
}
