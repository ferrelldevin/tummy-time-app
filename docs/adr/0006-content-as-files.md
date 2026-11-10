# 0006: Content as files

Status: Proposed (Nov 10, 2026).

## Context
The client supplies scripts, images and videos, some not yet made. Every medical word needs a clinician's sign-off. Students should not edit code to fix a sentence.

## Decision
- Each lesson, and the "when to call" safety card, is a file in `content/` that follows a schema in `packages/shared`.
- Every item carries `status` (`placeholder` or `approved`), `approvedBy` and `approvedOn`.
- The build fails if an item is `approved` without a name and date, if an image has no alt text, or if a video has no captions and transcript.
- The app shows "Draft. Not yet reviewed by a clinician." on every placeholder item.
- Changing an approved item's text resets it to `placeholder`.

## Options not taken
- **Content in the database with an admin screen.** Useful later. For now it is a second app to build and secure.
- **Content typed into components.** Every wording change would need a programmer and could not be reviewed as a document.

## Consequences
- Content changes go through pull requests, so each has an author, a reviewer and a history.
- The client cannot edit content herself yet. Someone on the team moves her material into files.

## Reopen if
- The client needs to edit content directly and often.
