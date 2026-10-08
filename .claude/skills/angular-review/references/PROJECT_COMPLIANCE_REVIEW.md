---
name: project-compliance-reviewer
description: Audit de conformité au cahier des charges spécifique du projet (RFC interne, kata, contrat d'API, charte UX). À DÉRIVER pour votre projet — ce fichier livré est un gabarit vide.
domain: project-compliance
rule_prefix: R-PROJ
applies_to:
  - "src/**/*.ts"
  - "src/**/*.html"
  - "src/**/*.css"
  - "src/**/*.scss"
  - "package.json"
  - "README.md"
severity_levels: [BLOCKER, MAJOR, MINOR, INFO]
output_format: json
parallel_safe: true
sources:
  - README.md
---

# Reviewer Guideline — Conformité projet (gabarit)

## ⚠️ Ce fichier est un gabarit vide

L'orchestrator du skill `angular-review` n'activera le subagent `project-compliance-reviewer` **que si ce fichier contient au moins une règle `R-PROJ-NNN`** sous la section « Règles à vérifier ». Tant que la section reste vide, le subagent est skippé silencieusement.

## But

Encoder les contraintes spécifiques de votre projet (kata, RFC interne, contrat d'API, charte UX) sous forme de règles actionnables qui complètent les guidelines génériques Angular livrées avec le skill. Le préfixe `R-PROJ` est priorisé par le verdict : un seul BLOCKER `R-PROJ` classe le rendu en `REQUEST_CHANGES`.

## Procédure (5 minutes)

1. **Identifier la source canonique** : `README.md`, RFC interne, ticket Jira, contrat OpenAPI, charte UX. Tout ce qui définit « le code est conforme si ».
2. **Lister les contraintes**, idéalement RFC2119 (`DOIT`, `NE DOIT PAS`, `DEVRAIT`, `PEUT`).
3. **Pour chaque contrainte**, écrire une règle au format ci-dessous.
4. **Optionnel** : ajuster `applies_to` dans le frontmatter pour matcher uniquement vos fichiers d'intérêt (limite le bruit).
5. **Optionnel** : ajuster le `rule_prefix` (`R-PROJ` par défaut ; vous pouvez utiliser `R-KATA`, `R-API`, etc.).

## Niveaux de sévérité

- 🔴 **BLOCKER** — viole un `DOIT` / `NE DOIT PAS` ; bloque le merge.
- 🟠 **MAJOR** — viole un `DEVRAIT` ou casse une garantie fonctionnelle clé ; à corriger sauf justification.
- 🟡 **MINOR** — viole un `PEUT` ou un détail cosmétique ; à corriger si possible.
- 🔵 **INFO** — suggestion / point d'attention.

## Gabarit de règle

```markdown
### R-PROJ-001 — <titre court de la contrainte>

- **Sévérité** : 🔴 BLOCKER | 🟠 MAJOR | 🟡 MINOR | 🔵 INFO
- **Référence** : « <citation exacte de la source canonique> » — <chemin du fichier>:L<ligne> ou URL
- **Quoi vérifier** : <description du contrôle à exercer sur le diff/code>
- **Pattern à flag** : <regex, antipattern, condition logique à détecter>
- **Pattern accepté** : <régex/exemple qui passe>
- **Exemple ❌** :
  ```ts
  // code qui viole la règle
  ```
- **Exemple ✅** :
  ```ts
  // code conforme
  ```
- **Note** : <précision sur l'interprétation, edge cases, exceptions acceptables>
```

## Règles à vérifier

<!--
Supprimer ce commentaire et ajouter vos règles ci-dessous. Tant que cette section est vide,
l'orchestrator du skill ne lancera PAS le subagent project-compliance-reviewer.

Exemple minimal (à adapter) :

### R-PROJ-001 — Tous les composants exposent un `data-testid`

- **Sévérité** : 🟠 MAJOR
- **Référence** : « Tous les composants visibles `DOIVENT` exposer un attribut `data-testid` pour
  permettre l'écriture de tests e2e stables » — internal-rfc-001.md:L42
- **Quoi vérifier** : chaque composant déclarant un `selector` dans `@Component({...})` doit
  rendre au moins un élément racine avec `[attr.data-testid]` ou `data-testid="..."` dans son
  template.
- **Pattern à flag** : template d'un composant sans aucun `data-testid` sur l'élément racine.
-->

## Format de sortie (rappel)

Retourner un unique objet JSON, **sans markdown ni prose** :

```json
{
  "agent": "project-compliance-reviewer",
  "findings": [
    {
      "ruleId": "R-PROJ-NNN",
      "severity": "BLOCKER|MAJOR|MINOR|INFO",
      "domain": "project-compliance",
      "file": "path/to/file.ts",
      "line": 42,
      "snippet": "<extrait>",
      "message": "<violation observée>",
      "suggestion": "<correction>",
      "source": "README.md L<line> ou URL"
    }
  ]
}
```

Si aucune violation : `{"agent": "project-compliance-reviewer", "findings": []}`.
