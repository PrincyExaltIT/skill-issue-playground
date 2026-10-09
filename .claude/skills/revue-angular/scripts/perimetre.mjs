#!/usr/bin/env node
// Périmètre de la revue : les fichiers modifiés par la branche et leurs lignes ajoutées ou modifiées.
//   node scripts/perimetre.mjs [--base main]      en CI : --base origin/<branche cible>
//   node scripts/perimetre.mjs --travail          ajoute le travail non commité (pour un hook, ou avant de commiter)
// Écrit .review/perimetre.json à la racine du dépôt. Les dossiers d'outillage (.claude, .agents, .review) sont exclus.

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const travail = args.includes('--travail');
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const racine = git('rev-parse', '--show-toplevel').trim();
// Dans un clone neuf, la branche de base n'existe souvent que sur le remote : origin/<base> fait l'affaire.
const existe = (ref) => { try { git('rev-parse', '--verify', '--quiet', ref); return true; } catch { return false; } };
const demandee = args.includes('--base') ? args[args.indexOf('--base') + 1] : 'main';
const base = existe(demandee) || !existe(`origin/${demandee}`) ? demandee : `origin/${demandee}`;
// Depuis le point où la branche a quitté la base : jusqu'au dernier commit, ou jusqu'aux fichiers sur le disque.
const plage = travail ? ['--merge-base', base] : [`${base}...HEAD`];
const exclus = ['--', '.', ':!.claude', ':!.agents', ':!.review'];

// --unified=0 : chaque bloc @@ ne décrit que les lignes ajoutées ou modifiées, sans contexte.
const diff = git('-C', racine, 'diff', '--unified=0', '--no-color', ...plage, ...exclus);
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

const nouveaux = new Set(git('-C', racine, 'diff', '--name-only', '--diff-filter=A', ...plage, ...exclus).split('\n').filter(Boolean));
if (travail) {
  // Un fichier pas encore suivi par git entre en entier dans le périmètre.
  for (const chemin of git('-C', racine, 'ls-files', '--others', '--exclude-standard', ...exclus).split('\n').filter(Boolean)) {
    const n = readFileSync(join(racine, chemin), 'utf8').split('\n').length;
    fichiers.push({ chemin, lignes: Array.from({ length: n }, (_, i) => i + 1) });
    nouveaux.add(chemin);
  }
}
const perimetre = { base, fichiers: fichiers.map((f) => ({ ...f, nouveau: nouveaux.has(f.chemin) })) };

mkdirSync(join(racine, '.review'), { recursive: true });
writeFileSync(join(racine, '.review', 'perimetre.json'), JSON.stringify(perimetre, null, 2));
for (const f of perimetre.fichiers) console.log(`${f.nouveau ? 'A' : 'M'} ${f.chemin} — ${f.lignes.length} ligne(s)`);
console.log(`${perimetre.fichiers.length} fichier(s) dans le périmètre (base ${base}) → .review/perimetre.json`);
