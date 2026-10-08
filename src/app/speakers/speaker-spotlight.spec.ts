import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { EMPTY, Observable, Subject, of } from 'rxjs';
import { Speaker } from '../talks/talk.model';
import { CAMILLE, SPEAKERS, TALKS } from '../talks/testing/talk-fixtures';
import { SpeakerSpotlight } from './speaker-spotlight';
import { SpeakerService } from './speaker.service';

describe('SpeakerSpotlight', () => {
  let component: SpeakerSpotlight;
  let fixture: ComponentFixture<SpeakerSpotlight>;
  let harness: RouterTestingHarness;

  /** Réponses de l'API simulée par id ; un test peut en remplacer une (réponse lente, contenu piégé…). */
  let speakerResponses: Map<string, Observable<Speaker>>;

  /** Faux SpeakerService : un id inconnu n'émet rien, la page reste en chargement. */
  const speakerService = {
    getSpeaker: vi.fn((id: string) => speakerResponses.get(id) ?? EMPTY),
    getTalks: vi.fn((speakerId: string) => of(TALKS.filter((talk) => talk.speakerId === speakerId))),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    speakerResponses = new Map(SPEAKERS.map((speaker) => [speaker.id, of(speaker)]));
    await TestBed.configureTestingModule({
      imports: [SpeakerSpotlight],
      providers: [
        provideRouter([{ path: 'speakers/:id', component: SpeakerSpotlight }]),
        { provide: SpeakerService, useValue: speakerService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SpeakerSpotlight);
    component = fixture.componentInstance;
    harness = await RouterTestingHarness.create();
  });

  /** Ouvre la page comme le ferait le routeur, avec l'id dans l'URL. */
  async function openSpeakerPage(id: string): Promise<void> {
    await harness.navigateByUrl(`/speakers/${id}`, SpeakerSpotlight);
  }

  function page(): HTMLElement {
    return harness.routeNativeElement as HTMLElement;
  }

  function heading(): string | undefined {
    return page().querySelector('h1')?.textContent?.trim();
  }

  function talkTitles(): (string | undefined)[] {
    return Array.from(page().querySelectorAll('.talk h3'), (title) => title.textContent?.trim());
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it("charge le speaker désigné par l'URL et ses talks", async () => {
    await openSpeakerPage('camille-laurent');

    expect(speakerService.getSpeaker).toHaveBeenCalledWith('camille-laurent');
    expect(heading()).toBe('Camille Laurent');
    expect(talkTitles()).toEqual(['Signals en production', 'Sécurité front : XSS et sanitizer']);
  });

  it('affiche le speaker quand la réponse arrive après le premier rendu', async () => {
    const response = new Subject<Speaker>();
    speakerResponses.set('camille-laurent', response);

    await openSpeakerPage('camille-laurent');
    expect(page().textContent).toContain('Chargement du speaker');

    response.next(CAMILLE);
    response.complete();
    await harness.fixture.whenStable();

    expect(heading()).toBe('Camille Laurent');
  });

  it("assainit la bio HTML venue de l'API", async () => {
    speakerResponses.set(
      'camille-laurent',
      of({ ...CAMILLE, bio: '<strong>Architecte</strong> <img src="x" onerror="alert(1)">' }),
    );

    await openSpeakerPage('camille-laurent');
    const bio = page().querySelector('.spotlight__bio');

    expect(bio?.querySelector('strong')?.textContent).toBe('Architecte');
    expect(bio?.querySelector('img')?.hasAttribute('onerror')).toBe(false);
  });
});
