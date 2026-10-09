# Réactivité : signals, RxJS, zoneless

L'application est zoneless : la vue ne se met à jour que quand un signal qu'elle lit change, ou sur un événement du template. Un champ ordinaire modifié dans un callback asynchrone ne s'affiche pas.

### SIG-01 · Signal testé sans être appelé — BLOCKER
**Pourquoi** : un signal est une fonction. `if (this.isFavorite)` teste la fonction, toujours vraie : la valeur n'est jamais lue.
**À repérer** : un `signal`, `computed`, `input` ou `model` utilisé sans `()` dans une condition, un `&&`, un `||` ou un calcul.
**Correction** : `if (this.isFavorite())`.

### SIG-02 · Valeur d'un signal modifiée en place — MAJOR
**Pourquoi** : `this.ids().push(id)` change le tableau sans changer sa référence : ni les `computed`, ni la vue ne se mettent à jour.
**À repérer** : `push`, `splice`, `sort` ou une affectation de propriété sur la valeur d'un signal, y compris dans `update((list) => { list.push(x); return list; })`.
**Correction** : `this.ids.update((ids) => [...ids, id])`.

### SIG-03 · `effect()` qui écrit dans un signal — MAJOR
**Pourquoi** : dériver un état avec un effect le met à jour un tour trop tard et ouvre la porte aux boucles.
**À repérer** : `.set(` ou `.update(` d'un signal dans un `effect()`. Un effect qui écrit dans `localStorage`, le DOM ou un log fait un effet de bord légitime.
**Correction** : `readonly charCount = computed(() => this.abstract().length);` ou `linkedSignal`.

### SIG-04 · API à contexte d'injection appelée hors contexte (NG0203) — BLOCKER
**Pourquoi** : `inject()`, `takeUntilDestroyed()` sans argument, `toSignal()` et `effect()` exigent un contexte d'injection : constructeur ou initialiseur de champ. Dans `ngOnInit`, une méthode ou un callback, ils lèvent NG0203 à l'exécution.
**À repérer** : ces appels dans un hook de cycle de vie, une méthode ou un callback. `takeUntilDestroyed(this.destroyRef)` avec un `DestroyRef` injecté fonctionne partout.
**Correction** : déplacer l'appel dans un initialiseur de champ, ou passer `DestroyRef` / `Injector` explicitement.

### RX-01 · Abonnement jamais libéré — MAJOR
**Pourquoi** : un `subscribe()` dans un composant survit au composant quand la source ne se termine pas (`valueChanges`, `paramMap`, `interval`, store) : fuite mémoire et traitements en double.
**À repérer** : `.subscribe(` dans un composant ou une directive, sans `takeUntilDestroyed`, pipe `async` ni `toSignal`. Un appel HTTP se termine seul : au plus MINOR.
**Correction** : `toSignal(source$)`, ou `.pipe(takeUntilDestroyed(this.destroyRef))`.

### RX-02 · Abonnements imbriqués — MAJOR
**Pourquoi** : un `subscribe` dans un `subscribe` n'annule pas la requête précédente quand la source change : réponses dans le désordre, fuites.
**À repérer** : `.subscribe(` à l'intérieur du callback d'un autre `.subscribe(`.
**Correction** : `switchMap` (ou `forkJoin` pour des appels parallèles) et un seul abonnement, ou `httpResource()`.

### RX-03 · Erreur HTTP non gérée — MAJOR
**Pourquoi** : sans gestion d'erreur, l'écran reste sur « chargement » et l'utilisateur ne sait pas quoi faire.
**À repérer** : un appel HTTP sans `catchError`, sans état d'erreur affiché, ou un `httpResource()` dont l'erreur n'est jamais lue.
**Correction** : un état d'erreur visible (`@if (speaker.error()) { … }`) avec un message et une action.

### ZL-01 · Champ ordinaire modifié dans un callback asynchrone (zoneless) — MAJOR
**Pourquoi** : sans zone.js, `this.loading = false` dans un `subscribe`, un `setTimeout`, une promesse ou un listener ne déclenche aucun rendu.
**À repérer** : l'affectation `this.x = …` d'un champ lu par le template, dans un callback asynchrone.
**Correction** : faire de ce champ un `signal` et appeler `.set()`.

### RX-04 · `shareReplay` sans `refCount` — MINOR
**À repérer** : `shareReplay(1)` sur une source qui ne se termine pas.
**Correction** : `shareReplay({ bufferSize: 1, refCount: true })`.
