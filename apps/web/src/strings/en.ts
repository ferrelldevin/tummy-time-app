import { EMERGENCY_LINE } from "@tummy/shared";

/** The language of the strings below, for dates and times shown with them. */
export const locale = "en-US";

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
    // GAP: a short safety reminder belongs on this screen (the style guide says lessons lead
    // with "baby awake, always watched, on a firm, flat surface"). The exact words for this
    // screen must come from the client's clinicians. Nothing medical is written here on purpose.
    start: "Start",
    stop: "Stop and save",
    // Shown above the running time. The time itself is in words for screen readers.
    timeLabel: "Time so far",
    started: "The timer is running.",
    // {time} is a length such as "5 minutes". "Every minute counts." is from the style guide.
    saved: "Saved {time} of tummy time. Every minute counts.",
    tooShort: "That was too short to save.",
    tooLong: "That was more than 2 hours, so we did not save it. You can add the time yourself.",
    addInstead: "Add a time yourself",
    seeLog: "See your log",
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
    start: "Start tummy time",
    add: "Add a time",
    // The three sync states, word for word from the build plan.
    sync: {
      local: "Saved on this phone",
      saved: "Saved",
      unreachable: "Can't reach the server. We'll try again.",
    },
    emptyTitle: "No tummy time yet",
    emptyBody: "When you log tummy time, it will show here.",
    today: "Today",
    yesterday: "Yesterday",
    // Screen reader text after "Delete", so each button says which time it deletes.
    // {time} is a time of day, {length} a length such as "5 minutes".
    entry: "{time}, {length}",
    delete: "Delete",
    deleted: "Deleted {entry}.",
    undo: "Undo",
    putBack: "Put back {entry}.",
    notSaved: "This time could not be saved.",
    savedFlash: "Saved. Every minute counts.",
    // Lengths. {n} is a number of 2 or more.
    minuteOne: "1 minute",
    minutesMany: "{n} minutes",
    secondOne: "1 second",
    secondsMany: "{n} seconds",
  },
  addTime: {
    title: "Add a time",
    intro: "Add a tummy time you did not time with the app.",
    dayLabel: "Day",
    timeLabel: "Start time",
    minutesLabel: "Minutes",
    minutesHint: "A whole number from 1 to 120.",
    submit: "Save",
    errors: {
      dayMissing: "Pick the day.",
      timeMissing: "Pick the start time.",
      minutesMissing: "Type how many minutes.",
      minutesShape: "Minutes must be a whole number from 1 to 120.",
      future: "That time has not happened yet. Pick a time that has passed.",
      tooOld: "That day is more than a year ago. Pick a day in the last year.",
    },
  },
  account: {
    headerSignIn: "Sign in",
    headerAccount: "Account",
    welcome: {
      title: "Welcome",
      intro: "Sign in to keep a log of tummy time. Your log can be on more than one phone.",
      open: "You do not need to sign in to read lessons or When to call.",
      createAccount: "Create account",
      signIn: "Sign in",
    },
    create: {
      title: "Create account",
      intro: "Choose a 6-digit PIN. We will give you a family code. You need both to sign in.",
      // Word for word from docs/knowledge/content-style-guide.md, "Not medical advice".
      notAdvice: "This app does not replace advice from your baby's care team.",
      pinLabel: "PIN",
      pinHint: "6 numbers. Pick one that is hard to guess.",
      confirmLabel: "Type the PIN again",
      submit: "Create account",
      submitting: "Creating your account...",
      haveAccount: "Already have a family code?",
      signInInstead: "Sign in",
    },
    familyCode: {
      title: "Your family code",
      lead: "This is your family code:",
      saveIt: "Write it down or take a screenshot now. You will only see it this one time.",
      why: "You need this code and your PIN to sign in on another phone.",
      shared: "Anyone with your code and PIN can see and change your log.",
      noRecovery:
        "We cannot get this code back for you yet. If you lose it, you cannot get back into this account.",
      done: "I saved my code",
      spelledOut: "Family code, one letter or number at a time:",
    },
    signIn: {
      title: "Sign in",
      intro: "Use your family code and your PIN.",
      codeLabel: "Family code",
      codeHint: "12 letters and numbers. Spaces and dashes are fine.",
      pinLabel: "PIN",
      pinHint: "6 numbers.",
      submit: "Sign in",
      submitting: "Signing in...",
      noAccount: "New here?",
      createInstead: "Create account",
    },
    signedOut: {
      title: "Signed out",
      thisPhone: "You are signed out on this phone.",
      everywhere: "You are signed out on all phones.",
      deleted: "Your account is deleted.",
      plain: "You are signed out.",
      signIn: "Sign in",
      home: "Go to Home",
    },
    manage: {
      title: "Your account",
      signedIn: "You are signed in.",
      onePhone: "Signed in on 1 phone.",
      // {n} is replaced with a number of 2 or more.
      manyPhones: "Signed in on {n} phones.",
      signOut: "Sign out on this phone",
      signOutEverywhere: "Sign out on all phones",
      everywhereHint: "Use this if a phone is lost or someone should no longer see your log.",
      deleteTitle: "Delete account",
      deleteWarning: "This deletes your account and your log for good. It cannot be undone.",
      deletePinLabel: "Your PIN",
      deletePinHint: "Type your PIN to say this is really you.",
      deleteSubmit: "Delete my account",
      working: "Please wait...",
      // {n} is a number of 1 or more.
      unsentOne: "1 tummy time is only on this phone. We could not save it yet.",
      unsentMany: "{n} tummy times are only on this phone. We could not save them yet.",
      unsentLossOne: "If you sign out now, it will be lost.",
      unsentLossMany: "If you sign out now, they will be lost.",
      stay: "Stay signed in",
      signOutAnyway: "Sign out anyway",
    },
    pin: {
      show: "Show PIN",
    },
    errors: {
      summary: "Please fix this:",
      codeMissing: "Type your family code.",
      codeShape: "A family code has 12 letters and numbers.",
      pinMissing: "Type a 6-digit PIN.",
      pinShape: "A PIN is exactly 6 numbers.",
      pinMismatch: "The two PINs are not the same.",
      weakPin: "That PIN is too easy to guess. Please pick another one.",
      signInFailed: "That family code and PIN do not match. Please check them and try again.",
      wrongPin: "That PIN is not right. Please try again.",
      locked: "Too many wrong tries. Please wait a little while, then try again.",
      rateLimited: "Too many tries from this network. Please wait a little while, then try again.",
      signedOutAlready: "You are not signed in on this phone anymore.",
      network: "We could not reach the server. Please check your connection and try again.",
      unexpected: "Something went wrong. Please try again.",
    },
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
