import { DatePipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { initialsOf } from './initials';
import { Speaker, Talk } from './talk.model';

@Component({
  selector: 'app-talk-card',
  imports: [DatePipe, RouterLink],
  templateUrl: './talk-card.html',
  styleUrl: './talk-card.css',
  host: {
    class: 'talk-card',
    '[class.talk-card--favorite]': 'isFavorite()',
    '[attr.data-track]': 'talk().track',
  },
})
export class TalkCard {
  readonly talk = input.required<Talk>();
  readonly speaker = input<Speaker | undefined>();
  readonly isFavorite = input(false);
  readonly favoriteToggled = output<string>();

  protected readonly initials = computed(() => initialsOf(this.speaker()?.name ?? ''));

  protected toggleFavorite(): void {
    this.favoriteToggled.emit(this.talk().id);
  }
}
