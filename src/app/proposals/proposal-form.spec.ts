import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TalksStore } from '../talks/talks.store';
import { TALKS } from '../talks/testing/talk-fixtures';
import ProposalForm from './proposal-form';

const ABSTRACT_DRAFT_KEY = 'conf-planner:proposal-abstract';
const LAST_PROPOSAL_KEY = 'conf-planner:last-proposal';

describe('ProposalForm', () => {
  let fixture: ComponentFixture<ProposalForm>;
  let host: HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [{ provide: TalksStore, useValue: { schedule: signal(TALKS) } }],
    });
  });

  async function render(): Promise<void> {
    fixture = TestBed.createComponent(ProposalForm);
    host = fixture.nativeElement;
    await fixture.whenStable();
  }

  function element<T extends Element>(selector: string): T {
    const found = host.querySelector<T>(selector);
    if (!found) throw new Error(`Élément introuvable : ${selector}`);
    return found;
  }

  function type(selector: string, value: string): void {
    const field = element<HTMLInputElement | HTMLTextAreaElement>(selector);
    field.value = value;
    field.dispatchEvent(new Event('input'));
  }

  function submit(): void {
    element<HTMLButtonElement>('button[type="submit"]').click();
  }

  async function chooseTrack(track: string): Promise<void> {
    const select = element<HTMLSelectElement>('select#track');
    select.value = track;
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
  }

  function sameTrackTitles(): (string | undefined)[] {
    return Array.from(host.querySelectorAll('.same-track li'), (item) => item.textContent?.trim());
  }

  it('donne un nom accessible à chaque champ', async () => {
    await render();

    for (const id of ['proposal-title', 'track', 'abstract', 'bio']) {
      expect(host.querySelector(`label[for="${id}"]`)?.textContent?.trim(), id).toBeTruthy();
    }
    expect(element('label[for="proposal-title"]').textContent?.trim()).toBe('Titre du talk');
  });

  it("refuse l'envoi sans titre et ne garde aucune proposition", async () => {
    await render();

    submit();
    await fixture.whenStable();

    expect(element('#proposal-title').classList).toContain('ng-invalid');
    expect(element('#proposal-title').classList).toContain('ng-touched');
    expect(localStorage.getItem(LAST_PROPOSAL_KEY)).toBeNull();
  });

  it('enregistre le résumé en brouillon pendant la saisie', async () => {
    await render();

    type('#abstract', 'Un an de signals');
    await fixture.whenStable();

    expect(localStorage.getItem(ABSTRACT_DRAFT_KEY)).toBe('Un an de signals');
    expect(element('.field__hint').textContent?.trim()).toBe('16 / 600 caractères');
  });

  it('liste les talks déjà au programme sur le track choisi', async () => {
    await render();
    expect(sameTrackTitles()).toEqual(['Signals en production', 'Sécurité front : XSS et sanitizer']);

    await chooseTrack('IA');

    expect(element('#same-track-title').textContent?.trim()).toBe('Déjà au programme en IA');
    expect(sameTrackTitles()).toEqual(['MCP en pratique']);

    await chooseTrack('DevEx');
    expect(sameTrackTitles()).toEqual(["Aucun talk sur ce track pour l'instant."]);
  });

  it("enregistre la proposition complète à l'envoi", async () => {
    await render();

    type('#proposal-title', 'Zoneless sans douleur');
    await chooseTrack('Backend');
    type('#abstract', 'Retour de migration.');
    type('#bio', 'Dev Angular.');
    submit();

    expect(JSON.parse(localStorage.getItem(LAST_PROPOSAL_KEY) ?? 'null')).toEqual({
      title: 'Zoneless sans douleur',
      track: 'Backend',
      bio: 'Dev Angular.',
      abstract: 'Retour de migration.',
    });
  });

  it('affiche la confirmation après l’envoi, sans autre interaction', async () => {
    await render();
    vi.useFakeTimers();
    try {
      type('#proposal-title', 'Signals en production');
      submit();

      await vi.advanceTimersByTimeAsync(299);
      expect(element('[role="status"]').textContent?.trim()).toBe('');

      // 1 ms pour le délai de confirmation, puis le temps que le planificateur zoneless rafraîchisse la vue.
      await vi.advanceTimersByTimeAsync(50);
      expect(element('[role="status"]').textContent).toContain('Merci ! Votre proposition a bien été enregistrée.');
    } finally {
      vi.useRealTimers();
    }
  });

  it('compte les caractères du brouillon restauré dès la création', async () => {
    localStorage.setItem(ABSTRACT_DRAFT_KEY, 'Signals partout');

    fixture = TestBed.createComponent(ProposalForm);
    expect(fixture.componentInstance.charCount()).toBe(15);

    await render();
    expect(element('.field__hint').textContent?.trim()).toBe('15 / 600 caractères');
  });
});
