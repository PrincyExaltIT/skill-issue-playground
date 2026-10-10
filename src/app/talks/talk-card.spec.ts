import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TalkCard } from './talk-card';
import { CAMILLE, SIGNALS_TALK } from './testing/talk-fixtures';

describe('TalkCard', () => {
  let fixture: ComponentFixture<TalkCard>;
  let host: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    fixture = TestBed.createComponent(TalkCard);
    fixture.componentRef.setInput('talk', SIGNALS_TALK);
    fixture.componentRef.setInput('speaker', CAMILLE);
    host = fixture.nativeElement;
    await fixture.whenStable();
  });

  function favoriteButton(): HTMLButtonElement {
    const button = host.querySelector<HTMLButtonElement>('button.fav-toggle');
    if (!button) throw new Error('Bouton favori introuvable');
    return button;
  }

  it('affiche le talk, son track, le speaker et un lien vers le détail', () => {
    expect(host.querySelector('h2')?.textContent?.trim()).toBe('Signals en production');
    expect(host.querySelector('.track-badge')?.textContent?.trim()).toBe('Frontend');
    expect(host.querySelector('.avatar')?.textContent?.trim()).toBe('CL');
    expect(host.querySelector('.talk-card__speaker-name')?.textContent?.trim()).toBe('Camille Laurent');
    expect(host.querySelector('h2 a')?.getAttribute('href')).toBe('/talks/signals-en-production');
  });

  it("émet l'id du talk au clic sur le bouton favori", () => {
    const emitted: string[] = [];
    fixture.componentInstance.favoriteToggled.subscribe((id) => emitted.push(id));

    favoriteButton().click();

    expect(emitted).toEqual(['signals-en-production']);
  });

  it("annonce l'ajout ou le retrait selon l'état favori courant", async () => {
    const feedback = () => host.querySelector('.talk-card__feedback')?.textContent?.trim();

    favoriteButton().click();
    await fixture.whenStable();
    expect(feedback()).toBe('Ajouté à vos favoris');

    fixture.componentRef.setInput('isFavorite', true);
    favoriteButton().click();
    await fixture.whenStable();
    expect(feedback()).toBe('Retiré de vos favoris');
  });

  it("expose l'état favori avec aria-pressed et une classe sur l'hôte", async () => {
    expect(favoriteButton().getAttribute('aria-pressed')).toBe('false');
    expect(favoriteButton().textContent).toContain('Favori : Signals en production');

    fixture.componentRef.setInput('isFavorite', true);
    await fixture.whenStable();

    expect(favoriteButton().getAttribute('aria-pressed')).toBe('true');
    expect(host.classList).toContain('talk-card--favorite');
  });

  it("reste lisible quand le speaker n'est pas (encore) chargé", async () => {
    fixture.componentRef.setInput('speaker', undefined);
    await fixture.whenStable();

    expect(host.querySelector('.talk-card__speaker')).toBeNull();
    expect(host.querySelector('h2')?.textContent?.trim()).toBe('Signals en production');
  });
});
