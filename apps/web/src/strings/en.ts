import { EMERGENCY_LINE } from "@tummy/shared";

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
    // Fixed text. The screen shows this constant, never the copy in the content file.
    emergencyLine: EMERGENCY_LINE,
    // GAP: the list heading is a stand-in. The real "when to call" wording, and the items under
    // it (content/safety-card.json), must come from the client's clinicians. Nothing medical is
    // written here on purpose.
    callTodayHeading: "Call today",
    // Sentences below come word for word from docs/knowledge/content-style-guide.md.
    notAdvice: "This app does not replace advice from your baby's care team.",
    getHelp: "Talk to your baby's care team.",
    problem: "We could not show the full card.",
  },
  lessons: {
    title: "Lessons",
    backToList: "All lessons",
    goal: "Goal",
    steps: "Steps",
    video: "Video",
    transcript: "Transcript",
    // From the style guide: every lesson ends with where to get help.
    getHelp: "Talk to your baby's care team.",
    problem: "We could not show this lesson.",
    emptyTitle: "No lessons yet",
    emptyBody: "When there is a lesson, it will appear here.",
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
    errorBody: "Please try again.",
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
