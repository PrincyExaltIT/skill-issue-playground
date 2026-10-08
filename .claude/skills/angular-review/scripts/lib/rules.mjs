// rules.mjs — the MECHANICAL subset of the rule catalogue (references/*.md hold the full catalogue).
// A rule here only produces CANDIDATES. The review step keeps, downgrades or dismisses each one.
// Rule ids are shared with references/*.md so a candidate always links to its full explanation.

import { findCalls, htmlTags, templateExpressions, lineAt, inInjectionContext, statementStart } from './source.mjs';

const NATIVE_EVENTS = 'click|submit|change|input|focus|blur|keydown|keyup|keypress|select|reset|load|scroll|copy|paste|drop|close|toggle';

/** Helpers that turn regex hits into candidates. */
function linesMatching(ctx, regex, { masked = true } = {}) {
  const src = masked ? ctx.maskedLines : ctx.lines;
  const hits = [];
  src.forEach((l, i) => { if (regex.test(l)) hits.push({ line: i + 1 }); regex.lastIndex = 0; });
  return hits;
}

function templateTags(ctx) {
  const all = [];
  for (const t of ctx.templates) for (const tag of htmlTags(t.text, t.startLine)) all.push(tag);
  return all;
}

function templateRegex(ctx, regex) {
  const hits = [];
  for (const t of ctx.templates) {
    let m;
    const re = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g');
    while ((m = re.exec(t.text))) hits.push({ line: lineAt(t.text, m.index) + t.startLine - 1, match: m });
  }
  return hits;
}

export const RULES = [
  // ───────────────────────── Signals & reactivity (R-SIG / R-RX) ─────────────────────────
  {
    id: 'R-SIG-001', severity: 'MINOR', domain: 'reactivity', on: 'ts', eslintRule: '@angular-eslint/prefer-signals',
    title: 'Décorateurs @Input/@Output au lieu de input()/output()',
    message: "Nouveau code avec @Input()/@Output() : les inputs signal sont l'API recommandée (lecture réactive, required typé, plus de ngOnChanges).",
    suggestion: "Remplacer par `readonly x = input<T>()` / `input.required<T>()` et `readonly y = output<T>()`. Migration auto : `ng generate @angular/core:signal-input-migration` puis `ng generate @angular/core:output-migration`.",
    source: 'https://angular.dev/guide/components/inputs',
    detect: (ctx) => linesMatching(ctx, /@(Input|Output)\s*\(/),
  },
  {
    id: 'R-SIG-002', severity: 'INFO', domain: 'reactivity', on: 'ts',
    title: 'Requêtes de vue décorées (@ViewChild & co) au lieu de viewChild()',
    message: '@ViewChild/@ContentChild ne sont pas réactifs ; les requêtes signal évitent les accès avant ngAfterViewInit.',
    suggestion: "`readonly el = viewChild.required<ElementRef>('ref')`. Migration : `ng generate @angular/core:signal-queries-migration`.",
    source: 'https://angular.dev/guide/components/queries',
    detect: (ctx) => linesMatching(ctx, /@(ViewChild|ViewChildren|ContentChild|ContentChildren)\s*\(/),
  },
  {
    id: 'R-SIG-003', severity: 'MAJOR', domain: 'reactivity', on: 'ts', confidence: 'medium',
    title: "effect() qui écrit dans un signal (état dérivé)",
    message: "Un effect qui fait .set()/.update() sert souvent à recopier ou dériver un état : boucle de mises à jour, rendu en deux temps, état incohérent.",
    suggestion: "Dériver avec `computed()` ; pour un état dérivé mais modifiable, `linkedSignal()`. Garder effect() pour les effets de bord (DOM, storage, logs).",
    source: 'https://angular.dev/guide/signals/linked-signal',
    detect: (ctx) => {
      const out = [];
      for (const call of findCalls(ctx.masked, 'effect')) {
        const body = ctx.masked.slice(call.open, call.close);
        const w = /\.\s*(set|update)\s*\(/.exec(body);
        if (w) out.push({ line: lineAt(ctx.masked, call.open + w.index) });
      }
      return out;
    },
  },
  {
    id: 'R-SIG-004', severity: 'MAJOR', domain: 'reactivity', on: 'ts', confidence: 'medium',
    title: "Mutation en place de la valeur d'un signal",
    message: "La valeur du signal est mutée sans changer de référence : les computed/templates ne sont pas notifiés et la vue reste figée (surtout en OnPush/zoneless).",
    suggestion: "Produire une nouvelle référence : `this.items.update(list => [...list, item])`, `list.filter(...)`, `{ ...obj, prop }`.",
    source: 'https://angular.dev/guide/signals',
    detect: (ctx) => {
      const out = linesMatching(ctx, /\b[\w$.]+\(\)\s*\.\s*(push|pop|shift|unshift|splice|sort|reverse|fill|copyWithin)\s*\(/);
      for (const call of findCalls(ctx.masked, '\\.update')) {
        const body = ctx.masked.slice(call.open, call.close);
        const param = /^\(\s*\(?\s*([A-Za-z_$][\w$]*)\s*\)?\s*=>/.exec(body);
        if (param && new RegExp(`\\b${param[1]}\\s*\\.\\s*(push|pop|shift|unshift|splice|sort|reverse)\\s*\\(|\\b${param[1]}\\s*\\.\\s*[\\w$]+\\s*=[^=]`).test(body)) {
          out.push({ line: lineAt(ctx.masked, call.open) });
        }
      }
      return out;
    },
  },
  {
    id: 'R-SIG-005', severity: 'BLOCKER', domain: 'reactivity', on: 'ts', confidence: 'medium', eslintRule: '@angular-eslint/no-implicit-take-until-destroyed (partiel)',
    title: "API à contexte d'injection appelée hors contexte (NG0203)",
    message: "inject(), toSignal(), takeUntilDestroyed() sans argument ou effect() sont appelés dans une méthode (ngOnInit, handler…) : Angular lève NG0203 à l'exécution.",
    suggestion: "Déplacer l'appel dans un initialiseur de champ ou le constructeur, ou passer explicitement le contexte : `takeUntilDestroyed(this.destroyRef)`, `toSignal(obs$, { injector: this.injector })`, `effect(fn, { injector })`.",
    source: 'https://angular.dev/errors/NG0203',
    detect: (ctx) => {
      const out = [];
      for (const call of findCalls(ctx.masked, 'inject|toSignal|toObservable|takeUntilDestroyed|effect|afterNextRender|afterEveryRender')) {
        const line = lineAt(ctx.masked, call.start);
        const info = ctx.members[line - 1];
        if (inInjectionContext(info)) continue;
        const args = ctx.masked.slice(call.open + 1, call.close).trim();
        const original = ctx.text.slice(call.open + 1, call.close);
        if (call.name === 'takeUntilDestroyed' && args.length > 0) continue;
        if (/injector\s*[:,}]|\binjector\b/.test(original)) continue;
        const before = ctx.masked.slice(Math.max(0, call.start - 400), call.start);
        if (/runInInjectionContext\s*\(/.test(before)) continue;
        out.push({ line, message: `\`${call.name}()\` appelé dans \`${info.member}()\` : hors contexte d'injection → NG0203 à l'exécution.` });
      }
      return out;
    },
  },
  {
    id: 'R-RX-001', severity: 'MAJOR', domain: 'reactivity', on: 'ts', eslintRule: 'rxjs-x/no-nested-subscribe',
    title: 'subscribe imbriqués',
    message: 'Un subscribe dans un subscribe : pas d\'annulation de la requête interne, courses entre réponses, fuites et gestion d\'erreur éclatée.',
    suggestion: "Composer avec `switchMap` (annule la précédente), `concatMap` (ordre) ou `forkJoin` ; idéalement exposer le résultat via `toSignal()` ou `httpResource()`.",
    source: 'https://angular.dev/ecosystem/rxjs-interop',
    detect: (ctx) => {
      const out = [];
      const calls = findCalls(ctx.masked, '\\.subscribe');
      for (const outer of calls) {
        const inner = calls.find((c) => c.start > outer.open && c.start < outer.close);
        if (inner) out.push({ line: lineAt(ctx.masked, inner.start) });
      }
      return out;
    },
  },
  {
    id: 'R-ARCH-017', severity: 'BLOCKER', domain: 'architecture', on: 'ts', confidence: 'medium', eslintRule: 'rxjs-x/no-ignored-subscription',
    title: 'subscribe sans désabonnement dans un composant/directive',
    message: "Abonnement manuel sans takeUntilDestroyed, async pipe ni unsubscribe : il survit à la destruction du composant (fuite, callbacks sur une vue détruite).",
    suggestion: "Préférer `toSignal(obs$)` ou le pipe `async` ; à défaut `.pipe(takeUntilDestroyed(this.destroyRef))` (destroyRef injecté).",
    source: 'https://angular.dev/ecosystem/rxjs-interop/take-until-destroyed',
    detect: (ctx) => {
      if (!['component', 'directive'].includes(ctx.kind)) return [];
      if (/\.unsubscribe\s*\(/.test(ctx.masked)) return [];
      const out = [];
      for (const call of findCalls(ctx.masked, '\\.subscribe')) {
        const stmtStart = statementStart(ctx.masked, call.start);
        const chain = ctx.masked.slice(stmtStart, call.start);
        if (/takeUntilDestroyed|take\s*\(\s*1\s*\)|first\s*\(|takeUntil\s*\(/.test(chain)) continue;
        const http = /\bhttp(Client)?\s*\.\s*(get|post|put|patch|delete|request)\b|\.http\./.test(ctx.text.slice(stmtStart, call.start));
        out.push({ line: lineAt(ctx.masked, call.start), confidence: http ? 'low' : 'medium', severity: http ? 'MINOR' : 'BLOCKER',
          message: http ? "Abonnement HTTP manuel : la requête se termine seule (pas de fuite durable), mais le callback peut s'exécuter après destruction. À confirmer." : undefined });
      }
      return out;
    },
  },
  {
    id: 'R-RX-002', severity: 'MINOR', domain: 'reactivity', on: 'ts', eslintRule: 'rxjs-x/no-sharereplay',
    title: 'shareReplay sans refCount',
    message: 'shareReplay(n) sans refCount garde la souscription source vivante après le dernier abonné (fuite mémoire/réseau).',
    suggestion: '`shareReplay({ bufferSize: 1, refCount: true })` ou un signal/`httpResource` pour un état partagé.',
    source: 'https://rxjs.dev/api/operators/shareReplay',
    detect: (ctx) => linesMatching(ctx, /shareReplay\s*\(\s*(\d+\s*\)|\{(?![^}]*refCount\s*:\s*true)[^}]*\})/),
  },

  {
    id: 'R-SIG-006', severity: 'BLOCKER', domain: 'reactivity', on: 'ts', eslintRule: '@angular-eslint/computed-must-return',
    title: 'Écriture de signal dans computed() (NG0600)',
    message: "Un computed() qui écrit dans un signal lève NG0600 à l'exécution ; tout autre effet de bord y est rejoué à chaque recalcul.",
    suggestion: 'Garder computed() pur ; déplacer l\'écriture dans le code qui déclenche le changement, ou dériver avec linkedSignal().',
    source: 'https://angular.dev/guide/signals',
    detect: (ctx) => findCalls(ctx.masked, 'computed').flatMap((call) => {
      const body = ctx.masked.slice(call.open, call.close);
      const w = /\.\s*(set|update)\s*\(/.exec(body);
      return w ? [{ line: lineAt(ctx.masked, call.open + w.index) }] : [];
    }),
  },
  {
    id: 'R-SIG-008', severity: 'MAJOR', domain: 'reactivity', on: 'ts',
    title: 'httpResource/resource utilisé pour une écriture',
    message: "Une resource se relance quand ses paramètres changent et peut être annulée : une écriture (POST/PUT/PATCH/DELETE) risque d'être rejouée ou coupée en plein vol.",
    suggestion: "Faire l'écriture dans une méthode explicite (`HttpClient.post`) déclenchée par l'utilisateur ; garder httpResource pour les lectures.",
    source: 'https://angular.dev/guide/http/http-resource',
    detect: (ctx) => findCalls(ctx.masked, 'httpResource(?:\\.\\w+)?|resource|rxResource').flatMap((call) => {
      const body = ctx.text.slice(call.open, call.close);
      const w = /method\s*:\s*['"`](POST|PUT|PATCH|DELETE)['"`]|\.(post|put|patch|delete)\s*\(/i.exec(body);
      return w ? [{ line: lineAt(ctx.text, call.open + w.index) }] : [];
    }),
  },
  {
    id: 'R-SIG-010', severity: 'BLOCKER', domain: 'reactivity', on: 'ts', eslintRule: '@angular-eslint/no-uncalled-signals',
    title: 'Signal testé sans être appelé',
    message: "Un signal est une fonction : `if (this.loading)` est toujours vrai. La condition ne lit jamais la valeur.",
    suggestion: 'Appeler le signal : `if (this.loading())`.',
    source: 'https://angular.dev/guide/signals',
    detect: (ctx) => {
      const names = new Set();
      const decl = /(?:^|[\s;{])(?:(?:public|private|protected|readonly|static)\s+)*([A-Za-z_$][\w$]*)\s*(?::[^=;\n{}]+)?=\s*(?:signal|computed|linkedSignal|input|model|toSignal)\s*(?:\.required)?\s*[<(]/g;
      let m;
      while ((m = decl.exec(ctx.masked))) names.add(m[1]);
      if (names.size === 0) return [];
      const alt = [...names].map((n) => n.replace(/\$/g, '\\$')).join('|');
      const re = new RegExp(`(?:if\\s*\\(\\s*!?\\s*this\\.(?:${alt})\\s*\\))|(?:this\\.(?:${alt})\\s*(?:&&|\\|\\||\\?(?![.?])))|(?:!\\s*this\\.(?:${alt})\\b(?!\\s*[.(]))`);
      return linesMatching(ctx, re);
    },
  },
  {
    id: 'R-ARCH-034', severity: 'INFO', domain: 'architecture', on: 'ts', minMajor: 22, newFilesOnly: true, eslintRule: '@angular-eslint/prefer-service-decorator',
    title: "@Injectable({ providedIn: 'root' }) au lieu de @Service() (Angular ≥ 22)",
    message: "Depuis Angular 22, `@Service()` déclare un service racine en une ligne (et `ng g service` le génère). @Injectable reste valable pour l'injection par constructeur ou les providers avancés.",
    suggestion: '`@Service() export class TalksStore { … }` — migration : `ng generate @angular/core:service`.',
    source: 'https://angular.dev/guide/di/creating-and-using-services',
    // Unmasked: the 'root' string must stay visible (masked code blanks string contents).
    detect: (ctx) => linesMatching(ctx, /@Injectable\s*\(\s*\{\s*providedIn\s*:\s*['"]root['"]\s*\}\s*\)/, { masked: false }),
  },
  {
    id: 'R-ARCH-035', severity: 'MINOR', domain: 'architecture', on: 'ts', minMajor: 20,
    title: 'Animations legacy (@angular/animations)',
    message: "Le package @angular/animations est déprécié depuis la v20.2 (retrait prévu en v23) au profit de `animate.enter` / `animate.leave` et du CSS.",
    suggestion: '`<div animate.enter="fade-in">` avec des keyframes CSS ; retirer provideAnimations()/BrowserAnimationsModule.',
    source: 'https://angular.dev/guide/animations',
    detect: (ctx) => linesMatching(ctx, /from\s+['"]@angular\/(platform-browser\/)?animations['"]|provideAnimations(Async)?\s*\(|BrowserAnimationsModule/, { masked: false }),
  },

  // ───────────────────────── Architecture (R-ARCH) ─────────────────────────
  {
    id: 'R-ARCH-007', severity: 'MINOR', domain: 'architecture', on: 'ts', eslintRule: '@angular-eslint/prefer-inject',
    title: 'Injection par paramètres de constructeur',
    message: "Injection par constructeur : moins lisible, incompatible avec l'héritage simple et avec les initialiseurs de champs qui dépendent du service.",
    suggestion: "`private readonly http = inject(HttpClient);`. Migration : `ng generate @angular/core:inject`.",
    source: 'https://angular.dev/reference/migrations/inject-function',
    detect: (ctx) => {
      const out = [];
      for (const call of findCalls(ctx.masked, 'constructor')) {
        const params = ctx.masked.slice(call.open + 1, call.close);
        if (/\b(private|public|protected|readonly)\s+[\w$]+\s*:/.test(params) || /@Inject\s*\(/.test(params)) out.push({ line: lineAt(ctx.masked, call.start) });
      }
      return out;
    },
  },
  {
    id: 'R-ARCH-010', severity: 'INFO', domain: 'architecture', on: 'ts', minMajor: 19, eslintRule: '@angular-eslint/prefer-standalone',
    title: '`standalone: true` explicite (défaut depuis v19)',
    message: 'Depuis Angular 19, les composants/directives/pipes sont standalone par défaut : le flag est du bruit.',
    suggestion: 'Supprimer `standalone: true`.',
    source: 'https://angular.dev/guide/components',
    detect: (ctx) => linesMatching(ctx, /\bstandalone\s*:\s*true\b/),
  },
  {
    id: 'R-ARCH-010', severity: 'MAJOR', domain: 'architecture', on: 'ts', minMajor: 19,
    title: 'Nouveau NgModule',
    message: 'Nouveau @NgModule dans une application standalone : couche d\'indirection inutile.',
    suggestion: 'Exposer des composants standalone et des fonctions `provideXxx()` (EnvironmentProviders).',
    source: 'https://angular.dev/guide/components',
    detect: (ctx) => linesMatching(ctx, /@NgModule\s*\(/),
  },
  {
    id: 'R-ARCH-012', severity: 'MINOR', domain: 'architecture', on: 'template', eslintRule: '@angular-eslint/template/prefer-class-binding',
    title: '[ngClass]/[ngStyle] au lieu de [class.x]/[style.x]',
    message: 'Le style guide recommande les bindings natifs [class.x] et [style.x] : plus lisibles et plus performants.',
    suggestion: '`[class.active]="isActive()"`, `[style.width.px]="w()"`.',
    source: 'https://angular.dev/style-guide',
    detect: (ctx) => templateRegex(ctx, /\[(ngClass|ngStyle)\]/),
  },
  {
    id: 'R-ARCH-022', severity: 'MINOR', domain: 'architecture', on: 'ts', eslintRule: 'no-console',
    title: 'console.log résiduel',
    message: 'Log de debug laissé dans le code (bruit, fuite potentielle de données en production).',
    suggestion: 'Supprimer, ou passer par un service de logging désactivable.',
    source: 'https://angular.dev/best-practices/error-handling',
    detect: (ctx) => linesMatching(ctx, /\bconsole\.(log|debug|info|table|dir)\s*\(/),
  },
  {
    id: 'R-ARCH-027', severity: 'MAJOR', domain: 'architecture', on: 'ts', eslintRule: '@angular-eslint/no-output-native',
    title: 'Output nommé comme un événement DOM natif',
    message: "Un output nommé comme un événement natif (click, submit, change…) se mélange avec l'événement DOM qui bulle : le handler parent peut se déclencher deux fois.",
    suggestion: 'Nommer par intention métier : `cardSelected`, `searchSubmitted`.',
    source: 'https://angular.dev/guide/components/outputs',
    detect: (ctx) => {
      const re = new RegExp(`(?:alias\\s*:\\s*['"](?:${NATIVE_EVENTS})['"])|(?:\\b(?:${NATIVE_EVENTS})\\s*=\\s*output\\s*[<(])|(?:@Output\\s*\\(\\s*(?:['"](?:${NATIVE_EVENTS})['"])?\\s*\\)\\s*(?:readonly\\s+)?(?:${NATIVE_EVENTS})\\b)`);
      return linesMatching(ctx, re, { masked: false }).filter((h) => /output|Output/.test(ctx.lines[h.line - 1]));
    },
  },
  {
    id: 'R-ARCH-027', severity: 'MINOR', domain: 'architecture', on: 'ts', eslintRule: '@angular-eslint/no-input-rename',
    title: 'Input renommé (alias)',
    message: "Un alias d'input crée deux noms pour la même chose (code vs template) et brouille la recherche.",
    suggestion: "Supprimer l'alias et renommer le champ, sauf contrainte d'API publique documentée.",
    source: 'https://angular.dev/guide/components/inputs',
    detect: (ctx) => {
      // Signal inputs: the alias key may sit on another line than input( — search inside the call's arguments.
      const signalInputs = findCalls(ctx.masked, 'input(?:\\.required)?').flatMap((call) => {
        const a = /\balias\s*:/.exec(ctx.masked.slice(call.open, call.close));
        return a ? [{ line: lineAt(ctx.masked, call.open + a.index) }] : [];
      });
      return [...signalInputs, ...linesMatching(ctx, /@Input\s*\(\s*['"]/, { masked: false })];
    },
  },
  {
    id: 'R-ARCH-019', severity: 'MAJOR', domain: 'architecture', on: 'ts',
    title: "transform d'input qui mute la valeur reçue",
    message: "Le transform modifie l'objet passé par le parent : la mutation se propage chez lui (même référence, donc aucune notification) et la valeur est altérée à chaque passage.",
    suggestion: 'Renvoyer une nouvelle valeur : `transform: (m: Monster) => ({ ...m, hp: m.hp * 2 })`, ou dériver avec `computed()` dans le composant.',
    source: 'https://angular.dev/guide/components/inputs',
    detect: (ctx) => findCalls(ctx.masked, 'input(?:\\.required)?').flatMap((call) => {
      const args = ctx.masked.slice(call.open, call.close);
      const t = /transform\s*:\s*\(?\s*([A-Za-z_$][\w$]*)/.exec(args);
      if (!t) return [];
      const p = t[1].replace(/\$/g, '\\$');
      const m = new RegExp(`\\b${p}\\s*\\.\\s*[\\w$]+\\s*(?:=[^=]|\\+=|-=|\\*=|\\+\\+|--)|\\b${p}\\s*\\.\\s*(?:push|splice|sort|reverse|pop|shift)\\s*\\(`).exec(args);
      return m ? [{ line: lineAt(ctx.masked, call.open + m.index) }] : [];
    }),
  },
  {
    id: 'R-ARCH-028', severity: 'MINOR', domain: 'architecture', on: 'template', minMajor: 17, eslintRule: '@angular-eslint/template/prefer-control-flow',
    title: 'Directives structurelles *ngIf/*ngFor/*ngSwitch (dépréciées depuis v20)',
    message: 'NgIf/NgFor/NgSwitch sont dépréciés depuis Angular 20 au profit du control flow natif (@if/@for/@switch), plus rapide et mieux typé.',
    suggestion: '`@if (cond) { … } @else { … }`, `@for (item of items(); track item.id) { … } @empty { … }`. Migration : `ng generate @angular/core:control-flow`.',
    source: 'https://angular.dev/guide/templates/control-flow',
    detect: (ctx) => templateRegex(ctx, /\*ng(If|For|SwitchCase|SwitchDefault)\b|\[ngSwitch\]/),
  },
  {
    id: 'R-ARCH-029', severity: 'MINOR', domain: 'architecture', on: 'ts', eslintRule: '@typescript-eslint/no-explicit-any',
    title: '`any` explicite',
    message: '`any` désactive le typage strict (et le type-checking des templates qui en dépendent).',
    suggestion: 'Typer avec une interface, `unknown` + type guard, ou un générique.',
    source: 'https://angular.dev/tools/cli/template-typecheck',
    detect: (ctx) => linesMatching(ctx, /:\s*any\b|\bas\s+any\b|<any>|\bany\[\]/),
  },
  {
    id: 'R-ARCH-030', severity: 'MINOR', domain: 'architecture', on: 'ts',
    title: "URL d'API codée en dur",
    message: "URL absolue en dur : casse entre environnements (dev/recette/prod) et contourne les intercepteurs de base URL.",
    suggestion: 'Injecter un `InjectionToken<string>` (API_BASE_URL) fourni dans `app.config.ts`, ou utiliser des URLs relatives + proxy.',
    source: 'https://angular.dev/guide/di/defining-dependency-providers',
    detect: (ctx) => linesMatching(ctx, /['"`]https?:\/\/(?!(www\.)?(angular\.dev|w3\.org|schema\.org))[^'"`\s]+/, { masked: false })
      .filter((h) => !/^\s*(\/\/|\*|import\b)/.test(ctx.lines[h.line - 1])),
  },
  {
    id: 'R-ARCH-031', severity: 'MINOR', domain: 'architecture', on: 'ts',
    title: 'Formulaires non typés',
    message: 'Untyped* désactive le typage des reactive forms (valeurs `any`).',
    suggestion: '`inject(NonNullableFormBuilder).group({ title: [\'\', Validators.required] })` ou les Signal Forms (`@angular/forms/signals`).',
    source: 'https://angular.dev/guide/forms/typed-forms',
    detect: (ctx) => linesMatching(ctx, /\bUntyped(FormGroup|FormControl|FormArray|FormBuilder)\b/),
  },
  {
    id: 'R-ARCH-032', severity: 'MINOR', domain: 'architecture', on: 'ts',
    title: 'Guard/resolver sous forme de classe',
    message: "Les guards/resolvers en classe ne sont pas dépréciés, mais les fonctions (CanActivateFn, ResolveFn) sont l'idiome actuel : moins de code, inject() direct. `canLoad`, lui, est déprécié au profit de `canMatch`.",
    suggestion: '`export const authGuard: CanActivateFn = () => inject(Auth).isLoggedIn();`',
    source: 'https://angular.dev/guide/routing/route-guards',
    detect: (ctx) => linesMatching(ctx, /\bimplements\b[^{]*\b(CanActivate|CanActivateChild|CanDeactivate|CanMatch|CanLoad|Resolve)\b/),
  },
  {
    id: 'R-ARCH-033', severity: 'INFO', domain: 'architecture', on: 'ts', eslintRule: '@angular-eslint/prefer-host-metadata-property',
    title: '@HostListener/@HostBinding au lieu de `host: {}`',
    message: "Non déprécié, mais le style guide et les bonnes pratiques officielles demandent la propriété `host` du décorateur plutôt que @HostListener/@HostBinding.",
    suggestion: "`host: { '(keydown.escape)': 'close()', '[class.open]': 'isOpen()' }`",
    source: 'https://angular.dev/style-guide',
    detect: (ctx) => linesMatching(ctx, /@(HostListener|HostBinding)\s*\(/),
  },

  // ───────────────────────── Performance / change detection (R-PERF) ─────────────────────────
  {
    id: 'R-PERF-020', severity: 'MAJOR', domain: 'performance', on: 'ts', maxMajor: 21, eslintRule: '@angular-eslint/prefer-on-push-component-change-detection',
    title: 'Composant sans OnPush (Angular ≤ 21)',
    message: "Avant Angular 22, un composant sans OnPush est vérifié à chaque cycle : coûteux et masque les bugs de réactivité avant un passage zoneless.",
    suggestion: '`changeDetection: ChangeDetectionStrategy.OnPush` (défaut à partir d\'Angular 22).',
    source: 'https://angular.dev/best-practices/skipping-subtrees',
    detect: (ctx) => {
      if (ctx.kind !== 'component') return [];
      const out = [];
      for (const call of findCalls(ctx.masked, '@Component')) {
        const meta = ctx.text.slice(call.open, call.close);
        if (!/changeDetection\s*:\s*ChangeDetectionStrategy\.OnPush/.test(meta)) out.push({ line: lineAt(ctx.masked, call.start) });
      }
      return out;
    },
  },
  {
    id: 'R-PERF-020', severity: 'MINOR', domain: 'performance', on: 'ts', minMajor: 22,
    title: 'Composant forcé en Eager/Default (Angular ≥ 22)',
    message: "Depuis Angular 22, OnPush est le défaut. Forcer `Eager` (ou l'alias déprécié `Default`) réactive la vérification systématique : dette technique si c'est `ng update` qui l'a ajouté, choix à justifier dans du code neuf.",
    suggestion: "Supprimer `changeDetection` et rendre l'état réactif (signals) ; garder `Eager` uniquement avec un commentaire qui explique pourquoi.",
    source: 'https://angular.dev/best-practices/skipping-subtrees',
    detect: (ctx) => linesMatching(ctx, /ChangeDetectionStrategy\.(Eager|Default)\b/).map((h) => ({ ...h, severity: ctx.status === 'A' ? 'MAJOR' : 'MINOR' })),
  },
  {
    id: 'R-PERF-034', severity: 'INFO', domain: 'performance', on: 'template', eslintRule: '@angular-eslint/template/prefer-ngsrc',
    title: '<img src> sans NgOptimizedImage',
    message: "Image chargée sans NgOptimizedImage : pas de lazy-loading par défaut, pas de srcset, pas d'avertissement sur les images surdimensionnées (LCP).",
    suggestion: "Importer `NgOptimizedImage` et utiliser `ngSrc` avec `width`/`height` (ou `fill`) ; `priority` sur l'image LCP.",
    source: 'https://angular.dev/guide/image-optimization',
    detect: (ctx) => templateTags(ctx).filter((t) => t.name === 'img' && /\s(\[src\]|src)\s*=/.test(t.attrs) && !/ngSrc/.test(t.attrs) && !/src\s*=\s*"data:/.test(t.attrs)).map((t) => ({ line: t.line })),
  },
  {
    id: 'R-PERF-035', severity: 'MAJOR', domain: 'performance', on: 'ts', confidence: 'low', zonelessOnly: true,
    title: 'Zoneless : état modifié hors signal dans un callback asynchrone',
    message: "Application zoneless : un champ simple modifié dans setTimeout, setInterval, then, subscribe ou addEventListener ne déclenche aucun rafraîchissement — la vue reste figée.",
    suggestion: 'Stocker cet état dans un `signal()` (ou appeler `markForCheck()`), et préférer `debounced()`/RxJS aux timers manuels.',
    source: 'https://angular.dev/guide/zoneless',
    detect: (ctx) => {
      if (!['component', 'directive'].includes(ctx.kind)) return [];
      const out = [];
      // Bare calls and member calls are searched separately: the bare-name guard would hide `.then(`.
      const asyncCalls = [...findCalls(ctx.masked, 'setTimeout|setInterval|addEventListener'), ...findCalls(ctx.masked, '\\.then|\\.subscribe')];
      for (const call of asyncCalls) {
        // Form valueChanges/statusChanges emit synchronously inside the user's input event, which already refreshes the view.
        if (call.name.endsWith('subscribe') && /(valueChanges|statusChanges)\b/.test(ctx.masked.slice(statementStart(ctx.masked, call.start), call.start))) continue;
        const body = ctx.masked.slice(call.open, call.close);
        const assign = /this\.([A-Za-z_$][\w$]*)\s*(=[^=]|\+\+|--|\+=|-=)/.exec(body);
        if (!assign) continue;
        const field = assign[1];
        const isSignal = new RegExp(`\\b${field}\\s*=\\s*(signal|model|linkedSignal|computed|input)\\b`).test(ctx.masked);
        if (!isSignal) out.push({ line: lineAt(ctx.masked, call.open + assign.index), message: `\`this.${field}\` est un champ simple modifié dans \`${call.name.replace('.', '')}\` : en zoneless la vue ne sera pas rafraîchie.` });
      }
      return out;
    },
  },
  {
    id: 'R-PERF-036', severity: 'MINOR', domain: 'performance', on: 'template',
    title: '@for avec `track $index` sur une liste d\'entités',
    message: "`track $index` recrée/décale le DOM quand la liste est triée, filtrée ou insérée en tête (perte de focus, animations, état local).",
    suggestion: "Tracker une identité stable : `track item.id`.",
    source: 'https://angular.dev/guide/templates/control-flow',
    detect: (ctx) => templateRegex(ctx, /@for\s*\([^{]*?track\s+\$index/),
  },
  {
    id: 'R-PERF-037', severity: 'MINOR', domain: 'performance', on: 'template', confidence: 'medium',
    title: 'Appel de méthode avec arguments dans le template',
    message: "Une méthode appelée avec arguments dans le template est ré-exécutée à chaque vérification de la vue (les signals, eux, s'appellent sans argument).",
    suggestion: 'Précalculer avec `computed()`, un pipe pur, ou enrichir le modèle en amont.',
    source: 'https://angular.dev/best-practices/runtime-performance',
    detect: (ctx) => {
      const out = [];
      for (const t of ctx.templates) {
        for (const e of templateExpressions(t.text, t.startLine)) {
          const call = /(?<![\w$.|])([a-z_$][\w$]*)\s*\(\s*[^)\s]/i.exec(e.expr);
          if (call && !/^(\$any|signal|computed)$/.test(call[1])) out.push({ line: e.line });
        }
      }
      return out;
    },
  },

  // ───────────────────────── Security (R-SEC) ─────────────────────────
  {
    id: 'R-SEC-003', severity: 'BLOCKER', domain: 'security', on: 'ts', confidence: 'medium',
    title: 'bypassSecurityTrust* (sanitizer contourné)',
    message: "Le sanitizer Angular est désactivé pour cette valeur : si elle contient une donnée utilisateur, c'est une faille XSS.",
    suggestion: "Laisser Angular assainir (`[innerHTML]` simple) ; si le HTML vient d'un tiers, l'assainir (DOMPurify) avant tout bypass et documenter pourquoi.",
    source: 'https://angular.dev/best-practices/security',
    detect: (ctx) => linesMatching(ctx, /bypassSecurityTrust(Html|Script|Style|Url|ResourceUrl)\s*\(/),
  },
  {
    id: 'R-SEC-006', severity: 'MAJOR', domain: 'security', on: 'ts',
    title: 'Manipulation directe du DOM',
    message: 'Écriture HTML directe dans le DOM : contourne la sanitisation Angular (XSS) et le rendu (SSR, hydratation).',
    suggestion: 'Passer par le template (bindings), `Renderer2`, ou un composant dédié.',
    source: 'https://angular.dev/best-practices/security',
    detect: (ctx) => linesMatching(ctx, /\.(innerHTML|outerHTML)\s*=[^=]|insertAdjacentHTML\s*\(|document\.write\s*\(/),
  },
  {
    id: 'R-SEC-020', severity: 'BLOCKER', domain: 'security', on: 'ts',
    title: 'eval / new Function',
    message: 'Exécution de code dynamique : injection de code et incompatibilité CSP.',
    suggestion: 'Remplacer par une table de correspondance ou un parseur dédié.',
    source: 'https://angular.dev/best-practices/security',
    detect: (ctx) => linesMatching(ctx, /(?<![\w$.])eval\s*\(|new\s+Function\s*\(/),
  },
  {
    id: 'R-SEC-023', severity: 'BLOCKER', domain: 'security', on: 'ts',
    title: 'Secret ou token en dur',
    message: 'Un secret dans le bundle front est public : quiconque ouvre les DevTools le récupère.',
    suggestion: 'Retirer le secret, le révoquer, et passer par un backend (BFF) qui détient la clé.',
    source: 'https://angular.dev/best-practices/security',
    detect: (ctx) => linesMatching(ctx, /(api[_-]?key|secret|token|password|passwd)\s*[:=]\s*['"`][A-Za-z0-9_\-./+=]{12,}['"`]/i, { masked: false }),
  },
  {
    id: 'R-SEC-012', severity: 'MAJOR', domain: 'security', on: 'ts',
    title: 'withNoXsrfProtection()',
    message: 'Protection XSRF désactivée sur HttpClient.',
    suggestion: 'Retirer `withNoXsrfProtection()` ou documenter pourquoi le backend ne repose pas sur des cookies.',
    source: 'https://angular.dev/best-practices/security',
    detect: (ctx) => linesMatching(ctx, /withNoXsrfProtection\s*\(/),
  },

  // ───────────────────────── Accessibility (R-A11Y) ─────────────────────────
  {
    id: 'R-A11Y-005', severity: 'BLOCKER', domain: 'a11y', on: 'template', confidence: 'medium', eslintRule: '@angular-eslint/template/click-events-have-key-events',
    title: '(click) sur un élément non interactif',
    message: "Un élément non interactif cliquable n'est ni focusable ni activable au clavier : inaccessible aux utilisateurs clavier et lecteurs d'écran.",
    suggestion: 'Utiliser un `<button type="button">` (ou un `<a routerLink>` pour une navigation).',
    source: 'https://angular.dev/best-practices/a11y',
    detect: (ctx) => templateTags(ctx)
      .filter((t) => /^(div|span|li|p|td|tr|img|section|article|h[1-6]|i)$/.test(t.name) && /\(click\)/.test(t.attrs)
        && !/\(keydown|\(keyup|\(keypress|\brole\s*=\s*"(button|link|tab|menuitem|option|checkbox|switch)"/.test(t.attrs))
      .map((t) => ({ line: t.line })),
  },
  {
    id: 'R-A11Y-014', severity: 'MAJOR', domain: 'a11y', on: 'template', eslintRule: '@angular-eslint/template/alt-text',
    title: 'Image sans attribut alt',
    message: "Image sans `alt` : un lecteur d'écran lit le nom du fichier (WCAG 1.1.1).",
    suggestion: '`alt="description utile"`, ou `alt=""` si l\'image est décorative.',
    source: 'https://angular.dev/best-practices/a11y',
    detect: (ctx) => templateTags(ctx).filter((t) => t.name === 'img' && !/\s(\[?alt\]?|\[attr\.alt\])\s*=/.test(t.attrs)).map((t) => ({ line: t.line })),
  },
  {
    id: 'R-A11Y-013', severity: 'BLOCKER', domain: 'a11y', on: 'template', confidence: 'low', eslintRule: '@angular-eslint/template/label-has-associated-control',
    title: 'Champ de formulaire sans label',
    message: "Champ sans label associé (placeholder seul) : il n'a pas de nom accessible (WCAG 1.3.1 / 4.1.2).",
    suggestion: '`<label for="search">Rechercher</label><input id="search" …>` ou `aria-label`.',
    source: 'https://angular.dev/best-practices/a11y',
    detect: (ctx) => {
      const tags = templateTags(ctx);
      const labelsFor = new Set(tags.filter((t) => t.name === 'label').map((t) => /\sfor\s*=\s*"([^"]+)"/.exec(t.attrs)?.[1]).filter(Boolean));
      const hasWrappingLabels = tags.some((t) => t.name === 'label' && !/\sfor\s*=/.test(t.attrs));
      return tags.filter((t) => /^(input|select|textarea)$/.test(t.name)
          && !/type\s*=\s*"(hidden|submit|button|reset|image)"/.test(t.attrs)
          && !/aria-label(ledby)?\s*=|\[attr\.aria-label/.test(t.attrs)
          && !labelsFor.has(/\sid\s*=\s*"([^"]+)"/.exec(t.attrs)?.[1])
          && !hasWrappingLabels)
        .map((t) => ({ line: t.line }));
    },
  },

  // ───────────────────────── Testing (R-TEST) ─────────────────────────
  {
    id: 'R-TEST-001', severity: 'MINOR', domain: 'testing', on: 'ts', newFilesOnly: true,
    title: 'Nouveau composant/service sans fichier de test',
    message: 'Nouvelle unité sans spec : le comportement ajouté n\'est protégé par aucun test.',
    suggestion: 'Ajouter un `*.spec.ts` qui teste le comportement (rendu, interactions, cas d\'erreur), pas seulement la création.',
    source: 'https://angular.dev/guide/testing',
    detect: (ctx) => (['component', 'service', 'directive', 'pipe', 'guard', 'interceptor'].includes(ctx.kind) && ctx.hasSpec === false ? [{ line: 1 }] : []),
  },
  {
    id: 'R-TEST-002', severity: 'MAJOR', domain: 'testing', on: 'ts', eslintRule: 'vitest/no-focused-tests',
    title: 'Test focalisé (fit/fdescribe/.only)',
    message: 'Un test focalisé désactive silencieusement le reste de la suite en CI.',
    suggestion: 'Retirer `.only` / `fit` / `fdescribe`.',
    source: 'https://angular.dev/guide/testing',
    detect: (ctx) => (ctx.kind === 'spec' ? linesMatching(ctx, /(?<![\w$.])(fit|fdescribe)\s*\(|\b(it|test|describe)\.only\s*\(/) : []),
  },
  {
    id: 'R-TEST-003', severity: 'MINOR', domain: 'testing', on: 'ts', confidence: 'medium',
    title: 'Spec qui ne vérifie que la création',
    message: "Le seul `expect` vérifie que le composant existe : le test passe même si le comportement est cassé.",
    suggestion: 'Tester le rendu et les interactions (DOM, outputs émis, appels de service mockés).',
    source: 'https://angular.dev/guide/testing/components-basics',
    detect: (ctx) => {
      if (ctx.kind !== 'spec') return [];
      const expects = ctx.masked.match(/\bexpect\s*\(/g) ?? [];
      const truthy = ctx.masked.match(/\.toBeTruthy\s*\(\s*\)/g) ?? [];
      if (expects.length > 0 && expects.length === truthy.length) {
        const i = ctx.masked.search(/\.toBeTruthy\s*\(/);
        return [{ line: lineAt(ctx.masked, i) }];
      }
      return [];
    },
  },
];
