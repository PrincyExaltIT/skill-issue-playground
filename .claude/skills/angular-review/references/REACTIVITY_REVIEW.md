---
name: angular-reactivity-reviewer
description: Audit de la réactivité Angular — signals (input, model, computed, linkedSignal, effect, resource), contexte d'injection, interop RxJS, abonnements et opérateurs de flattening.
domain: reactivity
rule_prefix: R-SIG, R-RX
applies_to:
  - "**/*.ts"
  - "**/*.html"
severity_levels: [BLOCKER, MAJOR, MINOR, INFO]
output_format: json
parallel_safe: true
added_in: v2
sources:
  - https://angular.dev/guide/signals
  - https://angular.dev/guide/signals/linked-signal
  - https://angular.dev/guide/signals/resource
  - https://angular.dev/ecosystem/rxjs-interop
  - https://angular.dev/errors/NG0203
---

# Reviewer Guideline — Réactivité (signals & RxJS)

## But

Nouveau domaine de la v2. La v1 traitait la réactivité en deux règles d'architecture (`R-ARCH-017` abonnements, `R-ARCH-018` BehaviorSubject → signals), qui restent dans `ARCHITECTURE_CLEAN_CODE_REVIEW.md`. Ce fichier couvre ce qui a fait le plus de bugs réels depuis l'arrivée des signals : effets qui dérivent de l'état, mutations invisibles, appels hors contexte d'injection, et requêtes concurrentes mal composées.

Avant d'appliquer une règle, lire `angular` dans `.review/scope.json` : `resource`, `httpResource` et les Signal Forms sont stables depuis Angular 22 ; `linkedSignal` et `effect` depuis Angular 20.

## Niveaux de sévérité

- 🔴 **BLOCKER** — erreur à l'exécution (NG0203, NG0600) ou état corrompu de façon certaine.
- 🟠 **MAJOR** — bug probable (vue figée, course entre requêtes, fuite).
- 🟡 **MINOR** — API dépassée avec migration connue, robustesse.
- 🔵 **INFO** — modernisation conseillée.

---

## Règles à vérifier

### R-SIG-001 — `input()` / `output()` / `model()` plutôt que les décorateurs

- **Sévérité** : 🟡 MINOR (nouveau code uniquement — ne pas exiger la migration du code existant non touché)
- **Quoi vérifier** : les inputs signal sont lisibles réactivement (`computed`, `effect`), typent correctement `required`, et suppriment le besoin de `ngOnChanges`.
- **Pattern à flag** : `@Input()` / `@Output()` dans du code ajouté.
- **Exemple ❌** :
  ```ts
  @Input() talk!: Talk;
  @Output() selected = new EventEmitter<string>();
  ```
- **Exemple ✅** :
  ```ts
  readonly talk = input.required<Talk>();
  readonly selected = output<string>();
  ```
- **Migration** : `ng generate @angular/core:signal-input-migration`, `ng generate @angular/core:output-migration`
- **Source** : <https://angular.dev/guide/components/inputs>

### R-SIG-002 — Requêtes signal (`viewChild()`, `contentChild()`)

- **Sévérité** : 🔵 INFO
- **Quoi vérifier** : `@ViewChild` n'est pas réactif et n'est défini qu'après `ngAfterViewInit` ; `viewChild()` renvoie un signal utilisable dans `computed`/`effect`.
- **Exemple ✅** : `private readonly searchInput = viewChild.required<ElementRef<HTMLInputElement>>('search');`
- **Migration** : `ng generate @angular/core:signal-queries-migration`
- **Source** : <https://angular.dev/guide/components/queries>

### R-SIG-003 — `effect()` réservé aux effets de bord

- **Sévérité** : 🟠 MAJOR
- **Quoi vérifier** : un `effect` qui écrit dans un signal (`.set`, `.update`) pour recopier ou dériver une valeur crée un état intermédiaire incohérent (un rendu avec l'ancienne valeur), des boucles possibles et un graphe de dépendances illisible.
- **Pattern à flag** : `effect(() => { this.b.set(f(this.a())); })`.
- **Exemple ❌** :
  ```ts
  constructor() {
    effect(() => this.filtered.set(this.talks().filter((t) => t.track === this.track())));
  }
  ```
- **Exemple ✅** :
  ```ts
  readonly filtered = computed(() => this.talks().filter((t) => t.track === this.track()));
  // valeur dérivée mais modifiable localement :
  readonly selectedId = linkedSignal(() => this.talks()[0]?.id);
  ```
- **Garder `effect` pour** : synchroniser avec le DOM, `localStorage`, analytics, une lib non-Angular.
- **Source** : <https://angular.dev/guide/signals/linked-signal>

### R-SIG-004 — Pas de mutation en place d'une valeur de signal

- **Sévérité** : 🟠 MAJOR
- **Quoi vérifier** : un signal notifie quand sa **référence** change (égalité `Object.is`). Muter le tableau ou l'objet qu'il contient ne notifie personne : `computed`, templates OnPush et vues zoneless restent figés.
- **Pattern à flag** : `this.items().push(x)`, `this.user().name = …`, `update(list => { list.push(x); return list; })`.
- **Exemple ❌** :
  ```ts
  addFavorite(id: string) { this.favorites().push(id); }
  ```
- **Exemple ✅** :
  ```ts
  addFavorite(id: string) { this.favorites.update((ids) => [...ids, id]); }
  ```
- **Source** : <https://angular.dev/guide/signals>

### R-SIG-005 — API à contexte d'injection appelée hors contexte (NG0203)

- **Sévérité** : 🔴 BLOCKER
- **Quoi vérifier** : `inject()`, `toSignal()`, `toObservable()`, `effect()`, `afterNextRender()` et `takeUntilDestroyed()` **sans argument** exigent un contexte d'injection : initialiseur de champ, constructeur, factory de provider, guard/resolver fonctionnel, `runInInjectionContext`. Appelés dans `ngOnInit`, un handler ou un callback, ils lèvent `NG0203` à l'exécution.
- **Pattern à flag** : ces appels dans une méthode autre que `constructor`, sans `injector` ni `DestroyRef` explicite.
- **Exemple ❌** :
  ```ts
  ngOnInit() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(/* … */);
    this.speaker = toSignal(this.api.speaker$(this.id()));
  }
  ```
- **Exemple ✅** :
  ```ts
  private readonly destroyRef = inject(DestroyRef);
  readonly speaker = toSignal(toObservable(this.id).pipe(switchMap((id) => this.api.speaker$(id))));
  ngOnInit() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(/* … */);
  }
  ```
- **Source** : <https://angular.dev/errors/NG0203>

### R-SIG-006 — `computed()` pur

- **Sévérité** : 🔴 BLOCKER (écriture de signal) · 🟠 MAJOR (autre effet de bord)
- **Quoi vérifier** : un `computed` ne fait que calculer. Écrire un signal à l'intérieur lève `NG0600` ; un appel HTTP, un log ou une mutation y sont rejoués à chaque recalcul, de façon imprévisible.
- **Exemple ❌** : `readonly total = computed(() => { this.loading.set(false); return this.items().length; });`
- **Exemple ✅** : `readonly total = computed(() => this.items().length);`
- **Source** : <https://angular.dev/guide/signals>

### R-SIG-007 — Données asynchrones : `resource()` / `httpResource()`

- **Sévérité** : 🟡 MINOR (Angular ≥ 22, API stable) · 🔵 INFO (Angular 19-21, API expérimentale)
- **Quoi vérifier** : charger des données en s'abonnant à la main pour remplir un signal oblige à gérer soi-même chargement, erreur, annulation et rechargement quand un paramètre change. `httpResource` (et `resource`/`rxResource`) font tout cela et exposent `value()`, `isLoading()`, `error()`.
- **Pattern à flag** : `this.http.get(…).subscribe((d) => this.data.set(d))` dans un composant, surtout quand l'URL dépend d'un input.
- **Exemple ✅** :
  ```ts
  readonly talkId = input.required<string>();
  readonly talk = httpResource<Talk>(() => `/api/talks/${this.talkId()}`);
  ```
  ```html
  @if (talk.isLoading()) { <app-spinner /> }
  @else if (talk.error()) { <p role="alert">Talk introuvable.</p> }
  @else if (talk.hasValue()) { <h1>{{ talk.value().title }}</h1> }
  ```
- **Source** : <https://angular.dev/guide/http/http-resource>

### R-SIG-008 — Pas de `resource` pour une écriture

- **Sévérité** : 🟠 MAJOR
- **Quoi vérifier** : une resource se relance quand ses paramètres changent et peut être annulée : idéal pour lire, dangereux pour écrire (POST/PUT/DELETE rejoués ou annulés en plein vol).
- **Pattern à flag** : `httpResource(() => ({ url, method: 'POST', … }))`, `resource({ loader: () => api.save(…) })`.
- **Exemple ✅** : une méthode explicite `save()` qui appelle `HttpClient.post` (ou une mutation dédiée), déclenchée par l'utilisateur.
- **Source** : <https://angular.dev/guide/signals/resource>

### R-SIG-009 — Signal Forms pour les nouveaux formulaires (Angular ≥ 22)

- **Sévérité** : 🔵 INFO
- **Quoi vérifier** : depuis Angular 22, `form()` et la directive `[formField]` (`@angular/forms/signals`) sont stables. Un **nouveau** formulaire peut s'appuyer dessus : modèle en signal, validation par schéma, pas de `valueChanges` à gérer. Ne pas demander de migrer un reactive form existant.
- **Exemple ✅** :
  ```ts
  readonly proposal = signal({ title: '', abstract: '' });
  readonly proposalForm = form(this.proposal, (p) => { required(p.title); });
  ```
  ```html
  <input id="title" [formField]="proposalForm.title">
  ```
- **Source** : <https://angular.dev/guide/forms/signals/overview>

### R-SIG-010 — Signal appelé, pas seulement référencé

- **Sévérité** : 🔴 BLOCKER
- **Quoi vérifier** : un signal est une fonction, donc toujours « vrai ». `if (this.loading)`, `this.items && …`, `!this.selected` ne lisent jamais la valeur. Dans les templates, `{{ count }}` est signalé par le compilateur (NG8109) ; dans le TypeScript, rien ne prévient.
- **Exemple ❌** : `if (this.isFavorite) { this.favorites.remove(id); }`
- **Exemple ✅** : `if (this.isFavorite()) { this.favorites.remove(id); }`
- **Source** : <https://angular.dev/guide/signals> · règle `@angular-eslint/no-uncalled-signals` (nécessite les types)

### R-RX-001 — Pas de `subscribe` imbriqués

- **Sévérité** : 🟠 MAJOR
- **Quoi vérifier** : un `subscribe` dans un `subscribe` n'annule pas la requête interne, laisse les réponses arriver dans le désordre et éclate la gestion d'erreur.
- **Exemple ❌** :
  ```ts
  this.api.speaker(id).subscribe((s) => {
    this.api.talksOf(s.id).subscribe((talks) => this.talks.set(talks));
  });
  ```
- **Exemple ✅** :
  ```ts
  readonly talks = toSignal(
    toObservable(this.speakerId).pipe(switchMap((id) => this.api.speaker(id)), switchMap((s) => this.api.talksOf(s.id))),
    { initialValue: [] },
  );
  ```
- **Source** : <https://angular.dev/ecosystem/rxjs-interop>

### R-RX-002 — `shareReplay` avec `refCount`

- **Sévérité** : 🟡 MINOR
- **Quoi vérifier** : `shareReplay(1)` garde la souscription à la source après le départ du dernier abonné (polling, websocket ou interval qui tournent pour rien).
- **Exemple ✅** : `shareReplay({ bufferSize: 1, refCount: true })` — ou un signal si la valeur est un état.
- **Source** : <https://rxjs.dev/api/operators/shareReplay>

### R-RX-003 — Le bon opérateur de flattening

- **Sévérité** : 🟠 MAJOR (recherche, autocomplétion, navigation) · 🟡 MINOR (ailleurs)
- **Quoi vérifier** : `mergeMap` sur une recherche ou un paramètre de route laisse la réponse la plus lente gagner (résultats d'une ancienne saisie affichés). `switchMap` annule la précédente ; `concatMap` préserve l'ordre des écritures ; `exhaustMap` ignore les doubles clics.
- **Exemple ❌** : `this.query$.pipe(debounceTime(300), mergeMap((q) => this.api.search(q)))`
- **Exemple ✅** : `this.query$.pipe(debounceTime(300), distinctUntilChanged(), switchMap((q) => this.api.search(q)))` — ou en signals : `debounced()` (expérimental en v22) + `httpResource`.
- **Source** : <https://rxjs.dev/api/operators/switchMap>

---

## Checklist finale

- [ ] R-SIG-001 — `input()` / `output()` / `model()` dans le nouveau code
- [ ] R-SIG-002 — Requêtes signal
- [ ] R-SIG-003 — `effect` sans écriture d'état dérivé
- [ ] R-SIG-004 — Pas de mutation en place
- [ ] R-SIG-005 — Contexte d'injection respecté (NG0203)
- [ ] R-SIG-006 — `computed` pur
- [ ] R-SIG-007 — `resource` / `httpResource` pour les lectures
- [ ] R-SIG-008 — Pas de `resource` pour les écritures
- [ ] R-SIG-009 — Signal Forms pour un nouveau formulaire (v22+)
- [ ] R-SIG-010 — Signals appelés dans les conditions
- [ ] R-RX-001 — Pas de `subscribe` imbriqués
- [ ] R-RX-002 — `shareReplay` avec `refCount`
- [ ] R-RX-003 — Opérateur de flattening adapté

Voir aussi, dans `ARCHITECTURE_CLEAN_CODE_REVIEW.md` : R-ARCH-017 (désabonnement), R-ARCH-018 (BehaviorSubject → signals), R-ARCH-019 (mutation d'inputs).

---

## Format de sortie

Le format des findings est défini **une seule fois**, dans [`REVIEWER_PROMPT.md`](REVIEWER_PROMPT.md). `scripts/findings.mjs merge` rejette tout finding qui ne respecte pas ce contrat.
