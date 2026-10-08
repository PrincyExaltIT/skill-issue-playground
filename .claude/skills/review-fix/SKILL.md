---
name: review-fix
description: Fix the findings of an angular-review report one at a time — smallest safe change, a check after each, status recorded in .review/findings.json and a log in .review/FIXES.md. Use when the user asks to fix, address or apply review findings, to "corriger la review", or to clear the blockers before merge.
license: MIT
compatibility: Requires Node.js 18+ and git. Reads the findings.json contract written by the angular-review skill.
metadata:
  version: "1.0.0"
  author: PrincyExaltIT
  pairs-with: angular-review, pr-handoff
---

# Review fix

The review is done; now the code changes. Input is `.review/findings.json`, written by the `angular-review` skill. Each finding in scope ends **fixed** or **skipped with a reason** — never silently ignored.

Paths below are relative to this skill's folder.

## Workflow

### 1. Load

Run `node scripts/fixes.mjs status`. No `findings.json` → ask the user to run `angular-review` first, and stop.

### 2. Agree on scope

Default scope: BLOCKER and MAJOR. Include MINOR and INFO only when the user asks for them (`--max-severity MINOR` or `INFO` below).

### 3. Fix, one finding at a time

Repeat until `node scripts/fixes.mjs next` answers « Rien à corriger dans ce périmètre » :

1. `node scripts/fixes.mjs next` prints the next finding: file, line, quoted code, proposed fix.
2. Re-read the code. If it moved, find it by its quoted snippet. If it is already gone, `skip` it with the reason « déjà corrigé ».
3. Apply the **smallest** change that resolves it. When the finding names an official migration (`ng generate @angular/core:control-flow`, `…:signal-input-migration`, `…:inject`), prefer running it on the touched file.
4. Check: build or type-check the project (`npx ng build`, or the project's `build` script) and run the spec closest to the change. A red check means the fix is not done.
5. Record it: `node scripts/fixes.mjs done F-003 --note "<what changed, in French>"`, or `node scripts/fixes.mjs skip F-007 --reason "<why>"` when a safe fix needs a decision from the user.

### 4. Re-scan

If the `angular-review` skill is installed next to this one, run its scanner on the same diff (`node ../angular-review/scripts/scan.mjs`) and confirm the lines you touched raise no new candidate.

### 5. Report

Run `node scripts/fixes.mjs log` (writes `.review/FIXES.md`) and show it. Then offer, without doing them: one commit per finding or a single commit (the user chooses), and the `pr-handoff` skill to write the PR/MR description.

## Guardrails

- One finding per change, so each one can be reverted alone.
- A fix keeps the tests meaningful: no deleted test, no disabled lint rule, no `any` cast to silence the compiler.
- A BLOCKER you cannot fix safely is skipped with its reason and named in your final message.
- Stay inside the lines the finding is about; unrelated clean-ups belong to another change.
- No commit and no push until the user says so.
