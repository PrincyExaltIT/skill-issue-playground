# Conf Planner

Application de démonstration de la formation **« Skill Issue »** (Agent Skills et code review Angular).

Ce dépôt est la **cible du skill `angular-review`** :

- la branche `main` est une petite application Angular 22 idiomatique, celle qu'une review exigeante doit laisser passer ;
- la branche `feat/speaker-spotlight` est une pull request écrite dans l'urgence, avec des défauts à trouver. C'est le terrain du lab.

Le skill, ses références de règles, son scanner et ses évaluations vivent dans le dépôt compagnon [`PrincyExaltIT/skill-issue`](https://github.com/PrincyExaltIT/skill-issue).

Le kit est **déjà installé** dans ce dépôt, comme le ferait une équipe : `.agents/skills/` (Codex, Copilot, Cursor, Gemini/Antigravity, OpenCode, Kilo Code) et `.claude/skills/` (Claude Code, Continue), avec `AGENTS.md`, le workflow GitHub `.github/workflows/angular-review.yml` et le job GitLab `.gitlab-ci.yml`.

Branches :

| Branche | Rôle |
|---|---|
| `main` | l'application saine |
| `feat/speaker-spotlight` | la PR à relire pendant le lab (PR #1) |
| `solution/review-fix` | **à ouvrir après le lab** : 21 corrections faites par le skill `review-fix` à partir d'une review Codex, un commit par finding |

## L'application

Conf Planner affiche le programme d'une conférence tech fictive (données dans `public/data`) :

- programme filtrable par texte (sans tenir compte des accents) et par track ;
- favoris persistés dans le navigateur, avec un compteur dans l'en-tête et une page « Mes favoris » ;
- page de détail d'un talk et de son speaker.

Ce que `main` illustre :

| Sujet | Où regarder |
|---|---|
| Composants standalone, OnPush par défaut (v22), zoneless, control flow `@if` / `@for` | `src/app/talks/` |
| `input()`, `input.required()`, `output()`, `computed()`, métadonnées `host` | `talk-card.ts`, `talk-list.ts` |
| `httpResource()` et `InjectionToken` `API_BASE_URL` (pas d'URL en dur) | `talks.store.ts`, `core/api-base-url.ts` |
| Signal privé exposé en lecture seule, mises à jour immuables, `effect()` limité à un effet de bord | `favorites/favorites.store.ts` |
| Routes lazy (`loadComponent`) et `withComponentInputBinding()` | `app.routes.ts`, `talk-detail.ts` |
| Accessibilité : labels, `aria-pressed`, `ariaCurrentWhenActive`, focus après navigation | `talk-list.html`, `app.html`, `app.ts` |
| Tests Vitest qui testent un comportement (`setInput`, `HttpTestingController`) | `*.spec.ts` |

## Démarrer

Prérequis : **Node.js >= 24.15** (exigé par Angular 22) et npm.

```bash
npm install
npm start                    # http://localhost:4200
npm test                     # Vitest en mode watch
npm test -- --watch=false    # une seule exécution (CI)
npm run build                # build de production dans dist/
```

## Le lab

1. Placez-vous sur la pull request à reviewer :

   ```bash
   git checkout feat/speaker-spotlight
   ```

   Elle ajoute une page « speaker spotlight » (`/speakers/:id`) et un formulaire de proposition de talk (`/proposals`). Elle compile, mais elle n'est pas prête à merger.

2. Lancez le skill `angular-review` sur la branche (base : `main`) :

   - **Claude Code** : `/angular-review`
   - **Codex** : `$angular-review`
   - **autre harness compatible Agent Skills** : « review this branch with the angular-review skill »

3. Lisez le rapport : `.review/REVIEW.md` (plus `.review/findings.json` pour les outils). Le dossier `.review/` est ignoré par git.

4. Confrontez le rapport au code : chaque finding cite une ligne. Qu'est-ce que l'agent a trouvé, raté, ou signalé à tort ?

Pour voir uniquement l'étape mécanique (sans LLM) :

```bash
node .agents/skills/angular-review/scripts/scan.mjs --base main --format text
```

Le scanner ne fait que proposer des candidats, sur les lignes modifiées. Tout ce qui demande du jugement (contexte, intention, conséquence réelle) revient aux reviewers du skill : comparez les deux sorties.
