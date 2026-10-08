import { Component, booleanAttribute, computed, inject, input, signal } from '@angular/core';
import { FavoritesStore } from '../favorites/favorites.store';
import { TalkCard } from './talk-card';
import { Speaker, TRACKS, Talk, Track } from './talk.model';
import { TalksStore } from './talks.store';

@Component({
  selector: 'app-talk-list',
  imports: [TalkCard],
  templateUrl: './talk-list.html',
  styleUrl: './talk-list.css',
})
export default class TalkList {
  /** Vrai sur la route `/favoris` (route data liée par withComponentInputBinding). */
  readonly favoritesOnly = input(false, { transform: booleanAttribute });

  private readonly store = inject(TalksStore);
  protected readonly favorites = inject(FavoritesStore);

  protected readonly talks = this.store.talks;
  protected readonly speakersById = this.store.speakersById;
  protected readonly tracks = TRACKS;
  protected readonly query = signal('');
  protected readonly selectedTrack = signal<Track | null>(null);

  protected readonly favoriteIds = computed(() => new Set(this.favorites.favoriteIds()));

  protected readonly visibleTalks = computed(() => {
    const query = normalize(this.query().trim());
    const track = this.selectedTrack();
    const favoritesOnly = this.favoritesOnly();
    const favoriteIds = this.favoriteIds();
    const speakers = this.speakersById();

    return this.store
      .schedule()
      .filter(
        (talk) =>
          (track === null || talk.track === track) &&
          (!favoritesOnly || favoriteIds.has(talk.id)) &&
          (query === '' || searchableText(talk, speakers.get(talk.speakerId)).includes(query)),
      );
  });

  protected readonly resultLabel = computed(() => {
    const count = this.visibleTalks().length;
    return count > 1 ? `${count} talks` : `${count} talk`;
  });

  protected reload(): void {
    this.store.reload();
  }
}

function searchableText(talk: Talk, speaker: Speaker | undefined): string {
  return normalize([talk.title, talk.abstract, ...talk.tags, speaker?.name ?? ''].join(' '));
}

/** Minuscules et sans accents : « sécurité » et « securite » doivent se retrouver. */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}
