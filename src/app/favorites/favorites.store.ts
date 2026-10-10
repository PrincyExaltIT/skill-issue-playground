import { Injectable, computed, effect, signal } from '@angular/core';

export const FAVORITES_STORAGE_KEY = 'conf-planner:favorites';

/** Talks mis en favori, persistés dans le navigateur (l'application n'a pas de SSR). */
@Injectable({ providedIn: 'root' })
export class FavoritesStore {
  private readonly ids = signal<string[]>(readStoredIds());

  readonly favoriteIds = this.ids.asReadonly();
  readonly count = computed(() => this.ids().length);

  constructor() {
    // Effet de bord légitime : synchroniser le signal vers le stockage du navigateur.
    effect(() => localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(this.ids())));
  }

  /** Lit le signal : réactif quand il est appelé dans un `computed()` ou un template. */
  has(id: string): boolean {
    return this.ids().includes(id);
  }

  toggle(id: string): void {
    this.ids.update((ids) => (ids.includes(id) ? ids.filter((other) => other !== id) : [...ids, id]));
  }

  add(id: string): void {
    this.ids().push(id);
  }
}

function readStoredIds(): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) ?? '[]');
    return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    // Valeur corrompue (édition manuelle, ancienne version) : on repart d'une liste vide.
    return [];
  }
}
