---
name: pr-handoff
description: Write the pull/merge request description and a handoff note for the next session from the facts of the branch — commits, diff, angular-review verdict, review-fix log. Run it by name when a branch is ready to open or to hand over.
license: MIT
compatibility: Requires Node.js 18+ and git. Uses gh (GitHub) or glab (GitLab) only if the user asks to open the PR/MR.
disable-model-invocation: true
metadata:
  version: "1.0.0"
  author: PrincyExaltIT
  pairs-with: angular-review, review-fix
---

# PR handoff

Turn what happened on this branch into two documents, both in French:

- `.review/PR_BODY.md` — for the human reviewer of the PR/MR.
- `.review/HANDOFF.md` — for the next agent or session that picks up the work.

Paths below are relative to this skill's folder.

## Workflow

1. **Facts.** Run `node scripts/gather.mjs` (add `--base <ref>` if the user named one). Read its JSON: commits, files, review verdict, open/fixed/skipped findings, test scripts, remote kind (github/gitlab). Write only what these facts support.
2. **PR body.** Fill `assets/pr-template.md` into `.review/PR_BODY.md`. Lead with why, then behaviour changes, then the review outcome (initial verdict → state after fixes), then what still needs a human eye — every skipped finding with its reason belongs there.
3. **Handoff.** Fill `assets/handoff-template.md` into `.review/HANDOFF.md`. Reference `.review/REVIEW.md`, `.review/FIXES.md` and commit shas instead of copying them. End with the skills the next session should call, in order.
4. **Show** both files to the user.
5. **Open the PR/MR only if the user asks**, with the matching CLI:
   - GitHub: `gh pr create --base <base> --title "<title>" --body-file .review/PR_BODY.md`
   - GitLab: `glab mr create --target-branch <base> --title "<title>" --description "$(cat .review/PR_BODY.md)"`

## Guardrails

- Facts come from `gather.mjs`; anything you infer is labelled as such.
- Remove secrets, tokens and personal data from both documents.
- No push, no PR/MR creation without an explicit request.
