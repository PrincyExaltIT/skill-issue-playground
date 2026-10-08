import { Component, ElementRef, inject, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, skip } from 'rxjs';
import { FavoritesStore } from './favorites/favorites.store';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly favoritesCount = inject(FavoritesStore).count;
  private readonly main = viewChild.required<ElementRef<HTMLElement>>('main');

  constructor() {
    // Après chaque navigation (hors chargement initial), le focus passe au contenu principal :
    // un lecteur d'écran annonce la nouvelle page au lieu de rester sur le lien cliqué.
    inject(Router)
      .events.pipe(
        filter((event) => event instanceof NavigationEnd),
        skip(1),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.main().nativeElement.focus({ preventScroll: true }));
  }
}
