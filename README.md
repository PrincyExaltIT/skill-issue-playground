# Conf Planner

Le terrain d'entraînement de la formation **« Skill Issue : construis ton skill de code review »**.

> **Tu suis la formation ? Pars de la branche `depart`**, puis relis la PR de `lab/speaker-spotlight`. La branche `main`, celle-ci, contient le **package de Princy** déjà installé : c'est le bonus final, à ouvrir après avoir construit ton propre skill.

La formation, le skill de référence étape par étape, le corrigé et le package vivent dans le dépôt compagnon [`PrincyExaltIT/skill-issue`](https://github.com/PrincyExaltIT/skill-issue).

## Les branches

| Branche | Rôle | Quand |
|---|---|---|
| `depart` | Le point de départ : l'application, ses conventions (`AGENTS.md`), aucun skill | Module 1 |
| `lab/speaker-spotlight` | La pull request à relire, écrite dans l'urgence, avec des défauts à trouver | Modules 1 et 2 |
| `equipe/main` | Après le module 2 : le skill `revue-angular` commité pour toute l'équipe, avec sa CI | Bonus cloud |
| `equipe/speaker-spotlight` | La même PR, relue en CI par le skill de l'équipe | Bonus cloud |
| `main` | Le package de Princy installé, avec sa CI | Bonus package |
| `feat/speaker-spotlight` | La même PR, relue par le package (PR #1) | Bonus package |
| `solution/review-fix` | 21 corrections faites par la chaîne du package (PR #2) | Bonus package |

## Ce que `main` contient en plus de l'application

Le package est installé comme le ferait une équipe :

- `.agents/skills/` (Codex, Copilot, Cursor, Gemini CLI / Antigravity, OpenCode, Kilo Code) et `.claude/skills/` (Claude Code, Continue) : `angular-review`, `review-fix`, `pr-handoff`, `skill-smith` ;
- `AGENTS.md` et `CLAUDE.md`, qui présentent ces skills à tous les outils ;
- la CI : `.github/workflows/angular-review.yml` (scan sans IA, porte, review IA si le secret `ANTHROPIC_API_KEY` existe) et `.gitlab-ci.yml`.

Lancer le package sur la PR :

```bash
git checkout feat/speaker-spotlight
```

- **Claude Code** : `/angular-review`
- **Codex** : `$angular-review`
- **autre harness** : « fais une revue de cette branche avec le skill angular-review »

Le rapport arrive dans `.review/REVIEW.md`, et `.review/findings.json` alimente `review-fix`, `pr-handoff` et la CI. Pour la seule étape mécanique, sans IA :

```bash
node .agents/skills/angular-review/scripts/scan.mjs --base main --format text
```

## L'application

Conf Planner affiche le programme d'une conférence tech fictive (données dans `public/data`) : programme filtrable par texte et par track, favoris persistés dans le navigateur, page de détail d'un talk et de son speaker.

Prérequis : **Node.js 24.15 ou plus** (exigé par Angular 22) et npm.

```bash
npm install
npm start                    # http://localhost:4200
npm test -- --watch=false    # tests unitaires
npm run build                # build de production
```
