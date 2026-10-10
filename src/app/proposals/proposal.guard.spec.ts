import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { ProposalGuard } from './proposal.guard';

/** Clôture de l'appel à orateurs : 30 novembre 2026 à 23:59:59, heure locale. */
const CFP_CLOSES_AT = new Date('2026-11-30T23:59:59').getTime();

describe('ProposalGuard', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    vi.useFakeTimers({ toFake: ['Date'] });
  });

  afterEach(() => vi.useRealTimers());

  function canActivateAt(time: number): boolean | UrlTree {
    vi.setSystemTime(time);
    return TestBed.inject(ProposalGuard).canActivate();
  }

  it('ouvre le formulaire avant la clôture', () => {
    expect(canActivateAt(CFP_CLOSES_AT - 1)).toBe(true);
  });

  it("ouvre encore le formulaire à l'instant exact de la clôture", () => {
    expect(canActivateAt(CFP_CLOSES_AT)).toBe(true);
  });

  it('redirige vers le programme dès la clôture passée', () => {
    const result = canActivateAt(CFP_CLOSES_AT + 1);

    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/');
  });
});
