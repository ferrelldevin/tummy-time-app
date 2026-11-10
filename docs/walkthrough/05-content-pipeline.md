# Block 5: Content pipeline and first lesson

This chapter explains how lessons and the "When to call" card became plain files, and how the app refuses to show unsigned medical content as final. Read it with the code open. Section 5 tells you how to run it.

Blocks 3 and 4 (database and sign-in) are not built yet. Block 5 does not need them, so it was built first. The chapter numbers follow the block numbers, not the build order.

## 1. What was built

| Piece | Where | What it is |
|---|---|---|
| Content schemas | `packages/shared/src/content.ts` | The rules a lesson file and the safety card file must follow |
| Lesson file reader | `packages/shared/src/lesson-files.ts` | Reads one lesson file and builds the list of lessons |
| First lesson | `content/lessons/first-lesson.md` | One placeholder lesson |
| Safety card | `content/safety-card.json` | The placeholder "When to call" card |
| Content gate | `packages/shared/test/content-schema.test.ts` | Fails the build if any content file breaks a rule |
| Markdown renderer | `apps/web/src/components/Markdown.tsx` | Turns lesson text into screen elements, safely |
| Screens | `apps/web/src/pages/` | Lessons list, one lesson, and the real "When to call" screen |
| Guide | `docs/adding-a-lesson.md` | How to add a lesson, for someone new |

Everything is marked `placeholder`. The only caregiver sentences in the app are ones the style guide already contains. Lesson steps and "call today" items are neutral gap text, on purpose.

## 2. Why content is files, and why there is a gate

**Content as files.** The people who know what a lesson should say are clinicians, not programmers. If lesson text lives inside components, every wording change needs a programmer and risks breaking code. If a lesson is one text file, a student can turn the client's material into a file, and the diff in the pull request shows exactly which words changed. That record matters when a clinician signs off.

**The gate.** This app gives health information to tired parents of babies born early. The worst mistake it could make is to show a team member's draft as if a clinician approved it. A promise to "be careful" is not a control. So the rule is enforced by a machine:

- A file marked `approved` must carry the approver's name and the date. If not, the build fails.
- A file marked `placeholder` always shows the banner "Draft. Not yet reviewed by a clinician."

There is no third state, so there is no way to show content with neither a banner nor a recorded sign-off.

## 3. The steps, in the order they were done

1. **Wrote the schemas** with Zod, the same library Block 1 uses for the health check. A schema is a description of a valid object that can also check a real one.
2. **Added the cross-field rules.** `approved` needs `approvedBy` and `approvedOn`. An image needs `alt` text. A video needs captions and a transcript. Media paths must be on our own server.
3. **Wrote the placeholder lesson and safety card.**
4. **Replaced the Block 1 stand-in test with the real gate.** It reads every file in `content/` and checks it. This made the test stronger, which is allowed. Weakening a test is not.
5. **Built the Markdown renderer** and wrote 38 tests against hostile input.
6. **Built the screens**: Lessons list at `/lessons`, one lesson at `/lessons/:id`, and the safety card at `/when-to-call`.
7. **Gave the emergency line its own constant and its own test.**
8. **Wrote the guide** and the browser tests.
9. **Broke things on purpose** to prove the gate works.

### Decisions worth understanding

**Why the lesson file is Markdown with a settings block on top.** The lesson body is formatted text, and Markdown is the simplest way to write that. The settings (id, title, status) go between two `---` lines at the top, written in YAML. This layout is common, and you can read it in any text editor.

**Why the safety card is JSON and not YAML.** The card must open instantly from every screen, so it is part of the first download. Reading YAML in the browser needs a library of about 50 KB compressed. That would have left 1.3 KB of room under the 150 KB budget. JSON needs no library. The lesson screens load the YAML reader only when someone opens Lessons. This is a real trade-off made with a measurement, which is how such choices should be made.

**How the Markdown is made safe.** The risk: a content file contains `<script>` or a link like `javascript:...`, and it runs in a caregiver's browser. The usual approach is to turn Markdown into HTML and then clean the HTML. This app never makes HTML at all:

1. The `marked` library only splits the text into tokens: "this is a paragraph", "this is bold", "this is a link".
2. Our code turns each token type we know into a React element.
3. React always treats text as text, never as tags.

So raw HTML in a file shows up as visible characters. Images named in the body are never loaded. A link is kept only if it goes to a page in this app, or starts with `https:`, `mailto:` or `tel:`. The schema also refuses raw HTML in a lesson, so a file like that fails the build before it reaches the screen. Two layers, each tested.

**Why the emergency line cannot be edited away.** The line "Trouble breathing or turning blue: call 911." comes from the style guide. The screen shows a constant from the code, not the copy in the content file. The schema accepts only that exact sentence in the file. If the card file is ever broken, the screen still shows the line. Safety text should fail safe.

**How "a new lesson is one file" is true.** `apps/web/src/content/lessons.ts` uses `import.meta.glob`, a Vite feature that finds every file matching a pattern at build time. There is no list of lessons in the code to update. Three tests cover this: one for the index builder, one that the glob finds exactly the files in the folder, and a browser test that compares the screen to the folder.

### Proof the gate bites

| Break | Message |
|---|---|
| Set the lesson to `approved` with no name or date | `approvedBy: is required when status is "approved"` and the same for `approvedOn` |
| A step image with no description | `steps.0.alt: is required when a step has an image` |
| A video with no captions or transcript | `captionsUrl: is required when there is a video` and `transcript: is required...` |

The first was done on the real file and then undone. The other two use test fixtures.

### What the reviewer found

- One comment named the wrong file type. Fixed.
- The builder reported one failed browser-test run that it did not capture, followed by three passing runs. The reviewer ran the suite four more times with no failure. The likely cause is a test server from an earlier run still holding the port, but that is not proven. "It passed on retry" is not a root cause, so this is written down in the pull request as open. Retries are set to 0, so a repeat will show up rather than hide.

## 4. How you would build this yourself

### a. Write the schema first

```ts
const lesson = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(["placeholder", "approved"]),
  approvedBy: z.string().optional(),
  approvedOn: z.string().optional(),
});
```

### b. Add rules that span fields

Zod's `superRefine` lets you look at the whole object:

```ts
.superRefine((value, ctx) => {
  if (value.status === "approved" && !value.approvedBy) {
    ctx.addIssue({ code: "custom", path: ["approvedBy"], message: "is required when status is \"approved\"" });
  }
});
```

Write the message for the person who will read it. They may not be a programmer.

### c. Write a test that reads every real file

Loop over the content folder and parse each file. Now CI checks content the same way it checks code.

### d. Render text without making HTML

If you ever reach for `dangerouslySetInnerHTML`, stop and ask whether you can build elements instead. Then write tests with the nastiest input you can think of.

### e. Decide what must never break, and take it out of the editable path

Here that is the emergency line.

## 5. Open it and follow along

Runs in: a terminal, in the repo folder

```bash
git fetch origin
git checkout block-5-content-pipeline
pnpm install
pnpm dev
```

Then open `http://127.0.0.1:5173`.

1. Tap **Lessons**, then the first lesson. See the draft banner.
2. Tap **When to call**. See the emergency line and the draft banner.
3. **Add a lesson with no code change.** Copy `content/lessons/first-lesson.md` to `content/lessons/second-lesson.md`. Change `id` to `second-lesson` and change the title. Save. The list updates (refresh the page if it does not).
4. **Trip the gate.** In your new file, change `status: placeholder` to `status: approved`. Run:

   ```bash
   pnpm --filter @tummy/shared test
   ```

   Read the message. Then delete your test file.
5. **Try to attack it.** Put `<script>alert(1)</script>` in a lesson body and run the test again. The schema refuses it.

Run the full checks:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check:size
pnpm test:e2e
```

## Check yourself

1. What two things must a file have before it can be marked `approved`?
2. Why does the app never turn Markdown into an HTML string?
3. Why is the safety card JSON while lessons use YAML settings?
4. If someone deletes the emergency line from `content/safety-card.json`, what happens in CI, and what does the screen show?

## What is still open after Block 5

- **All content is placeholder.** Real lessons and the real "When to call" list come from the client's clinicians, in Blocks 12 and 14.
- **The heading "Call today" is a stand-in** that the style guide does not contain. It is marked as a gap in `en.ts`.
- **One rule is not enforced by code:** if someone changes the words of an approved item, it should go back to `placeholder`. Today a reviewer must catch that. A later block can enforce it by storing a fingerprint of the approved text.
- **No images or video exist yet**, so the media paths are tested with fixtures only.
- **A person must still do the screen reader pass** on the new screens, on real phones.
- **The one unexplained browser-test failure** described above.

Written with AI assistance and reviewed by Devin Ferrell.
