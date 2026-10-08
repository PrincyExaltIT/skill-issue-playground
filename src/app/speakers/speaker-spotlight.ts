import { DatePipe, NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
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

  speaker: any;
  talks: any[] = [];
  bioHtml: SafeHtml | null = null;

  private route = inject(ActivatedRoute);
  private sanitizer = inject(DomSanitizer);
  private speakerService = inject(SpeakerService);
  private favorites = inject(FavoritesStore);

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const id = params.get('id') ?? this.speakerId;
      this.speakerService.getSpeaker(id).subscribe((speaker) => {
        this.speaker = speaker;
        this.bioHtml = this.sanitizer.bypassSecurityTrustHtml(speaker.bio);
        this.speakerService.getTalks(speaker.id).subscribe((talks) => {
          this.talks = talks;
        });
      });
    });
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  }

  addAllToFavorites(): void {
    this.talks.forEach((talk) => this.favorites.add(talk.id));
  }
}
