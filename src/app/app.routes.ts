import { Routes } from '@angular/router';
import { ProposalGuard } from './proposals/proposal.guard';

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
  {
    path: 'speakers/:id',
    loadComponent: () => import('./speakers/speaker-spotlight').then((m) => m.SpeakerSpotlight),
    title: 'Speaker · Conf Planner',
  },
  {
    path: 'proposals',
    loadComponent: () => import('./proposals/proposal-form'),
    canActivate: [ProposalGuard],
    title: 'Proposer un talk · Conf Planner',
  },
  { path: '**', redirectTo: '' },
];
