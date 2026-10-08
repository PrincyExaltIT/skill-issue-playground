import { InjectionToken } from '@angular/core';

/**
 * Racine des données de l'application. Par défaut, les fichiers JSON servis depuis `public/data`.
 * Pour pointer vers une vraie API, fournir le token dans `app.config.ts` :
 * `{ provide: API_BASE_URL, useValue: 'https://api.example.com' }`.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => '/data',
});
