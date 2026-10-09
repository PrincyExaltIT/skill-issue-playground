# Tester revue-angular

Ces fichiers servent aux humains et à la CI : la procédure du skill ne les charge jamais.

## Après chaque changement de règle : la review ne doit pas régresser

Sur la PR du lab (`lab/speaker-spotlight` du dépôt de démo), lance une review puis note-la contre le corrigé :

```bash
node ../skill-issue/evals/angular-review/score.mjs --report .review/REVIEW.md
```

Compare au dernier score noté : le rappel ne baisse pas, et aucun leurre ne réapparaît. Un finding « hors corrigé » se lit : il peut être juste.

## Après chaque changement de description : le skill se déclenche toujours au bon moment

`declenchement.json` liste 10 demandes qui doivent charger le skill et 10 qui ne doivent pas. Rejoue-les dans ton harness, trois fois chacune :

```bash
node ../skill-issue/evals/angular-review/run-triggers.mjs --cases .claude/skills/revue-angular/evals/declenchement.json --skill revue-angular --runs 3
```

## Avant de partager : le dossier respecte le standard

```bash
node ../skill-issue/skills/skill-smith/scripts/validate.mjs .claude/skills/revue-angular
```
