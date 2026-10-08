import { DatePipe, NgFor, NgIf } from '@angular/common';
import { Component, DestroyRef, Input, OnInit, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EMPTY, catchError, distinctUntilChanged, map, switchMap, tap } from 'rxjs';
import { FavoritesStore } from '../favorites/favorites.store';
import { SpeakerService } from './speaker.service';

@Component({
  selector: 'app-speaker-spotlight',
  imports: [NgIf, NgFor, DatePipe, RouterLink],
  templateUrl: './speaker-spotlight.html',
  styleUrl: './speaker-spotlight.css',
})
export class SpeakerSpotlight implements OnInit {
  @Input() speakerId!: string;
  readonly talkSelected = output<string>();

  readonly speaker = signal<any>(undefined);
  readonly talks = signal<any[]>([]);
  readonly loadError = signal(false);
  readonly talksError = signal(false);

  private destroyRef = inject(DestroyRef);
  private route = inject(ActivatedRoute);
  private speakerService = inject(SpeakerService);
  private favorites = inject(FavoritesStore);

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        map((params) => params.get('id') ?? this.speakerId),
        distinctUntilChanged(),
        tap(() => {
          this.speaker.set(undefined);
          this.talks.set([]);
          this.loadError.set(false);
          this.talksError.set(false);
        }),
        // switchMap annule les requêtes de l'id précédent : une réponse lente ne peut plus l'emporter.
        switchMap((id) =>
          this.speakerService.getSpeaker(id).pipe(
            catchError(() => {
              this.loadError.set(true);
              return EMPTY;
            }),
          ),
        ),
        tap((speaker) => this.speaker.set(speaker)),
        switchMap((speaker) =>
          this.speakerService.getTalks(speaker.id).pipe(
            catchError(() => {
              this.talksError.set(true);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((talks) => this.talks.set(talks));
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  }

  addAllToFavorites(): void {
    this.talks().forEach((talk) => this.favorites.add(talk.id));
  }
}
