import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { EMPTY, of } from 'rxjs';
import { Speaker } from '../talks/talk.model';
import { CAMILLE, SPEAKERS, TALKS } from '../talks/testing/talk-fixtures';
import { SpeakerSpotlight } from './speaker-spotlight';
import { SpeakerService } from './speaker.service';

describe('SpeakerSpotlight', () => {
  let component: SpeakerSpotlight;
  let fixture: ComponentFixture<SpeakerSpotlight>;

  /** Speakers connus de l'API simulée ; un test peut en remplacer le contenu. */
  let apiSpeakers: Speaker[];

  /** Faux SpeakerService : un id inconnu n'émet rien, la page reste en chargement. */
  const speakerService = {
    getSpeaker: vi.fn((id: string) => {
      const speaker = apiSpeakers.find((candidate) => candidate.id === id);
      return speaker ? of(speaker) : EMPTY;
    }),
    getTalks: vi.fn((speakerId: string) => of(TALKS.filter((talk) => talk.speakerId === speakerId))),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    apiSpeakers = SPEAKERS;
    await TestBed.configureTestingModule({
      imports: [SpeakerSpotlight],
      providers: [
        provideRouter([{ path: 'speakers/:id', component: SpeakerSpotlight }]),
        { provide: SpeakerService, useValue: speakerService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SpeakerSpotlight);
    component = fixture.componentInstance;
  });

  /** Ouvre la page comme le ferait le routeur, avec l'id dans l'URL. */
  async function openSpeakerPage(id: string): Promise<HTMLElement> {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/speakers/${id}`, SpeakerSpotlight);
    return harness.routeNativeElement as HTMLElement;
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it("charge le speaker désigné par l'URL et ses talks", async () => {
    const page = await openSpeakerPage('camille-laurent');

    expect(speakerService.getSpeaker).toHaveBeenCalledWith('camille-laurent');
    expect(page.querySelector('h1')?.textContent?.trim()).toBe('Camille Laurent');
    expect(Array.from(page.querySelectorAll('.talk h3'), (title) => title.textContent?.trim())).toEqual([
      'Signals en production',
      'Sécurité front : XSS et sanitizer',
    ]);
  });

  it("assainit la bio HTML venue de l'API", async () => {
    apiSpeakers = [{ ...CAMILLE, bio: '<strong>Architecte</strong> <img src="x" onerror="alert(1)">' }];

    const page = await openSpeakerPage('camille-laurent');
    const bio = page.querySelector('.spotlight__bio');

    expect(bio?.querySelector('strong')?.textContent).toBe('Architecte');
    expect(bio?.querySelector('img')?.hasAttribute('onerror')).toBe(false);
  });
});
