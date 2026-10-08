# Writing a description that triggers

The description is the only part of a skill the model sees before deciding to load it. It does two jobs:

1. **Say what the skill does** — one sentence, third person, concrete nouns (review, migrate, scaffold), the output it produces.
2. **List when to use it** — one trigger per real situation, in the words people actually type, including the team's language (FR/EN) and tool vocabulary (PR, MR, branch, diff).

## Patterns

| Weak | Strong |
|---|---|
| `Helps with Angular code quality.` | `Senior-level review of Angular changes — a branch, a PR/MR, staged files or a commit range — against Angular 17–22 practice […] Use when asked to review, audit or check Angular code, a pull or merge request before merge, or whether a change is good Angular.` |
| `A skill for PRs.` | `Write the pull/merge request description and a handoff note from the facts of the branch — commits, diff, review verdict, fixes log.` |
| `I can fix review comments.` | `Fix the findings of an angular-review report one at a time […] Use when the user asks to fix, address or apply review findings.` |

## Checklist

- Leading words first: the trigger vocabulary sits at the start, not after a preamble.
- One trigger per branch: synonyms of the same case add tokens, not reach.
- No identity the body already carries; no marketing.
- Test it: run each `should_trigger` and `should_not_trigger` prompt from `evals/<skill>/triggers.json` in a fresh session. A miss means a branch is missing; a false trigger means the wording is too broad.
- A human-only skill (`disable-model-invocation: true` in Claude Code) keeps a short human-facing description: no trigger list needed.
