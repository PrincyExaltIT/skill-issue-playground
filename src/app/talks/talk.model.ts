export const TRACKS = ['Frontend', 'Backend', 'IA', 'DevEx'] as const;

export type Track = (typeof TRACKS)[number];

export interface Talk {
  readonly id: string;
  readonly title: string;
  readonly abstract: string;
  readonly track: Track;
  readonly speakerId: string;
  readonly room: string;
  /** Début du talk, ISO 8601 en heure locale du lieu (ex. `2026-11-19T09:30:00`). */
  readonly start: string;
  readonly durationMin: number;
  readonly tags: readonly string[];
}

export interface Speaker {
  readonly id: string;
  readonly name: string;
  readonly company: string;
  /** Texte brut : toujours affiché par interpolation, jamais comme HTML. */
  readonly bio: string;
  readonly handle: string;
}
