# Tests

### TEST-01 · Test focalisé — MAJOR
**Pourquoi** : `it.only`, `fit` ou `fdescribe` ne font tourner qu'un test. Avec `CI=true`, Vitest échoue ; sans, la suite passe sans rien vérifier.
**À repérer** : `.only(`, `fit(`, `fdescribe(`.
**Correction** : retirer le focus.

### TEST-02 · Nouveau fichier sans test — MINOR
**Pourquoi** : un composant, un service ou un guard ajouté sans `.spec.ts` n'a aucun filet.
**À repérer** : un nouveau fichier `.ts` (hors routes, modèles et configuration) sans `.spec.ts` à côté.
**Correction** : un test du comportement principal.

### TEST-03 · Test qui ne vérifie que la création — MINOR
**À repérer** : une seule assertion, `expect(component).toBeTruthy()`.
**Correction** : tester un comportement : un rendu, une interaction, une requête attendue (`HttpTestingController`).

### TEST-04 · Test qui appelle le vrai backend — MAJOR
**À repérer** : un `HttpClient` réel dans un test unitaire, sans `provideHttpClientTesting()`.
**Correction** : `provideHttpClientTesting()` et `HttpTestingController`.
