---
name: angular-testing-reviewer
description: Audit des tests Angular touchés ou manquants — couverture du comportement ajouté, tests focalisés, specs vides, inputs requis, zoneless et Vitest, HTTP testing.
domain: testing
rule_prefix: R-TEST
applies_to:
  - "**/*.spec.ts"
  - "**/*.ts"
severity_levels: [BLOCKER, MAJOR, MINOR, INFO]
output_format: json
parallel_safe: true
added_in: v2
sources:
  - https://angular.dev/guide/testing
  - https://angular.dev/guide/testing/components-basics
  - https://angular.dev/guide/http/testing
---

# Reviewer Guideline — Tests

## But

Nouveau domaine de la v2 (absent de la v1). Le reviewer ne juge pas la couverture globale : il vérifie que **le comportement ajouté ou modifié par le diff** est protégé, et que les specs touchées testent réellement quelque chose.

Lire `angular.testRunner` et `angular.zoneless` dans `.review/scope.json` : depuis Angular 21, les nouveaux projets utilisent Vitest et sont zoneless par défaut, ce qui change les outils de test valides.

## Niveaux de sévérité

- 🔴 **BLOCKER** — la suite est cassée ou désactivée sans le dire.
- 🟠 **MAJOR** — test qui échoue à coup sûr, ou comportement critique ajouté sans aucun test.
- 🟡 **MINOR** — test faible (ne vérifie rien d'utile), unité nouvelle sans spec.
- 🔵 **INFO** — style de test.

---

## Règles à vérifier

### R-TEST-001 — Nouvelle unité sans spec

- **Sévérité** : 🟡 MINOR (🟠 MAJOR si l'unité porte de la logique métier : calcul, règle, transformation)
- **Quoi vérifier** : un composant, service, pipe, directive, guard ou interceptor **ajouté** sans fichier `*.spec.ts` voisin.
- **Source** : <https://angular.dev/guide/testing>

### R-TEST-002 — Tests focalisés

- **Sévérité** : 🟠 MAJOR
- **Quoi vérifier** : `fit`, `fdescribe`, `it.only`, `describe.only`, `test.only` désactivent silencieusement le reste de la suite en CI.
- **Exemple ✅** : supprimer la focalisation avant le merge.
- **Source** : <https://vitest.dev/api/#test-only>

### R-TEST-003 — Spec qui ne vérifie que la création

- **Sévérité** : 🟡 MINOR
- **Quoi vérifier** : le seul `expect` est `toBeTruthy()` sur l'instance : le test passe même quand le comportement est cassé.
- **Exemple ❌** :
  ```ts
  it('should create', () => expect(fixture.componentInstance).toBeTruthy());
  ```
- **Exemple ✅** :
  ```ts
  it('affiche le titre du talk et émet son id au clic sur Favori', async () => {
    fixture.componentRef.setInput('talk', talk);
    await fixture.whenStable();
    expect(el.querySelector('h3')?.textContent).toContain('Signals en prod');
    const emitted: string[] = [];
    fixture.componentInstance.favoriteToggled.subscribe((id) => emitted.push(id));
    el.querySelector('button')!.click();
    expect(emitted).toEqual([talk.id]);
  });
  ```
- **Source** : <https://angular.dev/guide/testing/components-basics>

### R-TEST-004 — Inputs requis fournis dans les tests

- **Sévérité** : 🟠 MAJOR
- **Quoi vérifier** : un composant avec `input.required()` créé sans `fixture.componentRef.setInput(...)` lève `NG0950` à la première lecture de l'input : le test échoue.
- **Pattern à flag** : `TestBed.createComponent(X)` suivi de `detectChanges`/`whenStable` sans `setInput` alors que `X` déclare un `input.required`.
- **Exemple ✅** : `fixture.componentRef.setInput('talk', aTalk);` avant le premier rendu.
- **Source** : <https://angular.dev/guide/testing/components-scenarios>

### R-TEST-005 — Outils de test compatibles zoneless / Vitest

- **Sévérité** : 🟠 MAJOR
- **Quoi vérifier** : `fakeAsync`, `tick`, `flush` et `waitForAsync` reposent sur zone.js. Dans un projet zoneless sous Vitest (défaut depuis Angular 21, TestBed compris), ils échouent si zone.js n'est pas chargé. Angular 22 propose un pont (`zone.js/plugins/vitest-patch`) pour du code existant ; le nouveau code utilise les fake timers de Vitest.
- **Exemple ❌** : `it('debounce', fakeAsync(() => { …; tick(300); … }));`
- **Exemple ✅** :
  ```ts
  vi.useFakeTimers();
  // …
  await vi.advanceTimersByTimeAsync(300);
  await fixture.whenStable();
  ```
- **Source** : <https://angular.dev/guide/testing/zoneless>

### R-TEST-006 — HTTP mocké avec `provideHttpClientTesting()`

- **Sévérité** : 🟡 MINOR
- **Quoi vérifier** : un test qui touche un service HTTP utilise `provideHttpClient()` + `provideHttpClientTesting()` et `HttpTestingController` (et pas `HttpClientTestingModule`, déprécié, ni le vrai réseau).
- **Exemple ✅** :
  ```ts
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const http = TestBed.inject(HttpTestingController);
  http.expectOne('/api/talks').flush([aTalk]);
  ```
- **Source** : <https://angular.dev/guide/http/testing>

### R-TEST-007 — Le comportement modifié est couvert

- **Sévérité** : 🟠 MAJOR (jugement)
- **Quoi vérifier** : le diff change une règle visible (calcul, filtre, condition d'affichage, appel réseau) et aucune spec ajoutée ou modifiée ne l'exerce. Citer la ligne de code changée, pas l'absence de test en général.
- **Source** : <https://angular.dev/guide/testing>

---

## Checklist finale

- [ ] R-TEST-001 — Spec pour chaque nouvelle unité
- [ ] R-TEST-002 — Aucun test focalisé
- [ ] R-TEST-003 — Specs qui testent un comportement
- [ ] R-TEST-004 — Inputs requis fournis
- [ ] R-TEST-005 — Outils compatibles zoneless / Vitest
- [ ] R-TEST-006 — HTTP mocké proprement
- [ ] R-TEST-007 — Comportement modifié couvert

---

## Format de sortie

Le format des findings est défini **une seule fois**, dans [`REVIEWER_PROMPT.md`](REVIEWER_PROMPT.md). `scripts/findings.mjs merge` rejette tout finding qui ne respecte pas ce contrat.
