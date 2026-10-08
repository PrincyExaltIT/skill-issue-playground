---
name: skill-smith
description: Create or improve an Agent Skill the team can share — interview, scaffold, description that triggers, workflow with completion criteria, scripts for the exact parts, references for the branches, evals, validation against the open standard, install for every harness. Use when asked to create, write, refactor, review or port a skill, a SKILL.md, or to turn a repeated prompt or procedure into a skill.
license: MIT
compatibility: Requires Node.js 18+.
metadata:
  version: "1.0.0"
  author: PrincyExaltIT
---

# Skill smith

Turn a procedure the team repeats into a skill folder that any harness can load. Paths below are relative to this skill's folder.

## Workflow

### 1. Interview

Ask, then wait for the answers (skip what the user already said):

1. Which task does it do, start to finish? What goes in, what comes out (files, report, code change)?
2. Three or four sentences a colleague would type when they need it — and two that look close but must **not** trigger it.
3. Which parts must be exact every time (paths, numbers, formats, verdicts)? Those become scripts.
4. Should the agent start it on its own, or only a human by name?

Done when you can write the one-sentence job and list the trigger cases.

### 2. Scaffold

Run `node scripts/new-skill.mjs <name> --dir <skills folder> --with scripts,references` (add `--manual` for a human-only skill). The name is kebab-case and matches the folder.

### 3. Description

Write it last, think it first. Follow `references/descriptions.md`: what it does, then one trigger per real situation, in the team's words. Keep it under ~600 characters when you can: it is loaded in every session.

### 4. Body

Write the workflow as numbered steps; end each step with a **Done when** condition the agent can check. Keep `SKILL.md` under 500 lines — anything only some runs need moves to `references/` behind a one-line pointer saying when to read it. Read `references/anatomy.md` for what belongs where.

### 5. Scripts

Move every exact, repeated or verifiable operation into `scripts/` (Node with zero dependencies, or the stack's own tooling). Scripts print JSON on stdout and explanations on stderr; the agent runs them and reads only their output.

### 6. Evals

Next to the skill — never inside it — add `evals/<name>/triggers.json` (should and should-not prompts) and at least one fixture with its expected output. Re-run them on every change.

### 7. Validate and install

Run `node scripts/validate.mjs <skill folder>` until it reports no error. Then install it where each harness looks (`references/portability.md`), or with the kit's installer: `node kit/install.mjs --target <repo>`.

## Guardrails

- The portable core (`name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools`) works everywhere; harness-specific fields are optional extras the skill must survive without.
- Human documentation lives outside the skill folder; the folder holds only what the agent uses.
- A third-party skill is code: read its scripts before installing it.
