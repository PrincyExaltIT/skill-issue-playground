import { Speaker, Talk } from '../talk.model';

export const CAMILLE: Speaker = {
  id: 'camille-laurent',
  name: 'Camille Laurent',
  company: 'Studio Hexa',
  bio: 'Architecte front-end.',
  handle: '@camille.codes',
};

export const LEA: Speaker = {
  id: 'lea-moreau',
  name: 'Léa Moreau',
  company: 'Orbital Labs',
  bio: 'Ingénieure ML.',
  handle: '@lea.moreau',
};

export const SIGNALS_TALK: Talk = {
  id: 'signals-en-production',
  title: 'Signals en production',
  abstract: "Un an de retours d'expérience.",
  track: 'Frontend',
  speakerId: CAMILLE.id,
  room: 'Amphi Turing',
  start: '2026-11-19T09:30:00',
  durationMin: 45,
  tags: ['angular', 'signals'],
};

export const SECURITY_TALK: Talk = {
  id: 'securite-front',
  title: 'Sécurité front : XSS et sanitizer',
  abstract: "Ce que le sanitizer protège, et ce qu'il ne protège pas.",
  track: 'Frontend',
  speakerId: CAMILLE.id,
  room: 'Salle Hopper',
  start: '2026-11-19T11:00:00',
  durationMin: 30,
  tags: ['angular', 'sécurité'],
};

export const MCP_TALK: Talk = {
  id: 'mcp-en-pratique',
  title: 'MCP en pratique',
  abstract: 'Brancher vos outils internes sur un agent.',
  track: 'IA',
  speakerId: LEA.id,
  room: 'Salle Lovelace',
  start: '2026-11-19T16:00:00',
  durationMin: 30,
  tags: ['ia', 'mcp'],
};

/** Volontairement dans le désordre : le store doit trier par horaire. */
export const TALKS: Talk[] = [MCP_TALK, SIGNALS_TALK, SECURITY_TALK];
export const SPEAKERS: Speaker[] = [CAMILLE, LEA];
