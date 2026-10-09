#!/usr/bin/env node
// Périmètre de la revue : les fichiers modifiés par la branche et leurs lignes ajoutées ou modifiées.
//   node scripts/perimetre.mjs [--base main]      en CI : --base origin/<branche cible>
// Écrit .review/perimetre.json à la racine du dépôt. Les dossiers d'outillage (.claude, .agents, .review) sont exclus.

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const base = args.includes('--base') ? args[args.indexOf('--base') + 1] : 'main';
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const racine = git('rev-parse', '--show-toplevel').trim();
const plage = `${base}...HEAD`; // depuis le point où la branche a quitté la base
const exclus = ['--', '.', ':!.claude', ':!.agents', ':!.review'];

// --unified=0 : chaque bloc @@ ne décrit que les lignes ajoutées ou modifiées, sans contexte.
const diff = git('-C', racine, 'diff', '--unified=0', '--no-color', plage, ...exclus);
const fichiers = [];
let courant = null;
for (const ligne of diff.split('\n')) {
  if (ligne.startsWith('+++ ')) {
    const chemin = ligne.slice(4).replace(/^b\//, '');
    courant = chemin === '/dev/null' ? null : { chemin, lignes: [] }; // fichier supprimé : rien à relire
    if (courant) fichiers.push(courant);
  } else if (ligne.startsWith('@@') && courant) {
    const [, debut, nombre = '1'] = ligne.match(/\+(\d+)(?:,(\d+))?/);
    for (let n = Number(debut); n < Number(debut) + Number(nombre); n++) courant.lignes.push(n);
  }
}

const nouveaux = new Set(git('-C', racine, 'diff', '--name-only', '--diff-filter=A', plage, ...exclus).split('\n').filter(Boolean));
const perimetre = { base, fichiers: fichiers.map((f) => ({ ...f, nouveau: nouveaux.has(f.chemin) })) };

mkdirSync(join(racine, '.review'), { recursive: true });
writeFileSync(join(racine, '.review', 'perimetre.json'), JSON.stringify(perimetre, null, 2));
for (const f of perimetre.fichiers) console.log(`${f.nouveau ? 'A' : 'M'} ${f.chemin} — ${f.lignes.length} ligne(s)`);
console.log(`${perimetre.fichiers.length} fichier(s) dans le périmètre (base ${base}) → .review/perimetre.json`);
