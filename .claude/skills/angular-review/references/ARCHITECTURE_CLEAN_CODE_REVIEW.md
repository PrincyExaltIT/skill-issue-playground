---
name: angular-architecture-reviewer
description: Audit architecture & clean code Angular (conventions, structure, DI, signals, RxJS, smart/dumb components, lisibilité).
domain: architecture
rule_prefix: R-ARCH
applies_to:
  - "**/*.ts"
  - "**/*.html"
  - "**/*.scss"
  - "**/*.css"
severity_levels: [BLOCKER, MAJOR, MINOR, INFO]
output_format: json
parallel_safe: true
sources:
  - https://angular.dev/style-guide
---

# Reviewer Guideline — Architecture & Clean Code Angular

## But
Ce document sert de référence à un agent reviewer chargé d'auditer une PR ou un diff Angular sur les axes architecture, structure de fichiers, lisibilité et conventions. Pour chaque règle, l'agent doit vérifier le code modifié et émettre un finding lorsqu'une violation est détectée. La cible est Angular 17+ (standalone, signals, nouveau control flow).

## Niveaux de sévérité
- 🔴 BLOCKER — viole une règle structurante d'Angular ou casse l'architecture ; doit être corrigé avant merge.
- 🟠 MAJOR — dette technique significative ou anti-pattern reconnu ; correction fortement recommandée.
- 🟡 MINOR — non-respect de convention ou de style sans impact fonctionnel immédiat.
- 🔵 INFO — suggestion ou point d'attention pour amélioration future.

## Règles à vérifier

### R-ARCH-001 — Nommage de fichiers en kebab-case
- **Sévérité** : 🟡 MINOR
- **Quoi vérifier** : tous les fichiers `.ts`, `.html`, `.css`, `.scss` doivent utiliser des tirets pour séparer les mots, en minuscules.
- **Pattern à flag** : noms de fichiers en `camelCase`, `PascalCase` ou `snake_case` (ex. `userProfile.ts`, `UserProfile.ts`, `user_profile.ts`).
- **Exemple ❌** :
  ```ts
  // userProfile.ts
  export class UserProfile {}
  ```
- **Exemple ✅** :
  ```ts
  // user-profile.ts
  export class UserProfile {}
  ```
- **Source** : angular.dev/style-guide — Nommage.

### R-ARCH-002 — Suffixe `.spec.ts` pour les fichiers de tests
- **Sévérité** : 🟠 MAJOR
- **Quoi vérifier** : les fichiers de tests unitaires doivent finir par `.spec.ts` et être colocalisés avec le code testé.
- **Pattern à flag** : `*.test.ts`, dossier `tests/` séparé, fichiers de tests sans suffixe.
- **Exemple ❌** :
  ```
  src/tests/user-profile.test.ts
  ```
- **Exemple ✅** :
  ```
  src/app/user-profile/user-profile.spec.ts
  ```
- **Source** : angular.dev/style-guide — Structure & Nommage.

### R-ARCH-003 — Nom de fichier = identifiant principal
- **Sévérité** : 🟡 MINOR
- **Quoi vérifier** : le nom du fichier doit refléter l'identifiant TypeScript principal exporté.
- **Pattern à flag** : fichier `helpers.ts` exportant `UserProfile`, ou divergence entre nom de classe et nom de fichier.
- **Exemple ❌** :
  ```ts
  // helpers.ts
  export class UserProfile {}
  ```
- **Exemple ✅** :
  ```ts
  // user-profile.ts
  export class UserProfile {}
  ```
- **Source** : angular.dev/style-guide — Nommage.

### R-ARCH-004 — Pas de noms génériques
- **Sévérité** : 🟡 MINOR
- **Quoi vérifier** : éviter `helpers.ts`, `utils.ts`, `common.ts`, `misc.ts` sans préfixe métier.
- **Pattern à flag** : création ou ajout dans un fichier au nom générique.
- **Exemple ❌** :
  ```ts
  // utils.ts
  export function formatDate(d: Date) { ... }
  export function parseUser(raw: string) { ... }
  ```
- **Exemple ✅** :
  ```ts
  // date-format.util.ts
  export function formatDate(d: Date) { ... }
  ```
- **Source** : angular.dev/style-guide — Nommage.

### R-ARCH-005 — Organisation par domaine fonctionnel
- **Sévérité** : 🟠 MAJOR
- **Quoi vérifier** : les fichiers doivent être groupés par domaine métier (`reserve-tickets/`, `show-times/`) plutôt que par type technique (`components/`, `services/`, `pipes/` à la racine).
- **Pattern à flag** : dossiers globaux `services/`, `components/`, `models/` regroupant des éléments de domaines distincts.
- **Exemple ❌** :
  ```
  src/app/services/booking.service.ts
  src/app/services/auth.service.ts
  src/app/components/booking-list.ts
  ```
- **Exemple ✅** :
  ```
  src/app/booking/booking.service.ts
  src/app/booking/booking-list.ts
  src/app/auth/auth.service.ts
  ```
- **Source** : angular.dev/style-guide — Structure.

### R-ARCH-006 — Un fichier = un concept
- **Sévérité** : 🟠 MAJOR
- **Quoi vérifier** : un même fichier ne doit pas contenir plusieurs composants, services ou directives publics.
- **Pattern à flag** : plusieurs `@Component`, `@Injectable`, ou `@Directive` dans le même fichier.
- **Exemple ❌** :
  ```ts
  @Component({ selector: 'a-comp', template: '' }) export class A {}
  @Component({ selector: 'b-comp', template: '' }) export class B {}
  ```
- **Exemple ✅** :
  ```ts
  // a.ts
  @Component({ selector: 'a-comp', template: '' }) export class A {}
  // b.ts
  @Component({ selector: 'b-comp', template: '' }) export class B {}
  ```
- **Source** : angular.dev/style-guide — Structure.

### R-ARCH-007 — `inject()` plutôt que paramètres de constructeur
- **Sévérité** : 🟡 MINOR
- **Quoi vérifier** : préférer `inject(Token)` à `constructor(private dep: Token)`.
- **Pattern à flag** : `constructor(private ...)` ou `constructor(public ...)` avec injections.
- **Exemple ❌** :
  ```ts
  export class UserList {
    constructor(private route: ActivatedRoute) {}
  }
  ```
- **Exemple ✅** :
  ```ts
  export class UserList {
    private readonly route = inject(ActivatedRoute);
  }
  ```
- **Source** : angular.dev/style-guide — Injection.

### R-ARCH-008 — `protected` pour membres lus dans le template
- **Sévérité** : 🟡 MINOR
- **Quoi vérifier** : tout membre référencé depuis le template doit être déclaré `protected` (ni `private` ni `public` par défaut).
- **Pattern à flag** : `public` (ou absence de modificateur) pour des champs uniquement utilisés dans le HTML.
- **Exemple ❌** :
  ```ts
  export class UserProfile {
    fullName = computed(() => `${this.firstName()}`);
  }
  ```
- **Exemple ✅** :
  ```ts
  export class UserProfile {
    protected fullName = computed(() => `${this.firstName()}`);
  }
  ```
- **Source** : angular.dev/style-guide — Composants.

### R-ARCH-009 — `readonly` pour `input` / `model` / `output` / queries
- **Sévérité** : 🟠 MAJOR
- **Quoi vérifier** : les propriétés initialisées par Angular (`input()`, `model()`, `output()`, `viewChild()`, etc.) doivent être `readonly`.
- **Pattern à flag** : `input()` ou `output()` sans `readonly`.
- **Exemple ❌** :
  ```ts
  firstName = input<string>();
  saved = output<void>();
  ```
- **Exemple ✅** :
  ```ts
  readonly firstName = input<string>();
  readonly saved = output<void>();
  ```
- **Source** : angular.dev/style-guide — Composants.

### R-ARCH-010 — Composants standalone par défaut

> **v2** : depuis Angular 19, `standalone: true` est le défaut. Le flag explicite est du bruit (🔵 INFO). `standalone: false` ou un nouveau `@NgModule` passent de 🔴 BLOCKER (v1) à 🟠 MAJOR : c'est une dette qui bloque le lazy loading par composant, pas un bug en production.
- **Sévérité** : 🟠 MAJOR (`standalone: false`, nouveau `NgModule`) · 🔵 INFO (`standalone: true` explicite, v19+)
- **Quoi vérifier** : tout nouveau composant/directive/pipe doit être standalone (Angular 17+ = standalone par défaut, ne pas désactiver).
- **Pattern à flag** : `standalone: false` ou déclaration dans un `NgModule`.
- **Exemple ❌** :
  ```ts
  @Component({ standalone: false, selector: 'x', template: '' })
  export class X {}
  ```
- **Exemple ✅** :
  ```ts
  @Component({ selector: 'x', template: '', imports: [CommonModule] })
  export class X {}
  ```
- **Source** : angular.dev/style-guide — Composants standalone.

### R-ARCH-011 — Templates simples — déléguer au TS
- **Sévérité** : 🟠 MAJOR
- **Quoi vérifier** : pas d'expressions complexes (chaînes ternaires imbriquées, calculs, accès profonds) dans le template ; utiliser `computed()` ou une méthode nommée.
- **Pattern à flag** : ternaires imbriqués, expressions arithmétiques, appels de méthodes avec logique dans le HTML.
- **Exemple ❌** :
  ```html
  <p>{{ user.firstName + ' ' + (user.middleName ? user.middleName + ' ' : '') + user.lastName }}</p>
  ```
- **Exemple ✅** :
  ```ts
  protected fullName = computed(() => formatFullName(this.user()));
  ```
  ```html
  <p>{{ fullName() }}</p>
  ```
- **Source** : angular.dev/style-guide — Composants ; clean code (SRP).

### R-ARCH-012 — `[class.x]` / `[style.x]` plutôt que `[ngClass]` / `[ngStyle]`
- **Sévérité** : 🟡 MINOR
- **Quoi vérifier** : pour des bindings simples, préférer la syntaxe directe.
- **Pattern à flag** : `[ngClass]="{ admin: isAdmin }"` ou `[ngStyle]="{ color: textColor }"` quand un seul attribut/style est concerné.
- **Exemple ❌** :
  ```html
  <div [ngClass]="{ admin: isAdmin() }" [ngStyle]="{ color: textColor() }"></div>
  ```
- **Exemple ✅** :
  ```html
  <div [class.admin]="isAdmin()" [style.color]="textColor()"></div>
  ```
- **Source** : angular.dev/style-guide — Composants.

### R-ARCH-013 — Handlers nommés par l'action, pas par l'événement
- **Sévérité** : 🟡 MINOR
- **Quoi vérifier** : `(click)="saveUser()"`, pas `(click)="handleClick()"` / `onClick()`.
- **Pattern à flag** : noms `handleX`, `onX`, `xClick`, `xEvent`.
- **Exemple ❌** :
  ```html
  <button (click)="handleClick()">Save</button>
  ```
- **Exemple ✅** :
  ```html
  <button (click)="saveUser()">Save</button>
  ```
- **Source** : angular.dev/style-guide — Composants.

### R-ARCH-014 — Hooks de cycle de vie courts et explicites
- **Sévérité** : 🟡 MINOR
- **Quoi vérifier** : `ngOnInit`, `ngOnDestroy`, etc. doivent rester courts et déléguer à des méthodes nommées ; implémenter explicitement les interfaces (`OnInit`, etc.) pour la sécurité au compile-time.
- **Pattern à flag** : `ngOnInit` de plus de 10 lignes, ou hook sans `implements OnInit`.
- **Exemple ❌** :
  ```ts
  export class Page {
    ngOnInit() {
      // 30 lignes de fetch + parsing + side effects
    }
  }
  ```
- **Exemple ✅** :
  ```ts
  export class Page implements OnInit {
    ngOnInit() {
      this.loadUser();
      this.subscribeToRoute();
    }
  }
  ```
- **Source** : angular.dev/style-guide — Composants.

### R-ARCH-015 — Smart vs dumb components
- **Sévérité** : 🟠 MAJOR
- **Quoi vérifier** : un composant de présentation (dumb) ne doit pas injecter de service métier ; un composant container (smart) orchestre les services et passe les données via `input()`.
- **Pattern à flag** : composant nommé `*-card`, `*-list-item`, `*-button` qui injecte un service applicatif (HTTP, store, router, etc.).
- **Exemple ❌** :
  ```ts
  @Component({ selector: 'user-card', template: '...' })
  export class UserCard {
    private readonly http = inject(HttpClient);
    ngOnInit() { this.http.get('/api/me').subscribe(...); }
  }
  ```
- **Exemple ✅** :
  ```ts
  @Component({ selector: 'user-card', template: '...' })
  export class UserCard {
    readonly user = input.required<User>();
    readonly edit = output<User>();
  }
  ```
- **Source** : Clean code Angular — separation of concerns.

### R-ARCH-016 — Pas de logique métier dans les composants
- **Sévérité** : 🟠 MAJOR
- **Quoi vérifier** : les calculs métier, transformations de données et appels HTTP doivent vivre dans un service injecté ; le composant orchestre.
- **Pattern à flag** : `HttpClient` directement dans un composant, calculs de prix/règles métier inline.
- **Exemple ❌** :
  ```ts
  export class CartPage {
    private readonly http = inject(HttpClient);
    total = computed(() => this.items().reduce((s, i) => s + i.price * (1 - i.discount) * 1.2, 0));
  }
  ```
- **Exemple ✅** :
  ```ts
  export class CartPage {
    private readonly cart = inject(CartService);
    protected readonly total = this.cart.total;
  }
  ```
- **Source** : SRP / clean architecture — couches application.

### R-ARCH-017 — RxJS : `takeUntilDestroyed` ou `async` pipe

> **v2 — sévérité** : 🔴 BLOCKER pour une source qui ne se termine pas (`valueChanges`, `interval`, événements du router, store) ; 🟡 MINOR pour un appel `HttpClient`, qui complète après une émission.
- **Sévérité** : 🔴 BLOCKER
- **Quoi vérifier** : tout `.subscribe()` dans un composant doit être unsubscribed via `takeUntilDestroyed()` (Angular 16+) ou via `async` pipe ; sinon fuite mémoire.
- **Pattern à flag** : `.subscribe(...)` dans un composant sans `takeUntilDestroyed()`, sans `take(1)`/`first()`, et sans gestion de cleanup.
- **Exemple ❌** :
  ```ts
  ngOnInit() {
    this.dataService.stream$.subscribe(d => this.data = d);
  }
  ```
- **Exemple ✅** :
  ```ts
  ngOnInit() {
    this.dataService.stream$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(d => this.data.set(d));
  }
  ```
- **Source** : RxJS hygiene — angular.dev/api/core/DestroyRef.

### R-ARCH-018 — Préférer signals à `BehaviorSubject` pour l'état local
- **Sévérité** : 🟠 MAJOR
- **Quoi vérifier** : pour l'état local d'un composant ou d'un service simple, utiliser `signal()` / `computed()` plutôt que `BehaviorSubject`.
- **Pattern à flag** : `private state$ = new BehaviorSubject(...)` exposé via `asObservable()` pour de l'état synchrone.
- **Exemple ❌** :
  ```ts
  private readonly count$ = new BehaviorSubject(0);
  readonly count = this.count$.asObservable();
  increment() { this.count$.next(this.count$.value + 1); }
  ```
- **Exemple ✅** :
  ```ts
  private readonly _count = signal(0);
  readonly count = this._count.asReadonly();
  increment() { this._count.update(n => n + 1); }
  ```
- **Source** : angular.dev/guide/signals.

### R-ARCH-019 — Pas de mutation d'objet input avec OnPush
- **Sévérité** : 🟠 MAJOR
- **Quoi vérifier** : ne jamais muter un objet/tableau d'input ; toujours créer une nouvelle référence.
- **Pattern à flag** : `this.user.name = 'x'`, `this.items.push(...)` sur un input.
- **Exemple ❌** :
  ```ts
  addItem(it: Item) { this.items().push(it); }
  ```
- **Exemple ✅** :
  ```ts
  addItem(it: Item) { this.items.update(arr => [...arr, it]); }
  ```
- **Source** : angular.dev/best-practices/skipping-subtrees.

### R-ARCH-020 — Taille de fichier raisonnable (~300 lignes)
- **Sévérité** : 🟡 MINOR
- **Quoi vérifier** : un composant ou service dépassant ~300 lignes doit être découpé (sous-composants, services dédiés).
- **Pattern à flag** : fichier `.ts` > 300 lignes, classe avec > 15 méthodes publiques.
- **Exemple ❌** :
  ```ts
  // booking-page.ts — 700 lignes, 25 méthodes
  ```
- **Exemple ✅** :
  ```ts
  // booking-page.ts (orchestration, ~150 lignes)
  // booking-form.ts, booking-summary.ts, booking.service.ts
  ```
- **Source** : Clean code — taille des unités.

### R-ARCH-021 — Pas de code mort
- **Sévérité** : 🟡 MINOR
- **Quoi vérifier** : pas d'imports inutilisés, de variables non lues, de méthodes privées jamais appelées, de code commenté.
- **Pattern à flag** : blocs de code en commentaire (`/* ... */`), imports non référencés, méthodes `private` non utilisées.
- **Exemple ❌** :
  ```ts
  // const oldUrl = '/api/v1/users';
  private unusedHelper() { return 42; }
  ```
- **Exemple ✅** : suppression du code mort.
- **Source** : Clean code — dead code.

### R-ARCH-022 — Pas de `console.log` en production

> **v2 — alias** : `R-ERR-009` décrit la même chose. Toujours rapporter sous `R-ARCH-022`.
> **v2 — sévérité** : 🟡 MINOR au lieu de 🟠 MAJOR. Un log résiduel n'est pas un bug ; il ne doit pas compter dans le seuil « 3 MAJOR → REQUEST_CHANGES ». Il redevient MAJOR s'il journalise une donnée sensible (voir R-SEC-019).
- **Sévérité** : 🟡 MINOR (🟠 MAJOR si une donnée sensible est journalisée)
- **Quoi vérifier** : aucun `console.log` / `console.debug` ne doit subsister hors d'un service de logging dédié.
- **Pattern à flag** : `console.log(`, `console.debug(`, `console.warn(` dans le code applicatif.
- **Exemple ❌** :
  ```ts
  saveUser() {
    console.log('saving', this.user());
    this.api.save(this.user()).subscribe();
  }
  ```
- **Exemple ✅** :
  ```ts
  private readonly logger = inject(LoggerService);
  saveUser() {
    this.logger.debug('saving', this.user());
    this.api.save(this.user()).subscribe();
  }
  ```
- **Source** : Clean code — production hygiene.

### R-ARCH-023 — TODO datés et traçables
- **Sévérité** : 🔵 INFO
- **Quoi vérifier** : tout `TODO` / `FIXME` doit être daté, signé ou référencer un ticket.
- **Pattern à flag** : `// TODO` sans contexte ni ticket.
- **Exemple ❌** :
  ```ts
  // TODO: refactor this
  ```
- **Exemple ✅** :
  ```ts
  // TODO(JIRA-1234, 2026-05-05): extraire la logique de pricing dans PricingService
  ```
- **Source** : Clean code — commentaires.

### R-ARCH-024 — DRY sans abstraction prématurée
- **Sévérité** : 🟡 MINOR
- **Quoi vérifier** : factoriser un comportement dupliqué (≥3 occurrences) dans une fonction utilitaire ou un service ; ne pas créer d'abstraction au premier doublon.
- **Pattern à flag** : même bloc de 5+ lignes répété ≥ 3 fois dans le diff ; à l'inverse, abstraction générique introduite pour un seul usage.
- **Exemple ❌** :
  ```ts
  // dans 3 composants : même bloc de formattage de date inline (15 lignes)
  ```
- **Exemple ✅** :
  ```ts
  // shared/date-format.util.ts
  export function formatBookingDate(d: Date): string { ... }
  ```
- **Source** : Clean code — Rule of Three / DRY.

### R-ARCH-025 — Imports propres et ordonnés
- **Sévérité** : 🔵 INFO
- **Quoi vérifier** : imports groupés (Angular, tiers, alias internes, relatifs), pas de doublons, pas d'imports profonds quand un index existe.
- **Pattern à flag** : imports désorganisés, imports `../../../` excessifs (>3 niveaux).
- **Exemple ❌** :
  ```ts
  import { UserService } from '../../../core/services/user.service';
  import { Component } from '@angular/core';
  import { LoggerService } from './logger';
  ```
- **Exemple ✅** :
  ```ts
  import { Component } from '@angular/core';

  import { UserService } from '@app/core';
  import { LoggerService } from './logger';
  ```
- **Source** : Clean code — readability.

### R-ARCH-026 — Cohérence intra-fichier prioritaire
- **Sévérité** : 🔵 INFO
- **Quoi vérifier** : si un fichier existant utilise un style ancien mais cohérent (ex. `constructor` partout), une PR ne doit pas mélanger les deux styles ; soit refactor complet, soit alignement sur l'existant.
- **Pattern à flag** : moitié `inject()` + moitié `constructor` dans le même fichier après modification.
- **Exemple ❌** :
  ```ts
  export class Page {
    constructor(private a: A) {}
    private readonly b = inject(B);
  }
  ```
- **Exemple ✅** : aligner les deux sur le même style.
- **Source** : angular.dev/style-guide — Principe général.

### R-ARCH-027 — Inputs renommés et outputs nommés comme des événements natifs

- **Sévérité** : 🟠 MAJOR (output au nom natif) · 🟡 MINOR (alias d'input)
- **Quoi vérifier** : un output nommé `click`, `submit`, `change`… cohabite avec l'événement DOM natif du même nom, qui bulle : le handler du parent peut se déclencher deux fois (par exemple dès qu'on ajoute un `<form>`). Un alias d'input crée deux noms pour une même donnée.
- **Pattern à flag** : `output({ alias: 'submit' })`, `submit = output<…>()`, `@Output() change`, `input(…, { alias: '…' })`, `@Input('…')`.
- **Exemple ❌** :
  ```ts
  readonly search = output<string>({ alias: 'submit' });
  ```
- **Exemple ✅** :
  ```ts
  readonly searchSubmitted = output<string>();
  ```
- **Source** : <https://angular.dev/guide/components/outputs> · règles angular-eslint `no-output-native`, `no-input-rename`, `no-output-rename`

### R-ARCH-028 — Control flow natif (`@if`, `@for`, `@switch`)

- **Sévérité** : 🟡 MINOR
- **Quoi vérifier** : `NgIf`, `NgFor` et `NgSwitch` sont dépréciés depuis Angular 20. Le nouveau code utilise le control flow natif, plus rapide, mieux typé, et `@for` impose un `track`.
- **Pattern à flag** : `*ngIf`, `*ngFor`, `*ngSwitchCase`, `[ngSwitch]` dans un template ajouté ou modifié.
- **Exemple ❌** : `<li *ngFor="let t of talks">{{ t.title }}</li>`
- **Exemple ✅** : `@for (t of talks(); track t.id) { <li>{{ t.title }}</li> } @empty { <li>Aucun talk</li> }`
- **Migration** : `ng generate @angular/core:control-flow`
- **Source** : <https://angular.dev/guide/templates/control-flow>

### R-ARCH-029 — Pas de `any` explicite

- **Sévérité** : 🟡 MINOR
- **Quoi vérifier** : `any` désactive le typage strict et, par ricochet, le type-checking des templates qui consomment la valeur.
- **Pattern à flag** : `: any`, `as any`, `<any>`, `any[]` dans le code ajouté (hors tests).
- **Exemple ❌** : `speakers: any[] = [];`
- **Exemple ✅** : `speakers = signal<Speaker[]>([]);` ou `unknown` + type guard.
- **Source** : <https://angular.dev/tools/cli/template-typecheck>

### R-ARCH-030 — URL d'API codée en dur

- **Sévérité** : 🟡 MINOR
- **Quoi vérifier** : une URL absolue en dur casse dès qu'on change d'environnement et contourne un éventuel intercepteur de base URL.
- **Pattern à flag** : `'http://…'` / `'https://…'` dans un service ou un composant.
- **Exemple ❌** : `this.http.get('http://localhost:3000/api/talks')`
- **Exemple ✅** :
  ```ts
  export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL');
  private readonly baseUrl = inject(API_BASE_URL);
  readonly talks = httpResource<Talk[]>(() => `${this.baseUrl}/talks`);
  ```
- **Source** : <https://angular.dev/guide/di/defining-dependency-providers>

### R-ARCH-031 — Formulaires typés

- **Sévérité** : 🟡 MINOR
- **Quoi vérifier** : `UntypedFormGroup`, `UntypedFormControl`, `UntypedFormBuilder` rendent toutes les valeurs `any`.
- **Exemple ❌** : `form = new UntypedFormGroup({ title: new UntypedFormControl('') });`
- **Exemple ✅** : `form = inject(NonNullableFormBuilder).group({ title: ['', Validators.required] });` — ou les Signal Forms (`@angular/forms/signals`) sur un nouveau formulaire.
- **Source** : <https://angular.dev/guide/forms/typed-forms>

### R-ARCH-032 — Guards et resolvers fonctionnels

- **Sévérité** : 🟡 MINOR
- **Quoi vérifier** : les guards/resolvers à base de classe (`implements CanActivate`, `Resolve<T>`) **ne sont pas dépréciés**, mais les fonctions (`CanActivateFn`, `ResolveFn`) sont l'idiome actuel : moins de code, `inject()` direct, composition simple. Seul `canLoad` est déprécié (remplacé par `canMatch`). Ne signaler que dans du code neuf.
- **Exemple ❌** : `export class AuthGuard implements CanActivate { canActivate() { … } }`
- **Exemple ✅** : `export const authGuard: CanActivateFn = () => inject(AuthService).isLoggedIn();`
- **Source** : <https://angular.dev/guide/routing/route-guards>

### R-ARCH-033 — `host: {}` plutôt que `@HostListener` / `@HostBinding`

- **Sévérité** : 🔵 INFO
- **Quoi vérifier** : `@HostListener`/`@HostBinding` ne sont pas dépréciés, mais le style guide et les bonnes pratiques officielles demandent la propriété `host` des métadonnées : tout le contrat DOM de l'hôte est visible au même endroit.
- **Exemple ❌** : `@HostListener('keydown.escape') close() { … }`
- **Exemple ✅** : `host: { '(keydown.escape)': 'close()', '[class.open]': 'isOpen()' }`
- **Source** : <https://angular.dev/style-guide>

### R-ARCH-034 — `@Service()` pour les services racine (Angular ≥ 22)

- **Sévérité** : 🔵 INFO (nouveau code uniquement)
- **Quoi vérifier** : depuis Angular 22, `@Service()` équivaut à `@Injectable({ providedIn: 'root' })` pour un service qui utilise `inject()`. `ng g service` le génère par défaut. Garder `@Injectable` pour l'injection par constructeur, `useClass`/`useFactory` ou une portée non racine.
- **Exemple ✅** : `@Service() export class TalksStore { private readonly http = inject(HttpClient); }`
- **Migration** : `ng generate @angular/core:service`
- **Source** : <https://angular.dev/guide/di/creating-and-using-services>

### R-ARCH-035 — Animations sans `@angular/animations`

- **Sévérité** : 🟡 MINOR (🟠 MAJOR dans un projet qui vise la v23)
- **Quoi vérifier** : `@angular/animations`, `provideAnimations()` et `BrowserAnimationsModule` sont dépréciés depuis la v20.2 ; leur retrait est prévu en v23.
- **Exemple ✅** : `<div animate.enter="fade-in" animate.leave="fade-out">` avec des keyframes CSS.
- **Source** : <https://angular.dev/guide/animations>

---

## Checklist finale
- [ ] R-ARCH-001 — kebab-case sur tous les fichiers
- [ ] R-ARCH-002 — suffixe `.spec.ts` colocalisé
- [ ] R-ARCH-003 — nom de fichier = identifiant principal
- [ ] R-ARCH-004 — pas de `helpers.ts` / `utils.ts` génériques
- [ ] R-ARCH-005 — organisation par domaine fonctionnel
- [ ] R-ARCH-006 — un fichier = un concept
- [ ] R-ARCH-007 — `inject()` plutôt que `constructor`
- [ ] R-ARCH-008 — `protected` pour membres lus en template
- [ ] R-ARCH-009 — `readonly` pour `input` / `model` / `output` / queries
- [ ] R-ARCH-010 — composants standalone
- [ ] R-ARCH-011 — templates simples (computed / méthodes)
- [ ] R-ARCH-012 — `[class.x]` / `[style.x]` plutôt que `[ngClass]` / `[ngStyle]`
- [ ] R-ARCH-013 — handlers nommés par l'action
- [ ] R-ARCH-014 — hooks de cycle de vie courts + `implements`
- [ ] R-ARCH-015 — séparation smart vs dumb
- [ ] R-ARCH-016 — pas de logique métier dans les composants
- [ ] R-ARCH-017 — `takeUntilDestroyed` / `async` pipe
- [ ] R-ARCH-018 — signals plutôt que `BehaviorSubject` pour l'état local
- [ ] R-ARCH-019 — pas de mutation d'input (OnPush-safe)
- [ ] R-ARCH-020 — taille de fichier ≤ ~300 lignes
- [ ] R-ARCH-021 — pas de code mort
- [ ] R-ARCH-022 — pas de `console.log` résiduel
- [ ] R-ARCH-023 — TODO datés / ticketés
- [ ] R-ARCH-024 — DRY sans sur-abstraction
- [ ] R-ARCH-025 — imports propres et ordonnés
- [ ] R-ARCH-026 — cohérence intra-fichier respectée
- [ ] R-ARCH-034 — `@Service()` (v22+, nouveau code)
- [ ] R-ARCH-035 — Pas d'animations legacy

---

## Format de sortie

Le format des findings est défini **une seule fois**, dans [`REVIEWER_PROMPT.md`](REVIEWER_PROMPT.md) (champs `ruleId`, `severity`, `domain`, `file`, `line`, `snippet`, `message`, `suggestion`, `source`, `evidence`). Ne pas en inventer un autre ici : `scripts/findings.mjs merge` rejette tout finding qui ne respecte pas ce contrat.

- Une entrée par occurrence ; toujours citer le code exact (`snippet`) : il est vérifié contre le fichier.
- N'utiliser que des `ruleId` présents dans ce fichier (ou `R-PROJ-*` pour les règles projet).
- Une règle qui ne s'applique pas à ce projet (version, SSR absent…) ne produit aucun finding.
