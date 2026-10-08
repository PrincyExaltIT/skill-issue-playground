import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./talks/talk-list'),
    title: 'Programme · Conf Planner',
  },
  {
    path: 'favoris',
    loadComponent: () => import('./talks/talk-list'),
    data: { favoritesOnly: true },
    title: 'Mes favoris · Conf Planner',
  },
  {
    path: 'talks/:id',
    loadComponent: () => import('./talks/talk-detail'),
    title: 'Talk · Conf Planner',
  },
  { path: '**', redirectTo: '' },
];
