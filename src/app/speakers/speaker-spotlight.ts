import { DatePipe, NgFor, NgIf } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { distinctUntilChanged, map, switchMap, tap } from 'rxjs';
import { FavoritesStore } from '../favorites/favorites.store';
import { SpeakerService } from './speaker.service';

@Component({
  selector: 'app-speaker-spotlight',
  imports: [NgIf, NgFor, DatePipe, RouterLink],
  templateUrl: './speaker-spotlight.html',
  styleUrl: './speaker-spotlight.css',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class SpeakerSpotlight implements OnInit {
  @Input() speakerId!: string;
  @Output() select = new EventEmitter<string>();

  readonly speaker = signal<any>(undefined);
  readonly talks = signal<any[]>([]);

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
        }),
        // switchMap annule les requêtes de l'id précédent : une réponse lente ne peut plus l'emporter.
        switchMap((id) => this.speakerService.getSpeaker(id)),
        tap((speaker) => this.speaker.set(speaker)),
        switchMap((speaker) => this.speakerService.getTalks(speaker.id)),
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
