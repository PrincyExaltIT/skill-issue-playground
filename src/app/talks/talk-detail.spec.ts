import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FavoritesStore } from '../favorites/favorites.store';
import TalkDetail from './talk-detail';
import { SPEAKERS, TALKS } from './testing/talk-fixtures';

describe('TalkDetail', () => {
  let fixture: ComponentFixture<TalkDetail>;
  let httpTesting: HttpTestingController;
  let host: HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  /** Simule la route `talks/:id` : l'id arrive comme input (withComponentInputBinding). */
  async function renderTalk(id: string): Promise<void> {
    fixture = TestBed.createComponent(TalkDetail);
    fixture.componentRef.setInput('id', id);
    host = fixture.nativeElement;
    TestBed.tick();
    httpTesting.expectOne('/data/talks.json').flush(TALKS);
    httpTesting.expectOne('/data/speakers.json').flush(SPEAKERS);
    await fixture.whenStable();
  }

  function favoriteButton(): HTMLButtonElement {
    const button = host.querySelector<HTMLButtonElement>('button[aria-pressed]');
    if (!button) throw new Error('Bouton favori introuvable');
    return button;
  }

  it("affiche le talk désigné par l'id de la route et son speaker", async () => {
    await renderTalk('mcp-en-pratique');

    expect(host.querySelector('h1')?.textContent?.trim()).toBe('MCP en pratique');
    expect(host.querySelector('.speaker__name')?.textContent?.trim()).toBe('Léa Moreau');
    expect(host.querySelector('.speaker__bio')?.textContent?.trim()).toBe('Ingénieure ML.');
  });

  it('bascule le favori depuis la page détail', async () => {
    await renderTalk('mcp-en-pratique');
    expect(favoriteButton().getAttribute('aria-pressed')).toBe('false');

    favoriteButton().click();
    await fixture.whenStable();

    expect(favoriteButton().getAttribute('aria-pressed')).toBe('true');
    expect(TestBed.inject(FavoritesStore).has('mcp-en-pratique')).toBe(true);
  });

  it("indique quand le talk n'existe pas", async () => {
    await renderTalk('talk-inconnu');

    expect(host.querySelector('h1')?.textContent?.trim()).toBe('Talk introuvable');
  });
});
