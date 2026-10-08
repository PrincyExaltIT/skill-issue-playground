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

  it('compte les caractères du brouillon restauré dès la création', async () => {
    localStorage.setItem(ABSTRACT_DRAFT_KEY, 'Signals partout');

    fixture = TestBed.createComponent(ProposalForm);
    expect(fixture.componentInstance.charCount()).toBe(15);

    await render();
    expect(element('.field__hint').textContent?.trim()).toBe('15 / 600 caractères');
  });
});
