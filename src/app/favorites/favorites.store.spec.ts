import { TestBed } from '@angular/core/testing';
import { FAVORITES_STORAGE_KEY, FavoritesStore } from './favorites.store';

describe('FavoritesStore', () => {
  beforeEach(() => localStorage.clear());

  function storedIds(): unknown {
    return JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) ?? 'null');
  }

  it('ajoute puis retire un talk avec toggle()', () => {
    const store = TestBed.inject(FavoritesStore);

    store.toggle('signals-en-production');
    expect(store.has('signals-en-production')).toBe(true);
    expect(store.count()).toBe(1);

    store.toggle('signals-en-production');
    expect(store.has('signals-en-production')).toBe(false);
    expect(store.count()).toBe(0);
  });

  it('produit une nouvelle liste à chaque changement, sans muter la précédente', () => {
    const store = TestBed.inject(FavoritesStore);
    const before = store.favoriteIds();

    store.toggle('mcp-en-pratique');

    expect(store.favoriteIds()).not.toBe(before);
    expect(before).toEqual([]);
    expect(store.favoriteIds()).toEqual(['mcp-en-pratique']);
  });

  it('ajoute un talk avec add(), sans doublon, et notifie les lecteurs', () => {
    const store = TestBed.inject(FavoritesStore);
    const before = store.favoriteIds();

    store.add('mcp-en-pratique');
    store.add('mcp-en-pratique');
    TestBed.tick();

    expect(before).toEqual([]);
    expect(store.favoriteIds()).toEqual(['mcp-en-pratique']);
    expect(store.count()).toBe(1);
    expect(storedIds()).toEqual(['mcp-en-pratique']);
  });

  it('persiste les favoris dans localStorage', () => {
    const store = TestBed.inject(FavoritesStore);

    store.toggle('mcp-en-pratique');
    store.toggle('signals-en-production');
    TestBed.tick(); // exécute l'effet de persistance

    expect(storedIds()).toEqual(['mcp-en-pratique', 'signals-en-production']);
  });

  it('restaure les favoris enregistrés au démarrage', () => {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(['ci-monorepo']));

    const store = TestBed.inject(FavoritesStore);

    expect(store.has('ci-monorepo')).toBe(true);
    expect(store.count()).toBe(1);
  });

  it('ignore une valeur corrompue dans localStorage', () => {
    localStorage.setItem(FAVORITES_STORAGE_KEY, '{pas du json');

    const store = TestBed.inject(FavoritesStore);

    expect(store.favoriteIds()).toEqual([]);
  });
});
