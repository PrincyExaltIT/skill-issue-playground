# Angular 22 : composants, templates, routes, formulaires

En Angular 22, les composants sont standalone, OnPush est le mode par défaut et l'application est zoneless. Les conventions de `AGENTS.md` priment sur ces règles.

### NG-01 · Directive structurelle `*ngIf`, `*ngFor`, `*ngSwitch` — MINOR
**Pourquoi** : dépréciées depuis Angular 20 au profit du control flow natif, plus lisible et mieux typé.
**À repérer** : `*ngIf`, `*ngFor`, `*ngSwitch`, ou `NgIf` / `NgFor` dans les imports d'un composant.
**Correction** : `@if (x) { … } @else { … }`, `@for (talk of talks(); track talk.id) { … }`, `@switch`.

### NG-02 · Décorateurs `@Input` / `@Output` — MINOR
**Pourquoi** : `input()`, `output()` et `model()` sont des signals : lecture réactive, `required` typé, plus d'`EventEmitter`.
**À repérer** : `@Input(`, `@Output(`, `new EventEmitter`.
**Correction** : `readonly speakerId = input.required<string>();` et `readonly talkSelected = output<string>();`

### NG-03 · Injection par constructeur — MINOR
**Pourquoi** : `inject()` est la convention du projet ; il fonctionne aussi dans les fonctions (guards, resolvers).
**À repérer** : `constructor(private http: HttpClient)`.
**Correction** : `private readonly http = inject(HttpClient);`

### NG-04 · Type `any` — MINOR
**Pourquoi** : `any` coupe le typage strict : l'erreur passe la compilation et casse à l'exécution.
**À repérer** : `: any`, `any[]`, `Observable<any>`, `as any`.
**Correction** : une interface du domaine (`Speaker`, `Talk`), ou `unknown` suivi d'un contrôle.

### NG-05 · Trace de débogage oubliée — MINOR
**À repérer** : `console.log`, `console.debug`, `debugger`.
**Correction** : supprimer, ou passer par le service de log du projet.

### NG-06 · `output()` nommé comme un événement DOM — MAJOR
**Pourquoi** : un output `select`, `click`, `change`, `submit`, `input`, `focus` ou `blur` se confond avec l'événement natif du même nom : le parent reçoit les deux, ou le mauvais.
**À repérer** : `output()` ou `@Output()` dont le nom est un événement DOM.
**Correction** : nommer l'intention : `talkSelected`, `favoriteToggled`.

### NG-07 · Détection de changement forcée en `Eager` — MAJOR
**Pourquoi** : depuis Angular 22, OnPush est le défaut et `ChangeDetectionStrategy.Eager` remplace l'ancien `Default`. Forcer `Eager` fait vérifier le composant à chaque cycle : c'est un choix à justifier.
**À repérer** : `ChangeDetectionStrategy.Eager` ou `ChangeDetectionStrategy.Default`. Un composant sans `changeDetection` est déjà en OnPush : rien à signaler.
**Correction** : retirer la ligne, ou justifier le besoin dans un commentaire.

### NG-08 · Méthode avec arguments appelée dans un template — MINOR
**Pourquoi** : la méthode est réexécutée à chaque détection de changement.
**À repérer** : `{{ format(item.date) }}`, `[class.active]="isActive(item)"`. Lire un signal, `{{ count() }}`, n'est pas un appel de méthode.
**Correction** : un `computed()`, une valeur préparée, ou un pipe pur.

### NG-09 · Formulaire non typé — MINOR
**Pourquoi** : `UntypedFormGroup` renvoie des `any`. Un formulaire typé (ou Signal Forms, stable en v22) attrape l'erreur à la compilation.
**À repérer** : `UntypedFormBuilder`, `UntypedFormGroup`, `UntypedFormControl`.
**Correction** : `inject(FormBuilder).nonNullable.group({ … })`, ou `form()` de Signal Forms.

### NG-10 · Guard ou resolver écrit en classe — MINOR
**Pourquoi** : les interfaces `CanActivate`, `CanMatch`, `Resolve` en classe sont dépréciées ; une fonction est plus courte et se teste seule.
**À repérer** : `implements CanActivate`, `implements Resolve`.
**Correction** : `export const proposalsOpen: CanActivateFn = () => …`

### NG-11 · Page chargée d'emblée — MAJOR
**Pourquoi** : `component:` met la page dans le bundle initial alors que les autres routes du projet sont chargées à la demande.
**À repérer** : une nouvelle route avec `component:` au lieu de `loadComponent:`.
**Correction** : `loadComponent: () => import('./speakers/speaker-spotlight').then((m) => m.SpeakerSpotlight)`.

### NG-12 · Utilitaire dupliqué — MINOR
**À repérer** : une fonction qui refait ce qu'un utilitaire du projet fait déjà (initiales, dates, formatage).
**Correction** : importer l'utilitaire existant.

### NG-13 · `@Injectable({ providedIn: 'root' })` dans un nouveau fichier — INFO
**Pourquoi** : Angular 22 déclare un service racine avec `@Service()`.
**Correction** : `@Service() export class SpeakerService { … }`.

### NG-14 · Image sans `NgOptimizedImage` — INFO
**À repérer** : `<img [src]="…">` dans un composant.
**Correction** : `<img [ngSrc]="…" width="…" height="…">`.
