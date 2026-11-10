# Adding a lesson

This page is for a student who has never seen this repo. A lesson is one file. When you add the file, the lesson appears in the app. You do not change any code.

## Before you start

- Wording for caregivers comes only from the client's material and `docs/knowledge/content-style-guide.md`. Do not write medical advice yourself. If the client's material does not cover something, leave a plain gap such as "Placeholder step. The real step will come from the care team."
- Every new lesson starts as `placeholder`. The app then shows "Draft. Not yet reviewed by a clinician." on it.
- Use made-up sample data only. No real names or emails.

## Steps

1. Pick an id: lowercase letters, numbers and single dashes, like `crying-basics`.
2. Copy `content/lessons/first-lesson.md` to `content/lessons/<id>.md`. The file name must match the id.
3. Change the settings between the two `---` lines.
4. Write the lesson text under the second `---` line, in Markdown.
5. Run the check (below). Fix anything it reports.
6. Open a pull request. A second person reviews it.

## A full example

```
---
id: crying-basics
title: Crying basics
goal: Placeholder goal. The real goal will come from the care team.
status: placeholder
pathways:
  - crying
steps:
  - text: Placeholder step. The real step will come from the care team.
    image: /media/crying-step-1.jpg
    alt: A drawing of a caregiver holding a baby
videoUrl: /media/crying-basics.mp4
captionsUrl: /media/crying-basics.vtt
transcript: Placeholder transcript. The real words will come from the care team.
---

Placeholder text. The real lesson will come from the care team.

Fussing is normal at first.
```

What each setting means:

| Setting | Needed | Notes |
|---|---|---|
| `id` | yes | Same as the file name without `.md` |
| `title`, `goal` | yes | Plain words, 6th to 8th grade |
| `status` | yes | `placeholder` or `approved` |
| `approvedBy`, `approvedOn` | only if `approved` | See below |
| `steps` | no | Each has `text`. An `image` needs `alt` text |
| `videoUrl` | no | A video needs `captionsUrl` and `transcript` too |
| `pathways` | no | Lowercase tags |
| `checks` | no | Leave empty. Questions come in a later block |

Rules for files and links:

- `image`, `videoUrl` and `captionsUrl` are paths on our own server and start with one `/`. Web addresses for other sites are refused.
- Do not type HTML tags in the lesson text. Use Markdown only: `**bold**`, `*soft*`, `- list items`, `## heading`.
- Lessons show in the list in order of their id.

## Running the check

Runs in: a terminal, in the repo folder

```bash
pnpm install
pnpm test
```

The same test runs in CI on every pull request. To see just the content check: `pnpm --filter @tummy/shared test`.

## What the messages mean

The message starts with the setting that has the problem.

| Message starts with | What it means |
|---|---|
| `approvedBy: is required...` | Status is `approved` but no clinician name is written |
| `approvedOn: ...` | Status is `approved` but the date is missing, or not written like `YYYY-MM-DD` |
| `steps.0.alt: is required...` | The first step has an image with no description. Counting starts at 0 |
| `captionsUrl:` or `transcript: is required...` | There is a video without captions or without a transcript |
| `videoUrl:` or `steps.0.image: must be a path on our own server...` | The link goes to another site, or does not start with `/` |
| `body: raw HTML is not allowed` | Remove tags such as `<b>` from the text |
| `id: ... must match` | The id and the file name differ |
| `file: must start with a line of ---` | The settings block is missing or not closed |
| `file: ... not valid YAML` | A setting is written wrong. Check the spaces and the colons |
| Unrecognized key | A setting name is misspelled |

## Approving a lesson

Only a clinician can approve content. When the clinician has signed off:

1. Change `status` to `approved`.
2. Add `approvedBy: ` with the clinician's name and `approvedOn: ` with the date of the sign-off, written `YYYY-MM-DD`.

The build fails if `approved` has no name or no date. If the text of an approved lesson changes, set it back to `placeholder` until it is signed off again.

## The "When to call" card

It lives in `content/safety-card.json`. The emergency line there must stay exactly as it is. The app shows its own fixed copy of that line, and the check fails if the file's copy is changed. The `callToday` items follow the same `status`, `approvedBy` and `approvedOn` rules.
