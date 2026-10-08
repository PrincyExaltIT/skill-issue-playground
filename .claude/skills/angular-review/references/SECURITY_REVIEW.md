---
name: angular-security-reviewer
description: Audit sécurité Angular (XSS, CSP, Trusted Types, XSRF, SSRF, AOT/JIT, sanitisation, bypassSecurityTrust*, hydration cache).
domain: security
rule_prefix: R-SEC
applies_to:
  - "**/*.ts"
  - "**/*.html"
  - "angular.json"
  - "package.json"
  - "src/**/app.config*.ts"
severity_levels: [BLOCKER, MAJOR, MINOR, INFO]
output_format: json
parallel_safe: true
sources:
  - https://angular.dev/best-practices/security
---

# Reviewer Guideline — Sécurité Angular

## But

Document à charger comme contexte par un agent reviewer LLM pour auditer un diff/PR Angular sur les aspects sécurité. L'agent doit parcourir le diff fichier par fichier, appliquer chaque règle ci-dessous, et émettre des findings structurés selon le format final. Toute violation BLOCKER ou MAJOR doit empêcher l'approbation.

## Niveaux de sévérité

- 🔴 BLOCKER : faille connue, doit bloquer la PR
- 🟠 MAJOR : risque sérieux, doit être corrigé avant merge
- 🟡 MINOR : à corriger mais non bloquant
- 🔵 INFO : suggestion / bonne pratique

---

## Règles à vérifier

### R-SEC-001 — `innerHTML` lié à une valeur non sanitisée

- **Sévérité** : 🔴 BLOCKER
- **Quoi vérifier** : tout binding `[innerHTML]` ou `[outerHTML]` dont la source est concaténée, externe (HTTP, route, formulaire) ou non explicitement passée par `DomSanitizer.sanitize(SecurityContext.HTML, ...)`.
- **Pattern à flag** (regex) : `\[innerHTML\]="[^"]*(\+|\$\{|params|query|input|route|form|response|body)`
- **Exemple ❌** :
  ```ts
  // template
  // <div [innerHTML]="'<b>' + userInput + '</b>'"></div>
  ```
- **Exemple ✅** :
  ```ts
  // template: <div>{{ userInput }}</div>  (interpolation = échappement auto)
  // ou
  protected safe = computed(() =>
    this.sanitizer.sanitize(SecurityContext.HTML, this.userInput()) ?? ''
  );
  ```
- **Source** : <https://angular.dev/best-practices/security#xss>

### R-SEC-002 — Concaténation d'entrée utilisateur dans un template

- **Sévérité** : 🔴 BLOCKER
- **Quoi vérifier** : génération dynamique de chaînes de template Angular (`@Component({ template: '...' + x })`) ou strings réinjectées dans un `compileTemplate`.
- **Pattern à flag** : `template:\s*[`'"][^`'"]*\+\s*\w+` ou `compileComponent`, `JitCompiler`.
- **Exemple ❌** :
  ```ts
  @Component({ template: `<p>${this.unsafeFromUser}</p>` })
  export class Page {}
  ```
- **Exemple ✅** :
  ```ts
  @Component({ template: `<p>{{ value }}</p>` })
  export class Page { value = signal(''); }
  ```
- **Source** : <https://angular.dev/best-practices/security#preventing-cross-site-scripting-xss>

### R-SEC-003 — Usage non audité de `bypassSecurityTrustHtml`

> **v2 — sévérité** : la v1 classait tout usage en MAJOR. Une bio, un commentaire ou une description saisis par un utilisateur puis marqués sûrs sont une XSS stockée : BLOCKER. Le scan signale chaque bypass en BLOCKER (confiance moyenne) ; l'étape Verify rétrograde les constantes.

- **Sévérité** : 🔴 BLOCKER si la valeur peut venir d'un utilisateur ou d'un tiers (XSS) · 🟠 MAJOR si c'est une constante auditée sans commentaire
- **Quoi vérifier** : tout appel à `bypassSecurityTrustHtml(...)` sans commentaire de justification au-dessus, ou avec une valeur dont l'origine n'est pas une constante littérale ou un input statiquement vérifié.
- **Pattern à flag** : `bypassSecurityTrustHtml\(`
- **Exemple ❌** :
  ```ts
  this.html = this.sanitizer.bypassSecurityTrustHtml(apiResponse.html);
  ```
- **Exemple ✅** :
  ```ts
  // SAFE: contenu statique embarqué dans le bundle, audité 2026-05-05
  this.html = this.sanitizer.bypassSecurityTrustHtml(STATIC_TRUSTED_HTML);
  ```
- **Source** : <https://angular.dev/best-practices/security#trusting-safe-values>

### R-SEC-004 — Mauvais contexte de `bypassSecurityTrust*`

- **Sévérité** : 🟠 MAJOR
- **Quoi vérifier** : `bypassSecurityTrustUrl` utilisé sur une `src` d'iframe / `<script>` (devrait être `ResourceUrl`), ou `bypassSecurityTrustHtml` sur un attribut `style` (devrait être `Style`).
- **Pattern à flag** : `bypassSecurityTrustUrl.*iframe|bypassSecurityTrustHtml.*style`
- **Exemple ❌** :
  ```ts
  this.iframeSrc = this.sanitizer.bypassSecurityTrustUrl(embedUrl);
  ```
- **Exemple ✅** :
  ```ts
  this.iframeSrc = this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
  ```
- **Source** : <https://angular.dev/best-practices/security#trusting-safe-values>

### R-SEC-005 — URL construite loin de l'entrée

- **Sévérité** : 🟡 MINOR
- **Quoi vérifier** : `bypassSecurityTrustResourceUrl` recevant une variable construite plusieurs fonctions plus haut. La construction doit être au plus près de l'entrée pour faciliter la revue.
- **Pattern à flag** : variable passée en argument, construite ailleurs, puis bypassée.
- **Exemple ❌** :
  ```ts
  loadVideo(url: string) { this.videoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url); }
  ```
- **Exemple ✅** :
  ```ts
  updateVideoUrl(id: string) {
    const url = 'https://www.youtube.com/embed/' + encodeURIComponent(id);
    this.videoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }
  ```
- **Source** : <https://angular.dev/best-practices/security#trusting-safe-values>

### R-SEC-006 — Manipulation directe du DOM

- **Sévérité** : 🟠 MAJOR
- **Quoi vérifier** : usage de `document.getElementById`, `document.querySelector(...).innerHTML = ...`, `element.innerHTML = ...`, `Document.write` qui contournent Angular.
- **Pattern à flag** : `\.innerHTML\s*=`, `document\.(getElementById|querySelector|write)`, `nativeElement\.innerHTML`
- **Exemple ❌** :
  ```ts
  document.getElementById('out')!.innerHTML = userText;
  ```
- **Exemple ✅** :
  ```ts
  // template: <div>{{ userText() }}</div>
  // ou
  this.renderer.setProperty(el, 'textContent', userText);
  ```
- **Source** : <https://angular.dev/best-practices/security#direct-use-of-the-dom-apis-and-explicit-sanitization-calls>

### R-SEC-007 — `document` global au lieu du token `DOCUMENT`

- **Sévérité** : 🟡 MINOR
- **Quoi vérifier** : référence à `document` global ; doit utiliser `inject(DOCUMENT)` (sécurité SSR + isolement testabilité).
- **Pattern à flag** : `\bdocument\.` non précédé de `this\.`
- **Exemple ❌** :
  ```ts
  document.title = 'Hello';
  ```
- **Exemple ✅** :
  ```ts
  private readonly doc = inject(DOCUMENT);
  // ...
  this.doc.title = 'Hello';
  ```
- **Source** : <https://angular.dev/best-practices/security> + <https://angular.dev/best-practices/performance/ssr>

### R-SEC-008 — JIT activé en production

- **Sévérité** : 🔴 BLOCKER
- **Quoi vérifier** : `angular.json` (`"aot": false`), build flags `--aot=false`, ou import de `@angular/compiler` dans un bundle de prod.
- **Pattern à flag** : `"aot"\s*:\s*false`, `--aot=false`, `import .* from '@angular/compiler'`
- **Exemple ❌** :
  ```json
  { "configurations": { "production": { "aot": false } } }
  ```
- **Exemple ✅** :
  ```json
  { "configurations": { "production": { "aot": true } } }
  ```
- **Source** : <https://angular.dev/best-practices/security#use-the-aot-template-compiler>

### R-SEC-009 — `CSP_NONCE` absent ou statique

- **Sévérité** : 🟠 MAJOR
- **Quoi vérifier** : application avec CSP `script-src 'nonce-...'` mais sans provider `CSP_NONCE`, ou nonce hardcodé / dérivé d'une valeur prédictible.
- **Pattern à flag** : `provide:\s*CSP_NONCE.*useValue:\s*['"]\w+['"]` ou absence totale.
- **Exemple ❌** :
  ```ts
  { provide: CSP_NONCE, useValue: 'static-nonce-123' }
  ```
- **Exemple ✅** :
  ```ts
  bootstrapApplication(AppComponent, {
    providers: [{ provide: CSP_NONCE, useValue: globalThis.myRandomNonceValue }],
  });
  ```
- **Source** : <https://angular.dev/best-practices/security#content-security-policy>

### R-SEC-010 — `autoCsp` désactivé / non configuré

- **Sévérité** : 🟡 MINOR
- **Quoi vérifier** : présence de `autoCsp: true` dans `angular.json` quand l'application sert ses propres assets ; absence à signaler comme INFO.
- **Pattern à flag** : `"autoCsp"\s*:\s*false` ou clé manquante dans le bloc `security`.
- **Exemple ❌** :
  ```json
  { "security": { "autoCsp": false } }
  ```
- **Exemple ✅** :
  ```json
  { "security": { "autoCsp": true } }
  ```
- **Source** : <https://angular.dev/best-practices/security#content-security-policy>

### R-SEC-011 — Trusted Types non configurés alors que `bypassSecurityTrust*` est utilisé

- **Sévérité** : 🟡 MINOR
- **Quoi vérifier** : header `Content-Security-Policy: trusted-types` sans `angular#unsafe-bypass` alors que le code appelle `bypassSecurityTrust*` ; ou absence totale de `require-trusted-types-for 'script'`.
- **Pattern à flag** : `trusted-types` sans `angular#unsafe-bypass` quand `bypassSecurityTrust*` est présent dans le diff.
- **Exemple ❌** :
  ```
  Content-Security-Policy: trusted-types angular; require-trusted-types-for 'script';
  ```
- **Exemple ✅** :
  ```
  Content-Security-Policy: trusted-types angular angular#unsafe-bypass; require-trusted-types-for 'script';
  ```
- **Source** : <https://angular.dev/best-practices/security#enforcing-trusted-types>

### R-SEC-012 — `withNoXsrfProtection()` sans justification

- **Sévérité** : 🟠 MAJOR
- **Quoi vérifier** : appel à `withNoXsrfProtection()` lors du `provideHttpClient`. Doit être commenté avec raison explicite (API tierce, cookies cross-site, etc.).
- **Pattern à flag** : `withNoXsrfProtection\(`
- **Exemple ❌** :
  ```ts
  provideHttpClient(withNoXsrfProtection());
  ```
- **Exemple ✅** :
  ```ts
  // XSRF désactivé : cible une API tierce qui gère son propre token via Bearer
  provideHttpClient(withNoXsrfProtection());
  ```
- **Source** : <https://angular.dev/best-practices/security#xsrf>

### R-SEC-013 — Cookie/header XSRF custom non synchronisé serveur

- **Sévérité** : 🟡 MINOR
- **Quoi vérifier** : `withXsrfConfiguration({ cookieName, headerName })` modifié côté front ; vérifier dans la PR qu'un changement correspondant existe côté backend (ou TODO/issue référencée).
- **Pattern à flag** : `withXsrfConfiguration\(`
- **Exemple ❌** :
  ```ts
  withXsrfConfiguration({ cookieName: 'CUSTOM_XSRF', headerName: 'X-Custom-Xsrf' });
  // pas de changement backend mentionné
  ```
- **Exemple ✅** :
  ```ts
  // backend: voir PR #1234 (configure CUSTOM_XSRF cookie + X-Custom-Xsrf check)
  withXsrfConfiguration({ cookieName: 'CUSTOM_XSRF', headerName: 'X-Custom-Xsrf' });
  ```
- **Source** : <https://angular.dev/best-practices/security#xsrf>

### R-SEC-014 — `allowedHosts` contient `*` en production (SSR)

- **Sévérité** : 🔴 BLOCKER
- **Quoi vérifier** : `angular.json` ou config `AngularAppEngine` avec `allowedHosts: ['*']` ou wildcard non scopé pour la cible production.
- **Pattern à flag** : `"allowedHosts"\s*:\s*\[[^\]]*"\*"` ou `allowedHosts:\s*\[[^\]]*'\*'`
- **Exemple ❌** :
  ```json
  "security": { "allowedHosts": ["*"] }
  ```
- **Exemple ✅** :
  ```json
  "security": { "allowedHosts": ["example.com", "*.example.com"] }
  ```
- **Source** : <https://angular.dev/best-practices/security#ssrf-server-side-request-forgery>

### R-SEC-015 — `trustProxyHeaders: true` sans reverse proxy de confiance

- **Sévérité** : 🟠 MAJOR
- **Quoi vérifier** : `trustProxyHeaders: true` activé alors que le déploiement n'inclut pas de reverse proxy filtrant `X-Forwarded-*`.
- **Pattern à flag** : `trustProxyHeaders\s*:\s*true`
- **Exemple ❌** :
  ```ts
  new AngularAppEngine({ trustProxyHeaders: true, allowedHosts: ['*'] });
  ```
- **Exemple ✅** :
  ```ts
  // Activé uniquement derrière notre reverse proxy GCP (cf. infra/lb.tf)
  new AngularAppEngine({ trustProxyHeaders: true, allowedHosts: ['example.com'] });
  ```
- **Source** : <https://angular.dev/best-practices/security#ssrf-server-side-request-forgery>

### R-SEC-016 — Template SSR généré à partir d'entrées utilisateur

- **Sévérité** : 🔴 BLOCKER
- **Quoi vérifier** : code serveur (Node, Express handler) qui injecte une chaîne utilisateur dans une string de template Angular avant rendu, au lieu de la transférer en JSON consommé par le client.
- **Pattern à flag** : `renderApplication.*\+|template:\s*\`[^\`]*\$\{\s*req\.`
- **Exemple ❌** :
  ```ts
  const html = `<app-root>${req.query.q}</app-root>`;
  await renderApplication(() => bootstrapApplication(AppComponent, { template: html }));
  ```
- **Exemple ✅** :
  ```ts
  // Le serveur transmet la donnée en JSON ; Angular la rend via interpolation.
  res.locals['initialData'] = { query: req.query.q };
  ```
- **Source** : <https://angular.dev/best-practices/security#server-side-rendering>

### R-SEC-017 — `transferCache` capture des requêtes authentifiées

- **Sévérité** : 🔴 BLOCKER
- **Quoi vérifier** : `withHttpTransferCacheOptions` avec `includeRequestsWithAuthHeaders: true` ou sans filtre excluant les endpoints sensibles (`/api/profile`, `/api/me`, ...).
- **Pattern à flag** : `includeRequestsWithAuthHeaders\s*:\s*true`
- **Exemple ❌** :
  ```ts
  provideClientHydration(
    withHttpTransferCacheOptions({ includeRequestsWithAuthHeaders: true })
  );
  ```
- **Exemple ✅** :
  ```ts
  provideClientHydration(
    withHttpTransferCacheOptions({
      includeRequestsWithAuthHeaders: false,
      filter: (req) => !req.url.includes('/api/profile'),
    })
  );
  ```
- **Source** : <https://angular.dev/best-practices/performance/ssr#http-transfer-cache>

### R-SEC-018 — En-têtes sensibles inclus dans `includeHeaders`

- **Sévérité** : 🟠 MAJOR
- **Quoi vérifier** : `includeHeaders` contenant `Authorization`, `Cookie`, `Set-Cookie`, `X-Auth-Token`, ou tout header lié à un secret.
- **Pattern à flag** : `includeHeaders.*['"]?(Authorization|Cookie|Set-Cookie|X-Auth)`
- **Exemple ❌** :
  ```ts
  withHttpTransferCacheOptions({ includeHeaders: ['Authorization', 'ETag'] });
  ```
- **Exemple ✅** :
  ```ts
  withHttpTransferCacheOptions({ includeHeaders: ['ETag'] });
  ```
- **Source** : <https://angular.dev/best-practices/performance/ssr#http-transfer-cache>

### R-SEC-019 — Donnée sensible loggée via `ErrorHandler` global

- **Sévérité** : 🟠 MAJOR
- **Quoi vérifier** : `handleError` qui envoie un payload contenant `error.config`, `request.body`, headers, ou tout objet susceptible de contenir tokens / PII.
- **Pattern à flag** : `handleError.*(headers|token|password|authorization|body)` (insensible à la casse).
- **Exemple ❌** :
  ```ts
  handleError(error: any) {
    this.analytics.track({ event: 'exception', payload: error });
  }
  ```
- **Exemple ✅** :
  ```ts
  handleError(error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown';
    this.analytics.track({ event: 'exception', message });
  }
  ```
- **Source** : <https://angular.dev/best-practices/error-handling>

### R-SEC-020 — `eval` / `Function` constructor dans le code applicatif

- **Sévérité** : 🔴 BLOCKER
- **Quoi vérifier** : usage de `eval(`, `new Function(`, `setTimeout(stringArg, ...)` qui violent CSP et permettent l'exécution de code arbitraire.
- **Pattern à flag** : `\beval\s*\(`, `new Function\s*\(`, `setTimeout\(\s*['"\`]`
- **Exemple ❌** :
  ```ts
  const result = eval(userExpression);
  ```
- **Exemple ✅** :
  ```ts
  const result = safeEvaluator.evaluate(userExpression); // parser dédié
  ```
- **Source** : <https://angular.dev/best-practices/security#content-security-policy>

### R-SEC-021 — Version Angular non maintenue

- **Sévérité** : 🟡 MINOR
- **Quoi vérifier** : `package.json` figeant `@angular/core` sur une version hors fenêtre LTS (Active = N, LTS = N-1). À signaler si la PR touche `package.json` sans bump.
- **Pattern à flag** : version majeure de `@angular/core` hors fenêtre de support. Au 8 octobre 2026 : v22 active, v21 et v20 en LTS, ≤ 19 plus maintenues. Toujours vérifier <https://angular.dev/reference/releases> plutôt que cette date.
- **Exemple ❌** :
  ```json
  { "dependencies": { "@angular/core": "^15.0.0" } }
  ```
- **Exemple ✅** :
  ```json
  { "dependencies": { "@angular/core": "^17.3.0" } }
  ```
- **Source** : <https://angular.dev/reference/releases> + <https://angular.dev/update>

### R-SEC-022 — `sanitize(SecurityContext.NONE, ...)` ou contournement déguisé

- **Sévérité** : 🟠 MAJOR
- **Quoi vérifier** : appel à `sanitize` avec `SecurityContext.NONE` qui désactive toute protection.
- **Pattern à flag** : `SecurityContext\.NONE`
- **Exemple ❌** :
  ```ts
  this.value = this.sanitizer.sanitize(SecurityContext.NONE, raw);
  ```
- **Exemple ✅** :
  ```ts
  this.value = this.sanitizer.sanitize(SecurityContext.HTML, raw);
  ```
- **Source** : <https://angular.dev/best-practices/security#direct-use-of-the-dom-apis-and-explicit-sanitization-calls>

### R-SEC-023 — Secret / token hardcodé

- **Sévérité** : 🔴 BLOCKER
- **Quoi vérifier** : présence de clés API, JWT, mots de passe en clair dans le code source ou `environment.ts`.
- **Pattern à flag** : `(api[_-]?key|secret|token|password)\s*[:=]\s*['"][A-Za-z0-9_\-]{16,}`
- **Exemple ❌** :
  ```ts
  export const environment = { apiKey: '<STRIPE_LIVE_KEY_EXAMPLE_REDACTED>' };
  ```
- **Exemple ✅** :
  ```ts
  export const environment = { apiKey: '' /* injecté au runtime via window.__CFG__ */ };
  ```
- **Source** : règle générale de revue + <https://angular.dev/best-practices/security>

---

## Checklist finale (synthétique)

- [ ] R-SEC-001 — Pas de `[innerHTML]` lié à une entrée non sanitisée
- [ ] R-SEC-002 — Pas de template Angular concaténé avec une entrée
- [ ] R-SEC-003 — Tout `bypassSecurityTrustHtml` est commenté/audité
- [ ] R-SEC-004 — Le contexte de `bypassSecurityTrust*` correspond à l'usage
- [ ] R-SEC-005 — La construction d'URL est faite près de l'entrée
- [ ] R-SEC-006 — Aucune manipulation directe du DOM (`innerHTML`, `document.write`)
- [ ] R-SEC-007 — `inject(DOCUMENT)` plutôt que `document` global
- [ ] R-SEC-008 — AOT activé en prod, pas de JIT, pas d'import `@angular/compiler`
- [ ] R-SEC-009 — `CSP_NONCE` fourni via DI, valeur non statique
- [ ] R-SEC-010 — `autoCsp: true` quand applicable
- [ ] R-SEC-011 — Trusted Types cohérents avec l'usage de `bypassSecurityTrust*`
- [ ] R-SEC-012 — `withNoXsrfProtection()` justifié par un commentaire
- [ ] R-SEC-013 — Cookie/header XSRF custom synchronisé avec le backend
- [ ] R-SEC-014 — `allowedHosts` ne contient pas `*` en prod
- [ ] R-SEC-015 — `trustProxyHeaders` activé seulement derrière un proxy de confiance
- [ ] R-SEC-016 — Pas de template SSR généré à partir d'entrées utilisateur
- [ ] R-SEC-017 — `transferCache` exclut les requêtes authentifiées
- [ ] R-SEC-018 — `includeHeaders` exclut tout en-tête sensible
- [ ] R-SEC-019 — `ErrorHandler` ne logge pas de PII / tokens
- [ ] R-SEC-020 — Aucun `eval` / `new Function` / `setTimeout(string)`
- [ ] R-SEC-021 — Version Angular dans la fenêtre supportée
- [ ] R-SEC-022 — Pas de `SecurityContext.NONE`
- [ ] R-SEC-023 — Aucun secret hardcodé

---

## Format de sortie

Le format des findings est défini **une seule fois**, dans [`REVIEWER_PROMPT.md`](REVIEWER_PROMPT.md) (champs `ruleId`, `severity`, `domain`, `file`, `line`, `snippet`, `message`, `suggestion`, `source`, `evidence`). Ne pas en inventer un autre ici : `scripts/findings.mjs merge` rejette tout finding qui ne respecte pas ce contrat.

- Une entrée par occurrence ; toujours citer le code exact (`snippet`) : il est vérifié contre le fichier.
- N'utiliser que des `ruleId` présents dans ce fichier (ou `R-PROJ-*` pour les règles projet).
- Une règle qui ne s'applique pas à ce projet (version, SSR absent…) ne produit aucun finding.
