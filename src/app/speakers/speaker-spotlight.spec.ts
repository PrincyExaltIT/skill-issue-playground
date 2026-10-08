import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SpeakerSpotlight } from './speaker-spotlight';

describe('SpeakerSpotlight', () => {
  let component: SpeakerSpotlight;
  let fixture: ComponentFixture<SpeakerSpotlight>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SpeakerSpotlight],
      providers: [provideHttpClient(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(SpeakerSpotlight);
    component = fixture.componentInstance;
  });

  it.only('should create', () => {
    expect(component).toBeTruthy();
  });
});
