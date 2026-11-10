# Walkthrough: how Tummy Time was built

A study guide for the project, written for a CS student. One chapter per build block. Each chapter answers the same five questions:

1. **What was built?** In plain words.
2. **Why this way?** The reasoning, and what the alternatives were.
3. **What were the steps, in order?** Every one, including the boring ones.
4. **How would I build it myself?** From nothing, with the commands.
5. **How do I open it and follow along?** What to click and run while reading.

## Chapters

| Block | Chapter | Status |
|---|---|---|
| 0 | [Ground rules and records](00-ground-rules.md) | Written |
| 1 | [Scaffold and quality pipeline](01-scaffold.md) | Written |
| 2 | [Design foundations and app shell](02-design-foundations.md) | Written |
| 3 | [Database and API spine](03-database-and-api-spine.md) | Written |
| 4 | [Sign-in and sessions](04-sign-in-and-sessions.md) | Written |
| 5 | [Content pipeline and first lesson](05-content-pipeline.md) | Written |
| 6 | Tummy time log and sync | Not started |
| 7 | Offline and install | Not started |
| 8 | Deploy, runbook and skeleton gate | Not started |

## Open the project on your own computer

You need Git ([git-scm.com](https://git-scm.com/downloads)) and an editor such as VS Code ([code.visualstudio.com](https://code.visualstudio.com/)).

Runs in: Git Bash (or PowerShell)
```bash
git clone https://github.com/ferrelldevin/tummy-time.git
cd tummy-time
code .
```

- `git clone` copies the whole repo, with its history, to your computer.
- `cd` moves into the folder.
- `code .` opens the folder in VS Code. The dot means "this folder".

In VS Code, open any `.md` file and press `Ctrl+Shift+V` to read it formatted instead of as raw text.

## Words used in every chapter

| Word | Meaning |
|---|---|
| Repo | The project folder plus its full history, tracked by Git |
| Commit | One saved step in that history, with a message saying what changed |
| Branch | A separate line of work, so unfinished changes do not disturb the main copy |
| `main` | The branch that holds the accepted version |
| Pull request (PR) | A request to merge a branch into `main`, where the change is reviewed first |
| CI | Continuous integration: checks that run automatically on every pull request |
| ADR | Architecture decision record: one page on one big decision and why |
| Block | One unit of the build plan, with its own steps and checks |

Written with AI assistance and reviewed by Devin Ferrell.
