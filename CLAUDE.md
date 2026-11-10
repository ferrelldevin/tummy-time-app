# Instructions for AI assistants and builders in this repo

Read this file, then the block card you were given in `docs/build-plan.md`. Those two, plus the standards gates in the plan, are everything you need. Nothing else should steer you.

## The project
- Tummy Time: the client's learning app for caregivers of babies born early (safe tummy time, coaching through crying, when to call the care team). Built by Dr. Gupta's Hands-On Lab at ODU.
- Users: parents and family at home first, tired, on a phone. Plain words, 6th to 8th grade reading level. Professionals second.
- Mobile-first PWA with sign-in, a database and sync across phones. Proposed stack is in `docs/adr/0001-stack.md`.

## How to work
1. Follow the block card's steps in order. Do not widen the task.
2. Stop at the first "stop and ask" trigger on the card, or when the card is silent or wrong. Say what you found. Do not guess.
3. Two failed attempts at the same step: stop and escalate to a more capable model or to Devin. Do not try a third time.
4. Root cause first. Never patch a symptom.
5. Explain what a change does and why before the code. Show each change as old -> new.
6. The writer of a change never reviews it. Devin approves every merge to `main`.
7. Every block ends with a chapter in `docs/walkthrough/` written for a CS student: what was built, why, each step in order, how to build it yourself, how to run it.

## Never allowed
- Skipping, deleting or weakening a test to get a green build.
- Turning off a lint or type rule without a written reason in the code and the PR.
- Secrets, real names, real emails or real participant data in the repo, logs, test data or AI chats. Made-up sample data only.
- A new stored field that is not in `docs/data-map.md`. Change the map first, with Devin's OK.
- Medical wording shown without the placeholder label or a recorded clinician sign-off. If the style guide does not already contain the wording, leave a marked gap.
- Third-party trackers, analytics, ad scripts, or fonts and scripts loaded from outside our own server.
- Writing your own cryptography.
- Any data collection for a study before the IRB rules. Consent and survey flags stay off.
- Dates or time frames in anything meant for the client.

## Always
- Accessibility: WCAG 2.2 AA. Run axe on every screen change. Tap targets at least 44 px. All screen text in the string catalog.
- The "when to call" card and the corrected-age math keep their own tests.
- Every data query filters by the signed-in account.
- Every PR: what changed, why, how it was checked, and credit for any library, asset or source (also added to `CREDITS.md`).
- Caregiver-facing words follow `docs/knowledge/content-style-guide.md`.
- A decision that changes the architecture gets a new record in `docs/adr/`.

## Where things are
- Plan and block cards: `docs/build-plan.md`
- Decisions: `docs/adr/`
- Data allowed: `docs/data-map.md`
- Risks and controls: `docs/threat-model.md`
- Style guide, definition of done, glossary: `docs/knowledge/`. The project brief, decisions log, open questions and stakeholder list are internal and are kept outside this repo.
- Student walkthrough: `docs/walkthrough/`
