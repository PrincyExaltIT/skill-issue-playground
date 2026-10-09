# Conf Planner

Le terrain d'entraînement de la formation **« Skill Issue : construis ton skill de code review »**.

Tu vas écrire ton propre skill de review Angular, le lancer sur une vraie pull request et mesurer ce qu'il trouve, ce qu'il rate et ce qu'il signale à tort. Puis tu le partageras à toute l'équipe en le commitant dans le dépôt.

La formation, le skill de référence étape par étape, le corrigé et le package prêt à l'emploi vivent dans le dépôt compagnon [`PrincyExaltIT/skill-issue`](https://github.com/PrincyExaltIT/skill-issue).

## Les branches

| Branche | Rôle | Quand |
|---|---|---|
| `depart` | Le point de départ : l'application, ses conventions (`AGENTS.md`), aucun skill | Module 1 |
| `lab/speaker-spotlight` | La pull request à relire, écrite dans l'urgence, avec des défauts à trouver | Modules 1 et 2 |
| `equipe/main` | Après le module 2 : le skill `revue-angular` commité pour toute l'équipe, avec sa CI | Bonus cloud |
| `equipe/speaker-spotlight` | La même PR, relue en CI par le skill de l'équipe | Bonus cloud |
| `main` | Le package de Princy installé, avec sa CI | Bonus package |
| `feat/speaker-spotlight` | La même PR, relue par le package | Bonus package |
| `solution/review-fix` | 21 corrections faites par la chaîne du package | Bonus package |

## Démarrer

Prérequis : **Node.js 24.15 ou plus** (exigé par Angular 22), git, et au moins un harness compatible Agent Skills (Claude Code, Codex, Copilot, Cursor, Gemini CLI / Antigravity, OpenCode, Kilo Code, Continue).

```bash
git clone https://github.com/PrincyExaltIT/skill-issue-playground.git
git clone https://github.com/PrincyExaltIT/skill-issue.git        # à côté : corrigé, score, rattrapage
cd skill-issue-playground
git checkout lab/speaker-spotlight
npm install
```

Ton skill se crée dans `.claude/skills/revue-angular/` (Claude Code, Continue) ou `.agents/skills/revue-angular/` (tous les autres). Il reste non suivi pendant que tu le construis : il te suit d'une branche à l'autre.

## Mesurer ta review

Le corrigé de la PR est dans le dépôt compagnon, hors de portée de l'agent qui relit :

```bash
node ../skill-issue/evals/angular-review/score.mjs --report .review/REVIEW.md
```

Une seule contrainte pour être mesuré : ta review cite chaque problème sous la forme `chemin/du/fichier.ts:ligne`.

## Rattraper une étape

```bash
node ../skill-issue/course/rattrapage.mjs 2                   # le skill de référence de l'étape 2, dans .claude/skills/
node ../skill-issue/course/rattrapage.mjs 2 --harness codex   # dans .agents/skills/ (Codex, Copilot, Cursor…)
```

## L'application

Conf Planner affiche le programme d'une conférence tech fictive (données dans `public/data`) : programme filtrable par texte et par track, favoris persistés dans le navigateur, page de détail d'un talk et de son speaker.

| Ce que `depart` illustre | Où regarder |
|---|---|
| Composants standalone, OnPush par défaut (v22), zoneless, control flow `@if` / `@for` | `src/app/talks/` |
| `input()`, `input.required()`, `output()`, `computed()`, métadonnées `host` | `talk-card.ts`, `talk-list.ts` |
| `httpResource()` et le token `API_BASE_URL` (pas d'URL en dur) | `talks.store.ts`, `core/api-base-url.ts` |
| Signal privé exposé en lecture seule, mises à jour immuables, `effect()` limité à un effet de bord | `favorites/favorites.store.ts` |
| Routes chargées à la demande (`loadComponent`) et `withComponentInputBinding()` | `app.routes.ts`, `talk-detail.ts` |
| Accessibilité : labels, `aria-pressed`, `ariaCurrentWhenActive`, focus après navigation | `talk-list.html`, `app.html`, `app.ts` |
| Tests Vitest qui testent un comportement (`setInput`, `HttpTestingController`) | `*.spec.ts` |

```bash
npm start                    # http://localhost:4200
npm test -- --watch=false    # tests unitaires
npm run build                # build de production
```
