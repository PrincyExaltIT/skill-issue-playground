---
name: angular-a11y-error-reviewer
description: Audit accessibilité (ARIA, focus, live regions) et gestion d'erreurs (try/catch, ErrorHandler global, RxJS catchError).
domain: a11y-errors
rule_prefix: R-A11Y, R-ERR
applies_to:
  - "**/*.ts"
  - "**/*.html"
severity_levels: [BLOCKER, MAJOR, MINOR, INFO]
output_format: json
parallel_safe: true
sources:
  - https://angular.dev/best-practices/a11y
  - https://angular.dev/best-practices/error-handling
---

# Reviewer Guideline — Accessibilité & Gestion d'erreurs Angular

## But

Ce document fournit à l'agent reviewer un référentiel actionnable de règles pour auditer toute modification de code Angular sur deux axes : l'accessibilité (a11y) et la gestion des erreurs. Chaque règle contient un identifiant, une sévérité, un pattern à détecter et des exemples concrets pour produire des findings exploitables. L'agent reviewer doit appliquer ces règles aux diffs/fichiers fournis et émettre des findings au format défini en fin de document.

## Niveaux de sévérité

- 🔴 **BLOCKER** — bug a11y bloquant un utilisateur (lecteur d'écran, clavier) ou erreur silencieusement avalée mettant en danger l'app. À corriger avant merge.
- 🟠 **MAJOR** — non-respect d'une bonne pratique officielle Angular avec impact utilisateur clair (focus perdu, erreur loggée mais non gérée). À corriger sauf justification explicite.
- 🟡 **MINOR** — écart cosmétique ou défensif (catch trop générique, ARIA statique inutile sur un binding). À corriger en règle générale.
- 🔵 **INFO** — note ou suggestion d'amélioration, pas de blocage.

---

## PARTIE 1 — Accessibilité

### Règles à vérifier

### R-A11Y-001 — ARIA dynamique via `[attr.aria-*]`
- **Sévérité** : 🔴 BLOCKER
- **Quoi vérifier** : tout attribut ARIA dont la valeur est issue d'une expression (signal, propriété, ternaire) doit utiliser le binding d'attribut `[attr.aria-*]` et non un attribut HTML littéral avec interpolation.
- **Pattern à flag** : présence de `aria-label="{{ ... }}"`, `aria-describedby="{{ ... }}"`, ou plus largement tout attribut `aria-*=` contenant `{{` `}}`.
- **Exemple ❌** :
```html
<button aria-label="{{ myActionLabel }}">Save</button>
```
- **Exemple ✅** :
```html
<button [attr.aria-label]="myActionLabel">Save</button>
```
- **Source** : https://angular.dev/best-practices/a11y

### R-A11Y-002 — ARIA statique sans binding inutile
- **Sévérité** : 🟡 MINOR
- **Quoi vérifier** : pour des libellés ARIA constants, préférer l'attribut HTML standard (statique) plutôt qu'un binding d'attribut, plus simple et plus performant.
- **Pattern à flag** : `[attr.aria-label]="'Save document'"` ou autre binding d'attribut dont la valeur est une chaîne littérale figée.
- **Exemple ❌** :
```html
<button [attr.aria-label]="'Save document'">…</button>
```
- **Exemple ✅** :
```html
<button aria-label="Save document">…</button>
```
- **Source** : https://angular.dev/best-practices/a11y

### R-A11Y-003 — Casse HTML vs propriété (`tabindex` / `tabIndex`)
- **Sévérité** : 🟠 MAJOR
- **Quoi vérifier** : les attributs HTML doivent être en minuscules (`tabindex`, `aria-label`) ; les propriétés DOM en camelCase (`tabIndex`, `ariaLabel`). Un `[tabindex]` (binding de propriété) ou un attribut littéral `tabIndex="0"` est invalide.
- **Pattern à flag** : `tabIndex="…"` (attribut HTML camelCase), `[tabindex]="…"` quand on lie une propriété (devrait être `[tabIndex]`).
- **Exemple ❌** :
```html
<div tabIndex="0"></div>
<div [tabindex]="0"></div>
```
- **Exemple ✅** :
```html
<div tabindex="0"></div>
<div [tabIndex]="0"></div>
```
- **Source** : https://angular.dev/best-practices/a11y

### R-A11Y-004 — Références ARIA structurées synchronisées (`ariaLabelledByElements`)
- **Sévérité** : 🟠 MAJOR
- **Quoi vérifier** : les valeurs ARIA structurées (tableaux d'éléments) doivent passer par un binding de propriété et la liste de références doit rester en phase avec les éléments réellement présents (queries `viewChild` / `contentChild`, IDs dans le DOM).
- **Pattern à flag** : `aria-labelledby` lié à une chaîne d'IDs construite à la main alors que les éléments sont déjà disponibles via queries ; références orphelines vers des IDs absents du DOM.
- **Exemple ❌** :
```html
<div role="dialog" [attr.aria-labelledby]="titleId + ' ' + descId"></div>
```
- **Exemple ✅** :
```html
<div role="dialog" [ariaLabelledByElements]="[dialogTitle(), dialogDescription()]"></div>
```
- **Source** : https://angular.dev/best-practices/a11y

### R-A11Y-005 — Réutiliser les éléments natifs interactifs
- **Sévérité** : 🔴 BLOCKER
- **Quoi vérifier** : tout élément cliquable, focusable ou de saisie doit utiliser l'élément HTML natif correspondant (`<button>`, `<a>`, `<input>`, `<select>`, `<label>`) plutôt qu'un `<div>`/`<span>` réimplémentant le comportement.
- **Pattern à flag** : `<div (click)=...>`, `<span (click)=...>`, faux bouton avec `role="button"` + `tabindex="0"` au lieu de `<button>`, lien fait de `<div (click)=router.navigate(...)>`.
- **Exemple ❌** :
```html
<div role="button" tabindex="0" (click)="save()">Save</div>
```
- **Exemple ✅** :
```html
<button type="button" (click)="save()">Save</button>
```
- **Source** : https://angular.dev/best-practices/a11y

### R-A11Y-006 — Sélecteurs d'attribut sur éléments natifs
- **Sévérité** : 🟡 MINOR
- **Quoi vérifier** : pour étendre le comportement d'un élément natif, préférer un sélecteur d'attribut (ex. `selector: 'button[appPrimary]'`) plutôt que de créer un composant standalone qui réimplémente l'élément.
- **Pattern à flag** : composant `selector: 'app-button'` qui rend un `<button>` interne sans projection ; perte des attributs natifs (`type`, `disabled`, `form`).
- **Exemple ❌** :
```ts
@Component({ selector: 'app-button', template: `<button><ng-content/></button>` })
export class AppButton {}
```
- **Exemple ✅** :
```ts
@Directive({ selector: 'button[appPrimary]' })
export class AppPrimary {}
```
- **Source** : https://angular.dev/best-practices/a11y

### R-A11Y-007 — Wrappers via projection de contenu
- **Sévérité** : 🟠 MAJOR
- **Quoi vérifier** : les composants qui décorent un contrôle natif (form-field, input wrapper) doivent **projeter** le contrôle natif (`<ng-content>`) plutôt que de le générer eux-mêmes, afin de préserver les attributs ARIA, `id`, `name`, `disabled`, etc.
- **Pattern à flag** : composant wrapper qui ne contient pas de `<ng-content>` et expose des `@Input` pour recopier `placeholder`, `value`, `type` vers un input interne.
- **Exemple ❌** :
```html
<!-- app-form-field.html -->
<label>{{ label }}</label>
<input [type]="type" [placeholder]="placeholder" />
```
- **Exemple ✅** :
```html
<!-- mat-form-field-style -->
<mat-form-field>
  <mat-label>Name</mat-label>
  <input matInput [formControl]="name" />
</mat-form-field>
```
- **Source** : https://angular.dev/best-practices/a11y

### R-A11Y-008 — Focus mis à jour après navigation router
- **Sévérité** : 🔴 BLOCKER
- **Quoi vérifier** : après un `NavigationEnd`, le focus ne doit pas retomber sur `<body>`. Il doit être déplacé sur le titre/landmark principal de la nouvelle vue.
- **Pattern à flag** : `RouterOutlet` utilisé sans abonnement à `router.events` pour repositionner le focus, et pas d'usage de `cdkFocusInitial` / `LiveAnnouncer` côté composant cible.
- **Exemple ❌** :
```ts
// aucun focus management après navigation
this.router.navigate(['/profile']);
```
- **Exemple ✅** :
```ts
this.router.events
  .pipe(filter(e => e instanceof NavigationEnd))
  .subscribe(() => {
    this.document.querySelector<HTMLElement>('#main-content-header')?.focus();
  });
```
- **Source** : https://angular.dev/best-practices/a11y

### R-A11Y-009 — `routerLink` + `ariaCurrentWhenActive`
- **Sévérité** : 🟠 MAJOR
- **Quoi vérifier** : tout lien de navigation principal (menu, nav, breadcrumb) doit indiquer l'état courant via `ariaCurrentWhenActive` (et non un simple `routerLinkActive` purement visuel).
- **Pattern à flag** : `<a routerLink="…" routerLinkActive="active">` sans `ariaCurrentWhenActive`.
- **Exemple ❌** :
```html
<a routerLink="home" routerLinkActive="active">Home</a>
```
- **Exemple ✅** :
```html
<a routerLink="home" routerLinkActive="active" ariaCurrentWhenActive="page">Home</a>
```
- **Source** : https://angular.dev/best-practices/a11y

### R-A11Y-010 — `@defer` enveloppé dans une live region
- **Sévérité** : 🟠 MAJOR
- **Quoi vérifier** : les blocs `@defer` qui injectent du contenu après le chargement initial doivent être encapsulés dans un conteneur `aria-live` (`polite` ou `assertive`) afin que les lecteurs d'écran annoncent le changement.
- **Pattern à flag** : `@defer (on …) { … }` non entouré d'un parent porteur d'`aria-live`.
- **Exemple ❌** :
```html
@defer (on viewport) {
  <user-profile />
}
```
- **Exemple ✅** :
```html
<div aria-live="polite" aria-atomic="true">
  @defer (on viewport) {
    <user-profile />
  }
</div>
```
- **Source** : https://angular.dev/best-practices/a11y

### R-A11Y-011 — Utiliser Angular Material / `@angular/cdk/a11y` pour les patterns complexes
- **Sévérité** : 🟡 MINOR
- **Quoi vérifier** : les besoins (annonces dynamiques, modale, menu, listbox) doivent s'appuyer sur Angular Material ou `@angular/cdk/a11y` (`LiveAnnouncer`, `cdkTrapFocus`, `FocusMonitor`) plutôt que sur des implémentations maison.
- **Pattern à flag** : appels manuels à `setAttribute('aria-live', …)`, focus piégé "à la main" via `keydown` listeners au lieu de `cdkTrapFocus`.
- **Exemple ❌** :
```ts
this.statusEl.nativeElement.setAttribute('aria-live', 'polite');
this.statusEl.nativeElement.textContent = 'Saved';
```
- **Exemple ✅** :
```ts
private readonly liveAnnouncer = inject(LiveAnnouncer);
this.liveAnnouncer.announce('Saved', 'polite');
```
- **Source** : https://angular.dev/best-practices/a11y

### R-A11Y-012 — Piégeage de focus dans les modales/dialogues
- **Sévérité** : 🔴 BLOCKER
- **Quoi vérifier** : tout dialogue/modale/menu doit piéger le focus tant qu'il est ouvert et le restaurer sur l'élément déclencheur à la fermeture.
- **Pattern à flag** : composant de dialogue custom sans `cdkTrapFocus`, sans `MatDialog`, et sans logique de restauration de focus.
- **Exemple ❌** :
```html
<div class="modal"> <!-- dans un @if (open()) { … } -->
  <h2>Confirm</h2>
  <button (click)="open = false">Close</button>
</div>
```
- **Exemple ✅** :
```html
<div class="modal" cdkTrapFocus cdkTrapFocusAutoCapture> <!-- dans un @if (open()) { … } -->
  <h2 #title tabindex="-1">Confirm</h2>
  <button (click)="close()">Close</button>
</div>
```
- **Source** : https://angular.dev/best-practices/a11y

### R-A11Y-013 — Labels associés aux contrôles de formulaire
- **Sévérité** : 🔴 BLOCKER
- **Quoi vérifier** : tout `<input>`, `<select>`, `<textarea>` doit avoir un libellé accessible via `<label for>`, `aria-label`, `aria-labelledby` ou un wrapper Material (`mat-label`).
- **Pattern à flag** : `<input>` sans `<label>` associé ni attribut ARIA, placeholder utilisé comme seul libellé.
- **Exemple ❌** :
```html
<input type="email" placeholder="Email" />
```
- **Exemple ✅** :
```html
<label for="email">Email</label>
<input id="email" type="email" />
```
- **Source** : https://angular.dev/best-practices/a11y

### R-A11Y-014 — Alternative textuelle des images

- **Sévérité** : 🟠 MAJOR (absente) · 🟡 MINOR (présente mais inutile)
- **Quoi vérifier** : toute `<img>` a un `alt`. Une image informative a un `alt` qui dit ce qu'elle apporte ; une image décorative a `alt=""`. Un `alt` générique (`"image"`, `"Card image"`, nom de fichier) ne vaut guère mieux qu'un `alt` absent.
- **Pattern à flag** : `<img` sans `alt` / `[alt]` / `[attr.alt]` ; `alt` identique sur des images différentes d'une liste.
- **Exemple ❌** : `<img [src]="card.image" alt="Card image">`
- **Exemple ✅** : `<img [ngSrc]="card.image" width="320" height="480" [alt]="card.name + ', ' + card.hp + ' points de vie'">`
- **Source** : <https://angular.dev/best-practices/a11y> · WCAG 1.1.1

---

## PARTIE 2 — Gestion d'erreurs

### R-ERR-001 — Gestion locale au callsite (`try/catch` ou `catchError`)
- **Sévérité** : 🔴 BLOCKER
- **Quoi vérifier** : tout appel asynchrone (await, promesse, observable) doit gérer ses erreurs **au plus près du callsite** pour conserver le contexte. Pas de remontée silencieuse vers `ErrorHandler` comme stratégie principale.
- **Pattern à flag** : `await fetchX()` sans `try/catch`, `httpClient.get(...).subscribe(next)` sans `error` callback ni `catchError`, `.then(...)` sans `.catch(...)`.
- **Exemple ❌** :
```ts
async load() {
  const user = await this.api.fetchUser();
  this.user.set(user);
}
```
- **Exemple ✅** :
```ts
async load() {
  try {
    this.user.set(await this.api.fetchUser());
  } catch (error) {
    this.errorState.set('Impossible de charger le profil.');
    this.logger.error('fetchUser failed', error);
  }
}
```
- **Source** : https://angular.dev/best-practices/error-handling

### R-ERR-002 — `ErrorHandler` global réservé au reporting
- **Sévérité** : 🟠 MAJOR
- **Quoi vérifier** : un `ErrorHandler` custom ne doit servir qu'au **reporting** (analytics, Sentry…) des erreurs non récupérables. Il ne doit pas porter la logique métier de récupération (toast utilisateur, retry, fallback) qui doit vivre au callsite.
- **Pattern à flag** : `ErrorHandler.handleError` qui ouvre une snackbar/route, fait un retry, ou contient une logique métier ; ou à l'inverse, code applicatif qui n'a aucun `try/catch`/`catchError` parce que « `ErrorHandler` s'en occupe ».
- **Exemple ❌** :
```ts
export class AppErrorHandler implements ErrorHandler {
  handleError(err: unknown) {
    this.snackBar.open('Erreur, on retente…');
    this.api.retryLastRequest();
  }
}
```
- **Exemple ✅** :
```ts
export class GlobalErrorHandler implements ErrorHandler {
  private readonly analytics = inject(AnalyticsService);
  handleError(error: unknown) {
    this.analytics.trackEvent({ eventName: 'exception', error });
  }
}
```
- **Source** : https://angular.dev/best-practices/error-handling

### R-ERR-003 — `provideBrowserGlobalErrorListeners()` activé
- **Sévérité** : 🟠 MAJOR
- **Quoi vérifier** : la configuration de l'application (`app.config.ts` ou `bootstrapApplication`) doit inclure `provideBrowserGlobalErrorListeners()` pour capturer les erreurs `window.error` et `unhandledrejection` qui atteindraient le scope global.
- **Pattern à flag** : `app.config.ts` qui ne référence pas `provideBrowserGlobalErrorListeners` alors qu'un `ErrorHandler` custom est déjà en place.
- **Exemple ❌** :
```ts
export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes), { provide: ErrorHandler, useClass: GlobalErrorHandler }],
};
```
- **Exemple ✅** :
```ts
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
  ],
};
```
- **Source** : https://angular.dev/best-practices/error-handling

### R-ERR-004 — Promesses : pas de `.then` sans `.catch`
- **Sévérité** : 🔴 BLOCKER
- **Quoi vérifier** : toute promesse hors d'un bloc `try/await` doit avoir une gestion explicite via `.catch(...)`. Les `unhandledrejection` ne doivent pas être la stratégie par défaut.
- **Pattern à flag** : `someService.save().then(...)` sans `.catch`, `Promise.all([...]).then(...)` sans `.catch`.
- **Exemple ❌** :
```ts
this.api.save(payload).then(result => this.update(result));
```
- **Exemple ✅** :
```ts
this.api.save(payload)
  .then(result => this.update(result))
  .catch(error => this.notify('Échec de sauvegarde', error));
```
- **Source** : https://angular.dev/best-practices/error-handling

### R-ERR-005 — Observables : `subscribe` avec `error` ou `catchError`
- **Sévérité** : 🔴 BLOCKER
- **Quoi vérifier** : tout `subscribe(...)` doit fournir un callback d'erreur, ou bien le pipeline doit contenir un opérateur de gestion (`catchError`, `retry`, `EMPTY`/`of` fallback). Idem pour les observables consommés via `AsyncPipe` : prévoir un `catchError` côté source.
- **Pattern à flag** : `obs$.subscribe(value => …)` (un seul callback), `obs$.subscribe({ next: … })` sans `error`, pas de `catchError` dans le pipe d'un service HTTP.
- **Exemple ❌** :
```ts
this.api.getUsers().subscribe(users => this.users.set(users));
```
- **Exemple ✅** :
```ts
this.api.getUsers()
  .pipe(catchError(err => {
    this.notify('Liste des utilisateurs indisponible');
    return of([] as User[]);
  }))
  .subscribe(users => this.users.set(users));
```
- **Source** : https://angular.dev/best-practices/error-handling

### R-ERR-006 — Pas de `catch` génériques qui masquent le contexte
- **Sévérité** : 🟠 MAJOR
- **Quoi vérifier** : un `catch` ne doit pas avaler silencieusement l'erreur ni la transformer en valeur générique sans logger ni propager le contexte. Pas de `catch {}` vide, pas de `catch(e) { return null; }` aveugle.
- **Pattern à flag** : `catch {}`, `catch (e) { /* ignore */ }`, `catchError(() => of(null))` sans log, ré-affectation à `undefined` sans feedback.
- **Exemple ❌** :
```ts
try {
  return await this.api.load();
} catch {
  return null;
}
```
- **Exemple ✅** :
```ts
try {
  return await this.api.load();
} catch (error) {
  this.logger.error('api.load failed', { error, userId: this.userId });
  throw new LoadFailedError('Profil indisponible', { cause: error });
}
```
- **Source** : https://angular.dev/best-practices/error-handling

### R-ERR-007 — Gestion HTTP centralisée (interceptors/services)
- **Sévérité** : 🟠 MAJOR
- **Quoi vérifier** : les erreurs `HttpClient` doivent être gérées dans le service ou un `HttpInterceptor` (mapping codes → erreurs métier, retry, refresh token). Pas de `console.error` répété dans chaque composant.
- **Pattern à flag** : composants qui appellent directement `httpClient.get(...)` et gèrent eux-mêmes 401/403/500, duplication de logique d'erreur HTTP dans plusieurs composants.
- **Exemple ❌** :
```ts
// dans un composant
this.http.get('/api/profile').subscribe({
  next: p => this.profile.set(p),
  error: e => { if (e.status === 401) this.router.navigate(['/login']); }
});
```
- **Exemple ✅** :
```ts
export const authInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401) inject(Router).navigate(['/login']);
      return throwError(() => err);
    }),
  );
```
- **Source** : https://angular.dev/best-practices/error-handling

### R-ERR-008 — Feedback utilisateur sur erreur (pas de silent swallow)
- **Sévérité** : 🟠 MAJOR
- **Quoi vérifier** : toute erreur impactant un parcours utilisateur doit produire un feedback visible (snackbar, message d'erreur dans le formulaire, état d'erreur du composant). Une erreur ne doit pas se contenter d'un log console.
- **Pattern à flag** : `catchError(err => { console.error(err); return EMPTY; })` sans état d'erreur exposé au template, formulaire qui reste silencieux après échec de submit.
- **Exemple ❌** :
```ts
submit() {
  this.api.save(this.form.value).subscribe({
    error: err => console.error(err),
  });
}
```
- **Exemple ✅** :
```ts
submit() {
  this.api.save(this.form.value).subscribe({
    next: () => this.snackBar.open('Enregistré'),
    error: err => {
      this.errorMessage.set('Sauvegarde impossible. Réessayez.');
      this.logger.error('save failed', err);
    },
  });
}
```
- **Source** : https://angular.dev/best-practices/error-handling

### R-ERR-009 — Pas de `console.log/error` résiduels en production

> **v2 — alias** : doublon de `R-ARCH-022`. Toujours rapporter sous `R-ARCH-022`.
- **Sévérité** : 🟡 MINOR
- **Quoi vérifier** : les `console.log`, `console.debug`, `console.warn` de debug ne doivent pas atterrir en production. Utiliser un service de logging (qui peut router vers `console` en dev et vers un backend en prod) et conserver les `console.error` uniquement à des points d'entrée dédiés.
- **Pattern à flag** : `console.log(...)` dans le code applicatif livré, `console.error` dispersé hors d'un service de logging ou d'un `ErrorHandler`.
- **Exemple ❌** :
```ts
loadUser() {
  console.log('loading user', this.id);
  return this.api.user(this.id);
}
```
- **Exemple ✅** :
```ts
loadUser() {
  this.logger.debug('loading user', { id: this.id });
  return this.api.user(this.id);
}
```
- **Source** : https://angular.dev/best-practices/error-handling

### R-ERR-010 — Erreurs synchrones non interceptées par Angular
- **Sévérité** : 🟠 MAJOR
- **Quoi vérifier** : ne pas s'attendre à ce qu'Angular intercepte automatiquement les erreurs synchrones du code applicatif (constructeurs, getters, computations). Ces erreurs doivent être protégées explicitement à leur callsite.
- **Pattern à flag** : opération hasardeuse (`JSON.parse`, accès à `localStorage`, parsing d'URL) au sein d'un constructeur ou d'un `computed` sans `try/catch`.
- **Exemple ❌** :
```ts
readonly prefs = computed(() => JSON.parse(localStorage.getItem('prefs')!));
```
- **Exemple ✅** :
```ts
readonly prefs = computed(() => {
  try {
    return JSON.parse(localStorage.getItem('prefs') ?? '{}');
  } catch (error) {
    this.logger.warn('prefs parse failed', error);
    return {};
  }
});
```
- **Source** : https://angular.dev/best-practices/error-handling

### R-ERR-011 — Préserver la cause originale (`cause` / re-throw typé)
- **Sévérité** : 🟡 MINOR
- **Quoi vérifier** : lors d'un re-throw, conserver l'erreur d'origine via `{ cause: error }` (ES2022) ou un type d'erreur dédié, pour ne pas perdre la stack et le contexte d'origine au niveau du reporter.
- **Pattern à flag** : `throw new Error('Boom')` dans un `catch (e)` sans propagation de `e`.
- **Exemple ❌** :
```ts
try { await op(); }
catch (e) { throw new Error('Op failed'); }
```
- **Exemple ✅** :
```ts
try { await op(); }
catch (error) { throw new OpFailedError('Op failed', { cause: error }); }
```
- **Source** : https://angular.dev/best-practices/error-handling

---

## Checklist finale (combinée)

Accessibilité :
- [ ] R-A11Y-001 — ARIA dynamique via `[attr.aria-*]`
- [ ] R-A11Y-002 — ARIA statique non bindé inutilement
- [ ] R-A11Y-003 — Casse `tabindex` (HTML) vs `tabIndex` (propriété)
- [ ] R-A11Y-004 — Références ARIA structurées synchronisées
- [ ] R-A11Y-005 — Éléments natifs interactifs (button/a/input)
- [ ] R-A11Y-006 — Sélecteurs d'attribut sur éléments natifs
- [ ] R-A11Y-007 — Wrappers via projection de contenu
- [ ] R-A11Y-008 — Focus repositionné après navigation
- [ ] R-A11Y-009 — `routerLink` + `ariaCurrentWhenActive`
- [ ] R-A11Y-010 — `@defer` dans une live region
- [ ] R-A11Y-011 — Angular Material / `@angular/cdk/a11y`
- [ ] R-A11Y-012 — Piégeage de focus dans les modales
- [ ] R-A11Y-013 — Labels associés à tous les contrôles
- [ ] R-A11Y-014 — `alt` utile sur chaque image

Gestion d'erreurs :
- [ ] R-ERR-001 — `try/catch` ou `catchError` au callsite
- [ ] R-ERR-002 — `ErrorHandler` global réservé au reporting
- [ ] R-ERR-003 — `provideBrowserGlobalErrorListeners()` activé
- [ ] R-ERR-004 — Promesses : `.catch` systématique
- [ ] R-ERR-005 — Observables : callback `error` ou `catchError`
- [ ] R-ERR-006 — Pas de `catch` génériques avalant le contexte
- [ ] R-ERR-007 — Gestion HTTP centralisée (services/interceptors)
- [ ] R-ERR-008 — Feedback utilisateur sur erreur
- [ ] R-ERR-009 — Pas de `console.log/error` en production
- [ ] R-ERR-010 — Erreurs synchrones explicitement protégées
- [ ] R-ERR-011 — Préserver la cause originale au re-throw

---

## Format de sortie

Le format des findings est défini **une seule fois**, dans [`REVIEWER_PROMPT.md`](REVIEWER_PROMPT.md) (champs `ruleId`, `severity`, `domain`, `file`, `line`, `snippet`, `message`, `suggestion`, `source`, `evidence`). Ne pas en inventer un autre ici : `scripts/findings.mjs merge` rejette tout finding qui ne respecte pas ce contrat.

- Une entrée par occurrence ; toujours citer le code exact (`snippet`) : il est vérifié contre le fichier.
- N'utiliser que des `ruleId` présents dans ce fichier (ou `R-PROJ-*` pour les règles projet).
- Une règle qui ne s'applique pas à ce projet (version, SSR absent…) ne produit aucun finding.
