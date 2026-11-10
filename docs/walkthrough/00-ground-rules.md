# Block 0: Ground rules and records

Written Nov 10, 2026. Read time: about 15 minutes.

## 1. What was built

No app code. Block 0 produced the documents the code will be built on:

| File | What it is |
|---|---|
| `README.md` | The front door: what the project is and where to look |
| `CLAUDE.md` | The rules any AI assistant (or person) must follow when working in this repo |
| `docs/build-plan.md` | The whole plan: 17 blocks, each with steps and checks |
| `docs/adr/` | Seven decision records: stack, repo layout, sign-in, sessions, sync, content, hosting |
| `docs/data-map.md` | The complete list of data the app is allowed to store |
| `docs/threat-model.md` | What could go wrong, and the control that stops each thing |
| `docs/knowledge/` | The content style guide, the definition of done and the glossary |
| `docs/walkthrough/` | This guide |
| `SECURITY.md`, `CREDITS.md` | How to report a problem; who and what gets credit |
| `.github/pull_request_template.md` | The checklist every pull request fills in |
| `.gitignore` | Files Git must never save, such as secrets in `.env` |

## 2. Why start with documents instead of code

Think of a building site. Before anyone pours concrete, someone draws the plans, checks the ground, and decides where the exits go. Moving an exit on paper costs nothing. Moving it after the walls are up costs a lot.

Software is the same. Three documents here do that job:

**The decision records (ADRs).** Each one captures a choice that would be expensive to reverse, such as which database. It lists the options that were turned down and why. A year from now, a student who wonders "why not Firebase?" finds the answer in two minutes instead of re-arguing it.

**The data map.** The safest data is data you never collect. The map lists every field the app may store and why. Starting in Block 3, a test compares the real database against this page and fails if they differ. So the document is not just a promise; it is enforced.

**The threat model.** This is a structured way of asking "what could go wrong?" before building. We walk through each place data moves (phone to server, server to database) and ask six questions, known as STRIDE:

| Letter | Question | Example here |
|---|---|---|
| S, Spoofing | Can someone pretend to be someone else? | Guessing a family's PIN |
| T, Tampering | Can someone change data they should not? | Editing a lesson's medical text |
| R, Repudiation | Can someone deny doing something? | "I never deleted that account" |
| I, Information disclosure | Can someone see data they should not? | One family reading another's log |
| D, Denial of service | Can someone make it stop working? | Flooding the sign-in page |
| E, Elevation of privilege | Can someone gain powers they should not have? | A normal user acting as an admin |

Each risk gets a control and the block where that control is built. That is how security ends up designed in from the start instead of added at the end.

**Why `CLAUDE.md`?** Much of the routine code will be written by AI models following the plan. Those models read `CLAUDE.md` first. It tells them what they must never do (skip a test, store an unlisted field, write medical advice) and when to stop and ask. It works as a job description that is read every single time.

## 3. The steps, in the order they were done

1. **Devin created an empty private repo** on GitHub named `tummy-time`.
2. **The repo was cloned** into a cloud workspace. It had no commits yet.
3. **The CS Systems Group website was read** for hosting facts. Findings: the department database service is MySQL; there is a research server named `handson-web.cs.odu.edu`; personal web hosting cannot run this kind of app. These went into ADR 0001 and 0007.
4. **A first commit went straight to `main`** holding only `README.md` and `.gitignore`. A pull request needs something to compare against, and an empty repo has nothing.
5. **A branch was made** named `block-0-ground-rules`. All other files were added there.
6. **The build plan was exported** from its living document into `docs/build-plan.md`, so the repo stands on its own.
7. **Three knowledge files were copied** into `docs/knowledge/`: the style guide, the definition of done and the glossary. The project brief, decisions log, open questions and stakeholder list stay outside the repo, because they hold budget details and notes about people. Before anything goes into a repo, ask: would this be fine if the repo were public?
8. **`CLAUDE.md` was written** from the lab's template plus the plan's "never allowed" list.
9. **Seven ADRs were written,** all marked Proposed, because Dr. Gupta has not yet approved the stack.
10. **The data map was written,** listing four database tables and what is deliberately not stored.
11. **The threat model was written:** 28 risks, each with a control and a block.
12. **This guide was written.**
13. **The branch was pushed and a draft pull request opened** for Devin to review.

## 4. How you would build this yourself

### a. Create the repo
On github.com, click **New repository**. Name it, choose **Private**, and create it without a README (we add our own).

### b. Clone it and make the first commit
Runs in: Git Bash
```bash
git clone https://github.com/YOUR-USERNAME/YOUR-REPO.git
cd YOUR-REPO
echo "# My project" > README.md
git add README.md
git commit -m "Add README"
git push -u origin main
```

- `git add` chooses which changes go into the next commit.
- `git commit -m "..."` saves them with a message.
- `git push -u origin main` uploads the commit. `origin` is Git's name for the copy on GitHub. `-u` remembers that link so later you can type just `git push`.

### c. Do the real work on a branch
Runs in: Git Bash
```bash
git checkout -b block-0-ground-rules
```

`checkout -b` creates a branch and switches to it. From here, commits do not touch `main` until a pull request is approved.

### d. Write an ADR
Create `docs/adr/0001-something.md` with five headings: **Context** (the situation and constraints), **Decision** (what you chose), **Options not taken** (and why not), **Consequences** (what gets easier and harder), **Reopen if** (what would make you revisit it). Keep it to one page. The discipline is in "Options not taken": if you cannot name a real alternative, you have not made a decision yet.

### e. Write a data map
List every table and field you plan to store. For each one, write why you need it. If you cannot write a reason, delete the field. Add a section for what you refuse to store.

### f. Write a threat model
Draw how data moves through your system, even as plain text boxes and arrows. At each arrow, ask the six STRIDE questions. For each real risk, write the control. Then check: is every control assigned to a piece of work? A control nobody is assigned to build does not exist.

### g. Push and open a pull request
Runs in: Git Bash
```bash
git add .
git commit -m "Add Block 0 ground rules and records"
git push -u origin block-0-ground-rules
```

Then on github.com, GitHub shows a **Compare & pull request** button. Click it, describe what changed and why, and create it as a **Draft** until it is ready for review.

### h. Protect the main branch
On github.com: **Settings**, then **Branches**, then **Add branch ruleset** (or "Add rule"). Target `main`. Turn on:

- Require a pull request before merging
- Require approvals: 1
- Require status checks to pass (you can pick the checks after Block 1 adds them)
- Block force pushes

This makes the rules in `CLAUDE.md` physically hard to break, for people and for AI. Note: on a private repo with a free personal GitHub account, GitHub may not enforce these rules. If the option is missing or shows a warning, tell Devin; moving the repo to a lab organization, or a paid GitHub plan, are the two fixes.

## 5. Open it and follow along

1. Clone and open the repo using the three commands in this folder's [README](README.md).
2. Open `README.md` at the top level. Follow its "Start here" table.
3. Read `docs/adr/0003-sign-in-seam.md`. Notice how "Options not taken" explains why there is no email or password yet.
4. Open `docs/data-map.md` beside `docs/threat-model.md`. Pick risk 3 in the threat model (database leak) and find the two fields in the data map that its control refers to (`code_lookup`, `pin_hash`). This is how the documents connect.
5. Open `docs/build-plan.md` and find "Block 3". Its step 1 lists the same tables as the data map. Plan, map and threat model describe one design from three angles.
6. See the history:

Runs in: Git Bash, inside the repo folder
```bash
git log --oneline
```

Each line is one commit. Read them from the bottom up to see the order things were added.

## Check yourself

- Why does a 6-digit PIN not make the account weak? (Threat model, risks 1 and 2.)
- Which document would you change first if the client asks to store a baby's nickname? (The data map, before any code.)
- What happens if a lesson file says `approved` but names no clinician? (ADR 0006.)

## What is still open after Block 0

- Dr. Gupta's OK on the stack, and whether the lab server offers PostgreSQL or only MySQL.
- Branch protection on `main` (step h above) has to be switched on by the repo owner.
- The current version numbers of the security standards, to be confirmed before code cites them.

Written with AI assistance and reviewed by Devin Ferrell.
