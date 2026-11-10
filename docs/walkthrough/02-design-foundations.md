# Block 2: Design foundations and app shell

This chapter explains the frame every screen sits in: the colors and sizes, the reusable parts, the bottom bar, and the checks that keep all of it accessible. Read it with the code open. Section 5 tells you how to run it.

## 1. What was built

| Piece | Where | What it is |
|---|---|---|
| Design tokens | `apps/web/src/design/tokens.css` | One file of named values: colors, text sizes, spacing, corner radius, tap target size |
| Contrast test | `apps/web/src/design/tokens.test.ts` | Reads the token file and fails if any text and background pair is below 4.5:1 |
| Base components | `apps/web/src/components/` | Button, Link, TextField, Card, Dialog, Alert, SkipLink, Spinner |
| Standard states | `apps/web/src/components/StateViews.tsx` | Loading, empty, error with "Try again", and the offline notice |
| App shell | `AppShell.tsx`, `BottomBar.tsx`, `Page.tsx` | Header, main area, and a bottom bar with Home, Lessons, Log and "When to call" |
| Screens | `apps/web/src/pages/` | Home, five placeholder screens, a "Page not found" screen |
| Routing | `apps/web/src/App.tsx` | Which address shows which screen |
| String catalog | `apps/web/src/strings/en.ts` | Every word shown on screen, in one file |
| Reading-level test | `apps/web/src/strings/readability.test.ts` | Fails if caregiver text scores above 8th grade |
| Style guide page | `apps/web/src/pages/Styleguide.tsx` | Every component and state on one page. Development only |
| Browser tests | `apps/web/e2e/` | Playwright drives a phone-sized browser and runs axe on every screen |
| Leak and size checks | `scripts/check-no-styleguide.mjs`, `scripts/check-bundle-size.mjs` | Fail the build if the style guide ships, or if first-load script passes 150 KB compressed |

No screen has real content yet. Every placeholder shows the label "Draft. Not yet reviewed by a clinician." and nothing medical. The "When to call" wording is a marked gap in `en.ts`, on purpose. That wording must come from the client's clinicians.

## 2. Why build the frame before the screens

Think of a house. You pour the foundation and set the door widths before you pick furniture. If the doors are too narrow, fixing that later means tearing out walls.

Accessibility works the same way. If the Button component already has a 44 px tap target, a visible focus ring and enough contrast, then every screen that uses Button gets those for free. Nobody has to remember them. If instead each screen makes its own buttons, each one is a chance to get it wrong.

So this block makes the right thing the easy thing:

- **Tokens** mean a color is chosen once and tested once.
- **Components** mean a pattern (a labelled field with an error) is built once and tested once.
- **The string catalog** means all wording can be reviewed in one place, by a clinician or a translator, without reading code.
- **The checks** mean a mistake is caught by a machine in seconds, not by a tired parent at night.

## 3. The steps, in the order they were done

1. **Added two libraries.** `react-router` handles routing. `axe-core` was already present through the Playwright plugin; it was added directly so unit tests can use it too. Both are pinned to exact versions and listed in `CREDITS.md`.
2. **Wrote the tokens.** Every color is a 6-digit hex value so a test can read it. Sizes are in `rem`, which scales with the person's own font-size setting. Body text is `1rem`, which is 16 px by default.
3. **Wrote the contrast test before the components.** `contrast.ts` implements the WCAG contrast formula. The test parses `tokens.css` and checks each text pair at 4.5:1 and each border or focus color at 3:1.
4. **Built the components.** Each one has a test file that renders it, checks its behavior, and runs axe on it.
5. **Built the standard states.** Loading, empty, error and offline are each built one time so every later screen shows them the same way.
6. **Wrote the string catalog and the reading-level test.** Components take their words from `en.ts`. The test scores the text with the Flesch-Kincaid formula.
7. **Built the shell and the routes.** `AppShell` wraps every screen. `Page` sets the browser tab title and moves keyboard focus to the heading after each navigation.
8. **Built Home and the placeholders.** Home has the two primary actions: "Start tummy time" and "Baby crying? Try this".
9. **Built the style guide page**, loaded only in development.
10. **Wrote the browser tests** and wired the two build checks into `pnpm check:size`, which CI already runs.
11. **Broke things on purpose** to prove the checks work. See "Proof the checks bite" below.

### Decisions worth understanding

**Why a router library instead of writing one.** Routing looks simple and is not: back button, history, links that open in a new tab, unknown addresses. `react-router` is the common choice and the app is still at 98.6 KB compressed against a 150 KB budget.

**Why focus moves to the heading.** In a normal website, clicking a link loads a new page and a screen reader starts reading from the top. In a single-page app the page never reloads, so a screen reader says nothing. Moving focus to the new `h1` makes it announce the new screen. Focus is not moved on the very first load, because that would steal focus from the browser.

**Why "When to call" is a link styled like a button.** It takes you to another screen. Things that navigate are links; things that act are buttons. Screen readers announce them differently, and people rely on that.

**Why the Dialog uses the browser's own `<dialog>`.** Calling `showModal()` gives you, for free, the hard parts: the page behind becomes unreachable, Escape closes it, and Tab stays out of the page behind. Our code adds one thing: it remembers what opened the dialog and gives focus back when it closes.

**Why contrast is checked two ways.** Unit tests run in jsdom, a pretend browser with no real layout or colors, so axe cannot judge contrast there. That one rule is off in unit tests, with the reason written in `src/test/axe.ts`. Contrast is covered by the token test and by axe inside a real browser in Playwright.

**Why the style guide has its own CSS file.** The first build leaked style guide CSS into the production bundle, and the new leak check caught it. The fix was to move that CSS into a file imported only by the development-only page. This is a good example of a check paying for itself on day one.

**Why the reading-level test skips short labels.** The formula divides by the number of sentences and words. A two-word label like "Lessons" gives nonsense scores. The test scores the whole catalog together and each string of five words or more. The score is approximate; it is a guard rail, not a verdict.

### Proof the checks bite

Each of these was done, seen to fail, and then undone:

| Break | What failed |
|---|---|
| Made the muted text color lighter | `tokens.test.ts`: ratio 2.39, needs 4.5 |
| Removed the link between a field and its label | `TextField.test.tsx`: 6 tests |
| Wrote a long, hard sentence in the catalog | `readability.test.ts` |
| Style guide CSS in the production bundle (a real mistake, not staged) | `check-no-styleguide.mjs` |

### What the reviewer changed

One line. The error state said "Your information is safe. Please try again." The app cannot know that in every error, so the first sentence was removed. A promise the app cannot keep does not belong on screen.

## 4. How you would build this yourself

### a. Start with tokens, not screens

Make one CSS file with custom properties:

```css
:root {
  --color-text: #1c2b33;
  --color-bg: #fbf9f6;
  --tap-target: 2.75rem; /* 44 px */
}
```

Then use only `var(--color-text)` in other files. Never type a raw color anywhere else.

### b. Test the tokens

Write the contrast formula (it is about 15 lines; see `contrast.ts`), read your token file as text, and assert each pair. Now a bad color cannot be merged.

### c. Build one component fully before the next

For each component, in this order: write the test, write the component, run axe on it. Start with Button. Ask of each one:

- Can I reach it and use it with the keyboard alone?
- Can I see where focus is?
- Is it at least 44 by 44 px?
- Does it still make sense in black and white?

### d. Put the words in a catalog from the first string

Moving text out of components later is slow and dull. Starting with `en.ts` costs nothing.

### e. Add routing, then handle title and focus in one place

Make a `Page` component that every screen uses. Put the title and focus logic there once.

### f. Add browser tests last

Unit tests are fast and check one part. Browser tests are slower and check the parts together. Write a few that walk the path a real person takes.

## 5. Open it and follow along

Runs in: a terminal, in the repo folder

```bash
git fetch origin
git checkout block-2-design-foundations
pnpm install
pnpm dev
```

Then open `http://127.0.0.1:5173` in a browser.

Try these, in order:

1. **Phone size.** Open the browser's developer tools and pick a phone-sized screen. Narrow it to 320 px. Nothing should scroll sideways.
2. **Keyboard only.** Press Tab. The first stop is "Skip to main content". Keep pressing Tab and watch the focus ring. Press Enter on "When to call", then go back.
3. **Tab title.** Watch the browser tab's title change on each screen.
4. **Style guide.** Open `http://127.0.0.1:5173/styleguide`. Every component and state is there. Open the dialog, press Escape, and see focus return to the button that opened it.
5. **Offline notice.** In developer tools, set the network to "Offline". The notice appears.
6. **Bigger text.** In the browser settings, raise the default font size. The layout should grow with it.

Then run the checks yourself:

Runs in: the same terminal

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check:size
pnpm test:e2e
```

Now break something. Open `apps/web/src/design/tokens.css`, change `--color-text-muted` to `#9aa7ae`, and run `pnpm test`. Read the failure. Then put it back.

## Check yourself

1. Why is body text set in `rem` and not `px`?
2. A screen reader user taps "Lessons". What two things does `Page` do so they know the screen changed?
3. Why is the contrast rule turned off in unit tests, and what covers contrast instead?
4. Where would you add the wording for a new button, and why not in the component?

## What is still open after Block 2

- **A person must do the screen reader pass**: Home, then "When to call", then back, with VoiceOver on an iPhone and TalkBack on an Android phone. A machine cannot do this. Notes go in the pull request.
- **Real phones and true 200% browser zoom** have not been checked. The automated test uses a 320 px wide screen with doubled font size, which is close but not the same.
- **Home still shows a "Server is reachable" line** from Block 1. It is a developer check, not caregiver wording. It goes away when real data arrives in a later block.
- **Colors and type are our own first choice.** When the client's logo, colors or storyboard arrive, they replace the tokens and the contrast test runs again.
- **The Dialog is not used on any real screen yet**, so it is tested in the style guide only.

Written with AI assistance and reviewed by Devin Ferrell.
