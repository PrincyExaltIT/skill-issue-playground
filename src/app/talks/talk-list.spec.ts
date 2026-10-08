import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FavoritesStore } from '../favorites/favorites.store';
import TalkList from './talk-list';
import { SPEAKERS, TALKS } from './testing/talk-fixtures';

describe('TalkList', () => {
  let fixture: ComponentFixture<TalkList>;
  let httpTesting: HttpTestingController;
  let host: HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TalkList);
    host = fixture.nativeElement;
  });

  afterEach(() => httpTesting.verify());

  /** Laisse httpResource émettre ses requêtes, puis y répond avec les fixtures. */
  async function respondWithProgramme(): Promise<void> {
    TestBed.tick();
    httpTesting.expectOne('/data/talks.json').flush(TALKS);
    httpTesting.expectOne('/data/speakers.json').flush(SPEAKERS);
    await fixture.whenStable();
  }

  function element<T extends Element>(selector: string): T {
    const found = host.querySelector<T>(selector);
    if (!found) throw new Error(`Élément introuvable : ${selector}`);
    return found;
  }

  function visibleTitles(): string[] {
    return Array.from(host.querySelectorAll('app-talk-card h2'), (title) => title.textContent?.trim() ?? '');
  }

  async function search(text: string): Promise<void> {
    const input = element<HTMLInputElement>('input#search');
    input.value = text;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  function trackChip(label: string): HTMLButtonElement {
    const chip = Array.from(host.querySelectorAll<HTMLButtonElement>('button.chip')).find(
      (button) => button.textContent?.trim() === label,
    );
    if (!chip) throw new Error(`Filtre introuvable : ${label}`);
    return chip;
  }

  it('affiche un état de chargement puis les talks triés par horaire', async () => {
    TestBed.tick();
    expect(element('[role="status"]').textContent).toContain('Chargement du programme');

    httpTesting.expectOne('/data/talks.json').flush(TALKS);
    httpTesting.expectOne('/data/speakers.json').flush(SPEAKERS);
    await fixture.whenStable();

    expect(visibleTitles()).toEqual([
      'Signals en production',
      'Sécurité front : XSS et sanitizer',
      'MCP en pratique',
    ]);
    expect(element('.result-count').textContent?.trim()).toBe('3 talks');
  });

  it('filtre sur le texte sans tenir compte de la casse ni des accents', async () => {
    await respondWithProgramme();

    await search('SECURITE');

    expect(visibleTitles()).toEqual(['Sécurité front : XSS et sanitizer']);
    expect(element('.result-count').textContent?.trim()).toBe('1 talk');
  });

  it('cherche aussi dans le nom du speaker', async () => {
    await respondWithProgramme();

    await search('léa');

    expect(visibleTitles()).toEqual(['MCP en pratique']);
  });

  it('filtre par track et signale le filtre actif avec aria-pressed', async () => {
    await respondWithProgramme();

    trackChip('IA').click();
    await fixture.whenStable();

    expect(visibleTitles()).toEqual(['MCP en pratique']);
    expect(trackChip('IA').getAttribute('aria-pressed')).toBe('true');
    expect(trackChip('Tous').getAttribute('aria-pressed')).toBe('false');
  });

  it('affiche un message quand aucun talk ne correspond', async () => {
    await respondWithProgramme();

    await search('cobol');

    expect(visibleTitles()).toEqual([]);
    expect(element('.empty').textContent).toContain('Aucun talk ne correspond');
  });

  it("sur /favoris, n'affiche que les favoris et relaie le clic au store", async () => {
    fixture.componentRef.setInput('favoritesOnly', true);
    await respondWithProgramme();
    expect(element('h1').textContent?.trim()).toBe('Mes favoris');
    expect(element('.empty').textContent).toContain('Aucun favori');

    const favorites = TestBed.inject(FavoritesStore);
    favorites.toggle('mcp-en-pratique');
    await fixture.whenStable();
    expect(visibleTitles()).toEqual(['MCP en pratique']);

    element<HTMLButtonElement>('app-talk-card button.fav-toggle').click();
    await fixture.whenStable();
    expect(favorites.has('mcp-en-pratique')).toBe(false);
    expect(visibleTitles()).toEqual([]);
  });

  it('affiche une alerte si le chargement échoue et recharge sur « Réessayer »', async () => {
    TestBed.tick();
    httpTesting
      .expectOne('/data/talks.json')
      .flush('Erreur serveur', { status: 500, statusText: 'Internal Server Error' });
    httpTesting.expectOne('/data/speakers.json').flush(SPEAKERS);
    await fixture.whenStable();

    const alert = element('[role="alert"]');
    expect(alert.textContent).toContain('Impossible de charger le programme');

    element<HTMLButtonElement>('[role="alert"] button').click();
    TestBed.tick();
    httpTesting.expectOne('/data/talks.json').flush(TALKS);
    httpTesting.expectOne('/data/speakers.json').flush(SPEAKERS);
    await fixture.whenStable();

    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(visibleTitles()).toHaveLength(3);
  });
});
