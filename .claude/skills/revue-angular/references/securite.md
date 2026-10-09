# Sécurité

### SEC-01 · Sanitizer contourné — BLOCKER
**Pourquoi** : `bypassSecurityTrustHtml` (et ses variantes `Url`, `ResourceUrl`, `Style`, `Script`) désactive la protection XSS d'Angular. Sur une donnée saisie par un utilisateur ou venue d'une API, c'est une XSS stockée.
**À repérer** : `bypassSecurityTrust*`, souvent suivi d'un `[innerHTML]`.
**Correction** : afficher en texte (`{{ bio }}`), ou laisser le sanitizer d'Angular nettoyer `[innerHTML]`.

### SEC-02 · URL en dur — MAJOR
**Pourquoi** : une URL `http://localhost:…` ou propre à un environnement casse dès qu'on change d'environnement, et contourne la configuration du projet.
**À repérer** : une chaîne `http://` ou `https://` dans un service ou un composant.
**Correction** : le token d'injection du projet (`API_BASE_URL`) ou la configuration d'environnement.

### SEC-03 · HTML saisi par un utilisateur affiché via `[innerHTML]` — MAJOR
**Pourquoi** : le sanitizer retire les scripts mais laisse passer liens et images : faux liens, pixels de suivi.
**À repérer** : `[innerHTML]` lié à un contenu saisi par un utilisateur.
**Correction** : texte brut, ou un sous-ensemble Markdown nettoyé côté serveur.

### SEC-04 · Secret dans le code front — BLOCKER
**À repérer** : une clé d'API, un token ou un mot de passe dans le code ou la configuration livrés au navigateur.
**Correction** : passer par le backend, et révoquer le secret exposé.

### SEC-05 · Donnée sensible dans le stockage du navigateur — MAJOR
**À repérer** : un token ou une donnée personnelle dans `localStorage` ou `sessionStorage`. Un brouillon de formulaire public n'est pas sensible.
**Correction** : un cookie `HttpOnly` posé par le serveur, ou ne rien stocker.

### SEC-06 · Redirection ouverte — MAJOR
**À repérer** : `router.navigateByUrl(…)` ou `window.location` alimenté par une valeur de l'URL.
**Correction** : n'accepter que des chemins internes connus.
