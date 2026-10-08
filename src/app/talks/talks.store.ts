import { httpResource } from '@angular/common/http';
import { Injectable, computed, inject } from '@angular/core';
import { API_BASE_URL } from '../core/api-base-url';
import { Speaker, Talk } from './talk.model';

/** Programme de la conférence : talks et speakers chargés via httpResource. */
@Injectable({ providedIn: 'root' })
export class TalksStore {
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly talksResource = httpResource<Talk[]>(() => `${this.baseUrl}/talks.json`);
  private readonly speakersResource = httpResource<Speaker[]>(() => `${this.baseUrl}/speakers.json`);

  /** État du chargement du programme (`isLoading`, `error`, `hasValue`), en lecture seule. */
  readonly talks = this.talksResource.asReadonly();

  /** Talks triés par horaire ; liste vide tant que le programme n'est pas chargé. */
  readonly schedule = computed(() =>
    this.talks.hasValue()
      ? [...this.talks.value()].sort((a, b) => a.start.localeCompare(b.start))
      : [],
  );

  /**
   * Speakers indexés par id. Ils enrichissent l'affichage : si leur chargement échoue,
   * les talks restent consultables, simplement sans speaker.
   */
  readonly speakersById = computed(() => {
    const speakers = this.speakersResource.hasValue() ? this.speakersResource.value() : [];
    return new Map(speakers.map((speaker) => [speaker.id, speaker]));
  });

  reload(): void {
    this.talksResource.reload();
    this.speakersResource.reload();
  }
}
