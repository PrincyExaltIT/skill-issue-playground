# Exemples

Deux bons findings, pour le ton et le niveau de preuve, puis les pièges que l'équipe a déjà vus : des pistes qui ressemblent à un problème et n'en sont pas. Les exemples viennent d'autres projets : ils montrent la forme, pas les réponses.

## Un bon finding

### BLOCKER · SIG-01 · Le panier s'affiche toujours vide
`src/app/cart/cart-summary.ts:31`

**Problème** — `if (this.items.length === 0)` lit la propriété `length` de la fonction signal (son nombre de paramètres : 0), jamais celle du tableau. Le message « panier vide » s'affiche en permanence.

**Correction** — `if (this.items().length === 0)`, ou un `readonly isEmpty = computed(() => this.items().length === 0)`.

### MAJOR · RX-01 · L'abonnement survit au composant
`src/app/search/search-box.ts:48`

**Problème** — `this.query.valueChanges.subscribe(…)` dans `ngOnInit`, sans `takeUntilDestroyed` : `valueChanges` ne se termine jamais, chaque ouverture de la page ajoute un abonnement qui continue d'appeler l'API.

**Correction** — `toSignal(this.query.valueChanges)`, ou `.pipe(takeUntilDestroyed(this.destroyRef))` avec `private readonly destroyRef = inject(DestroyRef)`.

Ce qui les rend bons : un emplacement exact, la règle, ce que voit l'utilisateur, et une correction qu'on peut coller.

## Pièges à écarter

| La piste | Pourquoi l'écarter |
|---|---|
| `subscribe()` sur un appel `HttpClient` dans un composant | La requête émet une fois puis se termine : pas de fuite. Au plus MINOR si la réponse peut arriver après la destruction. |
| `takeUntilDestroyed(this.destroyRef)` dans `ngOnInit` | Avec un `DestroyRef` injecté, l'appel est valide hors contexte d'injection : ni NG0203, ni fuite. |
| `effect()` qui écrit dans `localStorage`, le DOM ou un log | C'est un effet de bord, l'usage prévu d'un effect. SIG-03 vise un effect qui écrit dans un signal. |
| Composant sans `changeDetection` | En Angular 22, OnPush est le défaut. Seul un `Eager` explicite se discute (NG-07). |
| `localStorage` lu à l'initialisation d'un signal | Sans rendu serveur, c'est acceptable. À signaler seulement si le projet a `@angular/ssr`. |
| `{{ total() }}` dans un template | C'est la lecture d'un signal, pas un appel de méthode coûteux (NG-08). |
| Une ligne que la branche ne modifie pas | Hors périmètre, même si elle est mal écrite : au plus une note en fin de rapport. |
