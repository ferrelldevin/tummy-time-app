import { afterEach, describe, expect, it, vi } from "vitest";
import type { UpdateSafety } from "./can-update";
import { CHECK_EVERY_MS, createUpdater, SAVE_WAIT_MS, type Updater } from "./updater";

/**
 * The updater against a hand-made stand-in for the browser's service worker objects, so each
 * step of a worker's life (found, installed and waiting, taking charge) happens when the test
 * says. The real thing runs in e2e/update.spec.ts.
 */

class FakeWorker extends EventTarget {
  state: ServiceWorkerState = "installing";
  readonly messages: unknown[] = [];
  constructor(private readonly onMessage: (w: FakeWorker, m: unknown) => void = () => undefined) {
    super();
  }
  postMessage(message: unknown) {
    this.messages.push(message);
    this.onMessage(this, message);
  }
  becomes(state: ServiceWorkerState) {
    this.state = state;
    this.dispatchEvent(new Event("statechange"));
  }
}

class FakeRegistration extends EventTarget {
  installing: FakeWorker | null = null;
  waiting: FakeWorker | null = null;
  active: FakeWorker | null = null;
  updates = 0;
  update() {
    this.updates += 1;
    return Promise.resolve(this);
  }
}

class FakeContainer extends EventTarget {
  controller: FakeWorker | null;
  registered: { url: string; options: RegistrationOptions }[] = [];
  constructor(
    readonly registration: FakeRegistration,
    controller: FakeWorker | null,
  ) {
    super();
    this.controller = controller;
  }
  register(url: string, options: RegistrationOptions) {
    this.registered.push({ url, options });
    return Promise.resolve(this.registration);
  }
  /** The worker took charge (after skipWaiting, here or in another tab). */
  takeCharge(worker: FakeWorker) {
    this.registration.waiting = null;
    this.registration.active = worker;
    worker.state = "activated";
    this.controller = worker;
    this.dispatchEvent(new Event("controllerchange"));
  }
}

const calm: UpdateSafety = {
  timerRunning: false,
  saving: false,
  unsent: 0,
  canSend: true,
  typedText: false,
};

let made: Updater[] = [];
afterEach(() => {
  for (const u of made) u.stop();
  made = [];
});

function setup(
  options: {
    controlled?: boolean;
    waitingAtStart?: boolean;
    online?: boolean;
    safety?: Partial<UpdateSafety>;
  } = {},
) {
  const registration = new FakeRegistration();
  const current = new FakeWorker();
  current.state = "activated";
  registration.active = current;
  const container = new FakeContainer(registration, (options.controlled ?? true) ? current : null);
  // The worker answers SKIP_WAITING the way the generated sw.js does.
  const onMessage = (w: FakeWorker, m: unknown) => {
    if ((m as { type?: string }).type === "SKIP_WAITING") container.takeCharge(w);
  };
  if (options.waitingAtStart) {
    const next = new FakeWorker(onMessage);
    next.state = "installed";
    registration.waiting = next;
  }
  let safety: UpdateSafety = { ...calm, ...options.safety };
  let online = options.online ?? true;
  const reload = vi.fn();
  const win = new EventTarget();
  const doc: EventTarget & { visibilityState: DocumentVisibilityState } = Object.assign(
    new EventTarget(),
    { visibilityState: "visible" as const },
  );
  const timers: { fn: () => void; ms: number }[] = [];
  const repeats: { fn: () => void; ms: number }[] = [];
  const updater = createUpdater({
    container: container as unknown as ServiceWorkerContainer,
    safety: () => safety,
    reload,
    isOnline: () => online,
    win,
    doc,
    setTimer: (fn, ms) => {
      const t = { fn, ms };
      timers.push(t);
      return t;
    },
    clearTimer: (h) => {
      const i = timers.indexOf(h as { fn: () => void; ms: number });
      if (i >= 0) timers.splice(i, 1);
    },
    setRepeat: (fn, ms) => {
      const t = { fn, ms };
      repeats.push(t);
      return t;
    },
    clearRepeat: () => undefined,
  });
  made.push(updater);
  return {
    updater,
    registration,
    container,
    reload,
    win,
    doc,
    timers,
    repeats,
    setSafety(patch: Partial<UpdateSafety>) {
      safety = { ...safety, ...patch };
    },
    setOnline(v: boolean) {
      online = v;
    },
    /** A new version is found, downloads its files, and waits. */
    newVersionArrives(): FakeWorker {
      const next = new FakeWorker(onMessage);
      registration.installing = next;
      registration.dispatchEvent(new Event("updatefound"));
      registration.installing = null;
      registration.waiting = next;
      next.becomes("installed");
      return next;
    },
    comeToFront() {
      doc.visibilityState = "visible";
      doc.dispatchEvent(new Event("visibilitychange"));
    },
  };
}

describe("registering and looking for a new version", () => {
  it("registers /sw.js for the whole site, always fetching it fresh", async () => {
    const s = setup();
    await s.updater.start();
    expect(s.container.registered).toEqual([
      { url: "/sw.js", options: { scope: "/", updateViaCache: "none" } },
    ]);
  });

  it("looks when the app starts, comes back to the front, comes back online, and every hour", async () => {
    const s = setup();
    await s.updater.start();
    expect(s.registration.updates).toBe(1);
    s.comeToFront();
    expect(s.registration.updates).toBe(2);
    s.win.dispatchEvent(new Event("online"));
    expect(s.registration.updates).toBe(3);
    expect(s.repeats).toHaveLength(1);
    expect(s.repeats[0]?.ms).toBe(CHECK_EVERY_MS);
    s.repeats[0]?.fn();
    expect(s.registration.updates).toBe(4);
  });

  it("does not look while offline", async () => {
    const s = setup({ online: false });
    await s.updater.start();
    s.comeToFront();
    s.repeats[0]?.fn();
    expect(s.registration.updates).toBe(0);
  });

  it("does nothing when the browser will not register a worker", async () => {
    const s = setup();
    s.container.register = () => Promise.reject(new Error("blocked"));
    await s.updater.start();
    expect(s.updater.getView().ready).toBe(false);
    expect(s.repeats).toHaveLength(0);
  });
});

describe("a new version that arrives while the app is open", () => {
  it("shows the notice and does not reload by itself on the spot", async () => {
    const s = setup();
    await s.updater.start();
    const next = s.newVersionArrives();
    expect(s.updater.getView()).toEqual({ ready: true, heldByTimer: false, updating: false });
    expect(next.messages).toEqual([]);
    expect(s.reload).not.toHaveBeenCalled();
  });

  it("the very first install is not an update", async () => {
    const s = setup({ controlled: false });
    await s.updater.start();
    const first = new FakeWorker();
    s.registration.installing = first;
    s.registration.dispatchEvent(new Event("updatefound"));
    first.becomes("installed");
    expect(s.updater.getView().ready).toBe(false);
    // It takes charge of this page (clientsClaim): same files, no reload.
    s.container.takeCharge(first);
    expect(s.updater.getView().ready).toBe(false);
    expect(s.reload).not.toHaveBeenCalled();
  });

  it("Update now switches to it and reloads once it is in charge", async () => {
    const s = setup();
    await s.updater.start();
    const next = s.newVersionArrives();
    s.updater.updateNow();
    expect(next.messages).toEqual([{ type: "SKIP_WAITING" }]);
    expect(s.reload).toHaveBeenCalledTimes(1);
    expect(s.updater.getView().updating).toBe(true);
  });

  it("Update now never reloads under a running timer: it says to stop the timer first", async () => {
    const s = setup();
    await s.updater.start();
    const next = s.newVersionArrives();
    s.setSafety({ timerRunning: true });
    s.updater.updateNow();
    expect(next.messages).toEqual([]);
    expect(s.reload).not.toHaveBeenCalled();
    expect(s.updater.getView()).toEqual({ ready: true, heldByTimer: true, updating: false });
    // Stopped: the next press works.
    s.setSafety({ timerRunning: false });
    s.updater.updateNow();
    expect(s.reload).toHaveBeenCalledTimes(1);
  });

  it("Update now lets a save under way finish first", async () => {
    const s = setup({ safety: { saving: true } });
    await s.updater.start();
    const next = s.newVersionArrives();
    s.updater.updateNow();
    expect(next.messages).toEqual([]);
    expect(s.updater.getView().updating).toBe(true);
    expect(s.timers[0]?.ms).toBe(SAVE_WAIT_MS);
    s.timers.shift()?.fn();
    expect(next.messages).toEqual([]);
    s.setSafety({ saving: false });
    s.timers.shift()?.fn();
    expect(next.messages).toEqual([{ type: "SKIP_WAITING" }]);
    expect(s.reload).toHaveBeenCalledTimes(1);
  });

  it("Update now goes ahead over typed text and unsent changes: the person asked", async () => {
    const s = setup({ safety: { typedText: true, unsent: 2, canSend: true } });
    await s.updater.start();
    s.newVersionArrives();
    s.updater.updateNow();
    expect(s.reload).toHaveBeenCalledTimes(1);
  });

  it("checks once more right before reloading: a timer started in between wins", async () => {
    const s = setup();
    await s.updater.start();
    const next = s.newVersionArrives();
    // Hold the switch until the test lets it happen.
    let release: () => void = () => undefined;
    next.postMessage = (m: unknown) => {
      next.messages.push(m);
      release = () => {
        s.container.takeCharge(next);
      };
    };
    s.updater.updateNow();
    s.setSafety({ timerRunning: true });
    release();
    expect(s.reload).not.toHaveBeenCalled();
    expect(s.updater.getView()).toEqual({ ready: true, heldByTimer: true, updating: false });
    // The new worker is in charge now; the reload alone is left, for the next safe moment.
    s.setSafety({ timerRunning: false });
    s.updater.screenChanged();
    expect(s.reload).toHaveBeenCalledTimes(1);
  });
});

describe("applied by itself at a safe moment", () => {
  it("a version already waiting when the app starts is applied at once (a fresh start)", async () => {
    const s = setup({ waitingAtStart: true });
    await s.updater.start();
    expect(s.registration.active?.state).toBe("activated");
    expect(s.reload).toHaveBeenCalledTimes(1);
  });

  it("a fresh start with a timer cannot happen, but the rule still holds: no reload", async () => {
    const s = setup({ waitingAtStart: true, safety: { timerRunning: true } });
    await s.updater.start();
    expect(s.reload).not.toHaveBeenCalled();
    expect(s.updater.getView().ready).toBe(true);
  });

  it("moving to another screen applies it when nothing is going on", async () => {
    const s = setup();
    await s.updater.start();
    s.newVersionArrives();
    s.updater.screenChanged();
    expect(s.reload).toHaveBeenCalledTimes(1);
  });

  it("coming back to the front applies it when nothing is going on", async () => {
    const s = setup();
    await s.updater.start();
    s.newVersionArrives();
    s.comeToFront();
    expect(s.reload).toHaveBeenCalledTimes(1);
  });

  it.each<[string, Partial<UpdateSafety>]>([
    ["a running timer", { timerRunning: true }],
    ["a save under way", { saving: true }],
    ["typed text", { typedText: true }],
    ["changes that could be sent now", { unsent: 1, canSend: true }],
  ])("waits at every safe moment while there is %s", async (_name, patch) => {
    const s = setup({ waitingAtStart: true, safety: patch });
    await s.updater.start();
    s.newVersionArrives();
    s.updater.screenChanged();
    s.comeToFront();
    expect(s.reload).not.toHaveBeenCalled();
    expect(s.updater.getView().ready).toBe(true);
    // Once it is calm, the next moment applies it.
    s.setSafety(calm);
    s.updater.screenChanged();
    expect(s.reload).toHaveBeenCalledTimes(1);
  });

  it("does not wait for changes that cannot be sent anyway", async () => {
    const s = setup({ safety: { unsent: 2, canSend: false } });
    await s.updater.start();
    s.newVersionArrives();
    s.updater.screenChanged();
    expect(s.reload).toHaveBeenCalledTimes(1);
  });

  it("another tab switched: this one waits for its own safe moment", async () => {
    const s = setup({ safety: { timerRunning: true } });
    await s.updater.start();
    const next = s.newVersionArrives();
    s.container.takeCharge(next);
    expect(s.reload).not.toHaveBeenCalled();
    expect(s.updater.getView().ready).toBe(true);
    s.updater.screenChanged();
    expect(s.reload).not.toHaveBeenCalled();
    s.setSafety({ timerRunning: false });
    s.updater.screenChanged();
    expect(s.reload).toHaveBeenCalledTimes(1);
  });

  it("nothing waiting: a safe moment does nothing", async () => {
    const s = setup();
    await s.updater.start();
    s.updater.screenChanged();
    s.comeToFront();
    s.updater.updateNow();
    expect(s.reload).not.toHaveBeenCalled();
  });
});
