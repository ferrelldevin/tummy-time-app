/**
 * Text for the development-only style guide page. It lives in its own file so the production
 * build never includes it. Not caregiver text, so it is not scored for reading level.
 */
export const styleguideText = {
  title: "Style guide (development only)",
  intro: "Every base component and standard state, for checking by eye and by keyboard.",
  colors: "Colors",
  type: "Type scale",
  buttons: "Buttons and links",
  primary: "Primary button",
  secondary: "Secondary button",
  disabled: "Disabled button",
  linkExample: "A link to Home",
  field: "Text field",
  fieldLabel: "Example label",
  fieldHint: "Example hint text.",
  fieldErrorLabel: "Example label with an error",
  fieldError: "Example error message.",
  card: "Card",
  cardTitle: "Example card",
  cardBody: "Example card text.",
  alerts: "Alerts",
  alertInfo: "Example note.",
  alertSuccess: "Example done message.",
  alertError: "Example problem message.",
  spinner: "Spinner",
  states: "Standard states",
  dialog: "Dialog",
  openDialog: "Open dialog",
  dialogTitle: "Example dialog",
  dialogBody: "Example dialog text. Press Escape or the close button to leave.",
  skipLinkNote: "The skip link is the first stop when you press Tab on any page.",
} as const;
