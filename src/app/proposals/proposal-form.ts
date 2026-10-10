import { Component, DestroyRef, OnInit, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { TRACKS, Track } from '../talks/talk.model';
import { TalksStore } from '../talks/talks.store';

const ABSTRACT_DRAFT_KEY = 'conf-planner:proposal-abstract';

@Component({
  selector: 'app-proposal-form',
  imports: [ReactiveFormsModule],
  templateUrl: './proposal-form.html',
  styleUrl: './proposal-form.css',
})
export default class ProposalForm implements OnInit {
  private fb = inject(UntypedFormBuilder);
  private destroyRef = inject(DestroyRef);
  private talksStore = inject(TalksStore);

  abstract = signal(localStorage.getItem(ABSTRACT_DRAFT_KEY) ?? '');
  selectedTrack = signal<Track>('Frontend');
  sameTrackTalks = computed(() =>
    this.talksStore.schedule().filter((talk) => talk.track === this.selectedTrack()),
  );

  tracks = TRACKS;
  form: UntypedFormGroup = this.fb.group({
    title: ['', Validators.required],
    track: ['Frontend', Validators.required],
    bio: [''],
  });
  draft: Record<string, unknown> = {};
  charCount = signal(0);
  submitted = false;

  constructor() {
    effect(() => {
      this.charCount.set(this.abstract().length);
    });

    effect(() => {
      localStorage.setItem(ABSTRACT_DRAFT_KEY, this.abstract());
    });
  }

  ngOnInit(): void {
    this.form.valueChanges.subscribe(v => this.draft = v);

    this.form
      .get('track')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((track: Track) => this.selectedTrack.set(track));
  }

  onAbstractInput(event: Event): void {
    this.abstract.set((event.target as HTMLTextAreaElement).value);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const proposal = { ...this.draft, abstract: this.abstract() };
    localStorage.setItem('conf-planner:last-proposal', JSON.stringify(proposal));
    setTimeout(() => {
      this.submitted = true;
    }, 300);
  }
}
