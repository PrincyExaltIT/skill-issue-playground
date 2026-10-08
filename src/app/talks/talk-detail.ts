import { DatePipe } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FavoritesStore } from '../favorites/favorites.store';
import { initialsOf } from './initials';
import { TalksStore } from './talks.store';

@Component({
  selector: 'app-talk-detail',
  imports: [DatePipe, RouterLink],
  templateUrl: './talk-detail.html',
  styleUrl: './talk-detail.css',
})
export default class TalkDetail {
  /** Paramètre `:id` de la route, lié par withComponentInputBinding(). */
  readonly id = input.required<string>();

  private readonly store = inject(TalksStore);
  private readonly favorites = inject(FavoritesStore);

  protected readonly talks = this.store.talks;
  protected readonly talk = computed(() => this.store.schedule().find((talk) => talk.id === this.id()));
  protected readonly speaker = computed(() => {
    const talk = this.talk();
    return talk ? this.store.speakersById().get(talk.speakerId) : undefined;
  });
  protected readonly speakerInitials = computed(() => initialsOf(this.speaker()?.name ?? ''));
  protected readonly isFavorite = computed(() => this.favorites.has(this.id()));

  protected toggleFavorite(): void {
    this.favorites.toggle(this.id());
  }
}
