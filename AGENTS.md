# AGENTS.md

<!-- Template from PrincyExaltIT/skill-issue. Keep it short: it is loaded in every session.
     Only what is always true in this repo. Procedures live in skills. -->

## Stack

- Angular 22 (standalone, zoneless, OnPush by default), TypeScript 6, Vitest via `ng test`.
- Node.js 24.15+.

## Commands

- `npm start` — dev server on http://localhost:4200
- `npm test -- --watch=false` — unit tests
- `npm run build` — production build (strict templates)

## Conventions

- Signals for state (`signal`, `computed`, `linkedSignal`); `input()` / `output()` / `model()`; `inject()`.
- Native control flow (`@if`, `@for` with `track item.id`), `host: {}` metadata, `NgOptimizedImage` for images.
- Feature folders (`src/app/<feature>/`), 2025 file naming (`talk-card.ts` holds `class TalkCard`).
- French for user-facing text; English for code.

## Skills in this repo

- `angular-review` — review a branch / PR / MR. Writes `.review/REVIEW.md` and `.review/findings.json`.
- `review-fix` — fix the findings of that report, one at a time.
- `pr-handoff` — PR/MR description and handoff note (run it by name).
- `skill-smith` — create or improve a skill.

Project-specific review rules live in `.agents/skills/angular-review/references/PROJECT_COMPLIANCE_REVIEW.md` and override the generic rules.

## Boundaries

- `.review/` is generated: never commit it.
- Ask before adding a dependency, changing CI, or pushing.
