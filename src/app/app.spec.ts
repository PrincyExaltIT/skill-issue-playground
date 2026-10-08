import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { App } from './app';
import { FavoritesStore } from './favorites/favorites.store';

@Component({ template: '<h1>Page de test</h1>' })
class StubPage {}

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', component: StubPage },
          { path: 'favoris', component: StubPage },
        ]),
      ],
    });
  });

  function navLinks(root: HTMLElement): string[] {
    return Array.from(root.querySelectorAll('nav a'), (link) =>
      (link.textContent ?? '').replace(/\s+/g, ' ').trim(),
    );
  }

  it('affiche la marque et la navigation principale', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;

    expect(root.querySelector('.brand')?.textContent).toContain('Conf Planner');
    expect(navLinks(root)).toContain('Programme');
    expect(navLinks(root)).toContain('Mes favoris 0');
  });

  it('signale la page courante avec aria-current="page"', async () => {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/favoris');
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;

    expect(root.querySelector('nav a[href="/favoris"]')?.getAttribute('aria-current')).toBe('page');
    expect(root.querySelector('nav a[href="/"]')?.hasAttribute('aria-current')).toBe(false);
  });

  it('met à jour le compteur de favoris quand le store change', async () => {
    const fixture = TestBed.createComponent(App);
    const favorites = TestBed.inject(FavoritesStore);
    await fixture.whenStable();

    favorites.toggle('signals-en-production');
    favorites.toggle('mcp-en-pratique');
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.nav__counter')?.textContent?.trim()).toBe('2');
  });
});
