# Anatomy of a skill folder

```
my-skill/
├── SKILL.md            required — frontmatter (always loaded) + workflow (loaded on trigger)
├── scripts/            executed, never read: exact work, output only enters the context
├── references/         read on demand: rules, domain knowledge, long examples — one file per branch
├── assets/             used to produce output: templates, schemas, images — not instructions
└── agents/openai.yaml  optional Codex display metadata (other harnesses ignore it)
```

## Three loading levels

| Level | Content | Loaded | Budget |
|---|---|---|---|
| 1 | `name` + `description` | every session, for every installed skill | ~100–200 tokens |
| 2 | body of SKILL.md | when the description matches the request | aim < 5 000 tokens, < 500 lines |
| 3 | references/, assets/ | when a step points to them | unbounded, split by branch |
| exec | scripts/ | run by the agent; only stdout/stderr enter the context | free |

## What goes where

| You have… | Put it in… | Because… |
|---|---|---|
| A step every run takes | SKILL.md body | the agent needs it every time |
| Rules only some runs need | references/, one file per branch | inline material that only some branches reach dilutes the others |
| An operation that must be exact (paths, line numbers, verdict, formats) | scripts/ | prose invites variance; code does not |
| A template or schema of the output | assets/ | the agent fills it, it does not obey it |
| A fact that is always true in the repo | the repo's AGENTS.md, not the skill | it is not a procedure |
| Tests of the skill | evals/ next to the skill | they must never cost context |

## Writing the body

- Steps in order, each ending with **Done when …**: a condition the agent can check (a command's output, a file that exists).
- Prefer a strong concrete word to a long explanation (*refute* a finding, a *contract* file).
- State the target behaviour; keep prohibitions for real guardrails.
- One meaning in one place: a format defined twice will drift.
- Facts the environment already exposes (package.json scripts, config files) are looked up, not copied.
