import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TalksStore } from '../talks/talks.store';
import { TALKS } from '../talks/testing/talk-fixtures';
import ProposalForm from './proposal-form';

const ABSTRACT_DRAFT_KEY = 'conf-planner:proposal-abstract';

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
