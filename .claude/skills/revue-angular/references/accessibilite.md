# Accessibilité

### A11Y-01 · Image sans `alt` — MAJOR
**Pourquoi** : un lecteur d'écran lit le nom du fichier, ou rien.
**À repérer** : `<img>` sans `alt` ni `[alt]`.
**Correction** : `alt="Portrait de {{ speaker.name }}"`, ou `alt=""` si l'image est décorative.

### A11Y-02 · Clic sur un élément non interactif — BLOCKER
**Pourquoi** : un `div` ou un `li` avec `(click)` ne prend pas le focus et ne réagit pas au clavier : le parcours devient inaccessible.
**À repérer** : `(click)` sur `div`, `span`, `li`, `p`, `img` ou `td`.
**Correction** : un `<button type="button">` pour une action, un lien (`routerLink`) pour une navigation.

### A11Y-03 · Champ de formulaire sans label — BLOCKER
**Pourquoi** : un placeholder n'est pas un label : il disparaît à la saisie et n'est pas toujours annoncé.
**À repérer** : `<input>`, `<select>` ou `<textarea>` sans `<label for>` associé ni `aria-label`.
**Correction** : `<label for="title">Titre</label>` puis `<input id="title" …>`.

### A11Y-04 · Changement d'état non annoncé — MINOR
**À repérer** : un message de confirmation ou d'erreur ajouté dynamiquement, sans `role="status"`, `role="alert"` ni `aria-live`.
**Correction** : `<p role="status">{{ feedback() }}</p>`.

### A11Y-05 · État d'un bouton bascule invisible — MINOR
**À repérer** : un bouton qui bascule (favori, filtre) sans `aria-pressed`.
**Correction** : `[attr.aria-pressed]="isFavorite()"`.
