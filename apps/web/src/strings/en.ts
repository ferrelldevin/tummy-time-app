/** All text shown on screen lives here, so it can be reviewed and translated in one place. */
export const en = {
  appName: "Tummy Time",
  server: {
    checking: "Checking the server...",
    reachable: "Server is reachable",
    unreachable: "Can't reach the server",
  },
  nav: {
    label: "Main",
    home: "Home",
    lessons: "Lessons",
    log: "Log",
    whenToCall: "When to call",
  },
  skipLink: "Skip to main content",
  // Shown on every placeholder screen until a clinician signs off on the real content.
  draftLabel: "Draft. Not yet reviewed by a clinician.",
  home: {
    title: "Tummy Time",
    intro: "Pick what you need right now.",
    startTummyTime: "Start tummy time",
    babyCrying: "Baby crying? Try this",
  },
  startTummyTime: {
    title: "Start tummy time",
    placeholder: "This screen is a placeholder. The real steps will go here.",
  },
  babyCrying: {
    title: "Baby crying? Try this",
    placeholder: "This screen is a placeholder. The real tips will go here.",
  },
  whenToCall: {
    title: "When to call",
    placeholder: "This screen is a placeholder. The real guidance will go here.",
    // GAP: the "when to call" wording must come from the client's clinicians.
    // Nothing medical is written here on purpose.
  },
  lessons: {
    title: "Lessons",
    placeholder: "This screen is a placeholder. Lessons will go here.",
  },
  log: {
    title: "Log",
    placeholder: "This screen is a placeholder. Your log will go here.",
  },
  notFound: {
    title: "Page not found",
    body: "We could not find that page.",
    backHome: "Go to Home",
  },
  states: {
    loading: "Loading...",
    emptyTitle: "Nothing here yet",
    emptyBody: "When there is something to show, it will appear here.",
    errorTitle: "Something went wrong",
    errorBody: "Your information is safe. Please try again.",
    tryAgain: "Try again",
    offlineTitle: "You are offline",
    offlineBody: "You can keep using what is already on your phone.",
  },
  alert: {
    info: "Note",
    success: "Done",
    error: "Problem",
  },
  field: {
    errorPrefix: "Problem:",
    required: "(required)",
  },
  dialog: {
    close: "Close",
  },
} as const;
