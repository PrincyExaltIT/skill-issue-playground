# AGENTS.md

Conf Planner, application Angular 22 de démonstration. Ce fichier est chargé à chaque session : il ne contient que ce qui est toujours vrai dans ce dépôt. Les procédures vivent dans des skills.

## Stack

- Angular 22 (standalone, zoneless, OnPush par défaut), TypeScript 6, tests Vitest via `ng test`.
- Node.js 24.15 ou plus.

## Commandes

- `npm start` : serveur de développement sur http://localhost:4200
- `npm test -- --watch=false` : tests unitaires
- `npm run build` : build de production (templates stricts)

## Conventions

- État en signals (`signal`, `computed`, `linkedSignal`) ; `input()` / `output()` / `model()` ; `inject()`.
- Control flow natif (`@if`, `@for` avec `track item.id`), métadonnées `host: {}`, `NgOptimizedImage` pour les images.
- Un dossier par fonctionnalité (`src/app/<feature>/`), nommage 2025 (`talk-card.ts` contient `class TalkCard`).
- Textes affichés en français ; code en anglais.

## Skills

- `revue-angular` : revue de code d'une branche, d'une PR ou d'une MR selon les règles de l'équipe. Les règles sont dans `references/` du skill ; le rapport sort dans `.review/REVIEW.md`. Le skill vit dans `.agents/skills/` et `.claude/skills/`, deux copies identiques.
- `corrige-review` : applique les findings de `.review/REVIEW.md`, un commit par finding, tests verts après chacun. S'invoque à la main.
- `raconte-branche` : écrit la description de la PR dans `.review/PR.md` à partir des commits et de la review.

## Limites

- `.review/` est généré : il ne se commite pas.
- Demander avant d'ajouter une dépendance, de modifier la CI ou de pousser.
