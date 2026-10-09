#!/usr/bin/env node
// Vérifications mécaniques sur les lignes du périmètre. Elles produisent des PISTES : rapides, répétables, mais
// c'est la revue qui confirme ou écarte chacune en lisant le code.
//   node scripts/verifs.mjs                      après scripts/perimetre.mjs
//   node scripts/verifs.mjs --echec-sur BLOCKER  porte (CI, hook) : n'affiche que les pistes de ce seuil ou plus graves, code 1 s'il y en a
// Écrit toutes les pistes dans .review/verifs.json et affiche une piste par ligne : fichier:ligne [règle] gravité — message.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const GRAVITES = ['BLOCKER', 'MAJOR', 'MINOR', 'INFO'];
const TS = /\.ts$/;
const TEMPLATE = /\.(html|ts)$/; // un composant peut avoir un template inline

// Une règle : les fichiers visés, un motif (ou une fonction qui construit le motif à partir du fichier),
// et, au besoin, un filtre sur le texte trouvé ou un décalage vers le mot qui pose problème.
// Les fichiers de test ne reçoivent que les règles marquées `specs`.
const REGLES = [
  { id: 'SEC-01', gravite: 'BLOCKER', fichiers: TS, motif: /bypassSecurityTrust\w*\s*\(/g,
    message: 'Sanitizer contourné : du HTML, une URL ou un style arrive dans la page sans nettoyage.' },
  { id: 'SEC-02', gravite: 'MAJOR', fichiers: TS, motif: /['"`]https?:\/\/[^'"`\s]+['"`]/g,
    message: "URL en dur : elle doit venir de la configuration (token d'injection, environnement)." },
  { id: 'SIG-01', gravite: 'BLOCKER', fichiers: TS, motif: signauxNonAppeles,
    message: 'Signal testé sans être appelé : la condition lit la fonction, jamais sa valeur.' },
  { id: 'NG-01', gravite: 'MINOR', fichiers: TEMPLATE, motif: /\*ng(If|For|Switch)\b/g,
    message: 'Directive structurelle dépréciée depuis Angular 20 : utiliser @if, @for, @switch.' },
  { id: 'NG-02', gravite: 'MINOR', fichiers: TS, motif: /@(Input|Output)\s*\(/g,
    message: 'Décorateur @Input/@Output : utiliser input() et output().' },
  { id: 'NG-03', gravite: 'MINOR', fichiers: TS, motif: /constructor\s*\([^)]*\b(private|public|protected|readonly)\s/g,
    message: 'Injection par constructeur : utiliser inject().' },
  { id: 'NG-04', gravite: 'MINOR', fichiers: TS, motif: /:\s*any\b|<any>|\bas any\b/g,
    message: 'Type any : la donnée perd son contrat.' },
  { id: 'NG-05', gravite: 'MINOR', fichiers: TS, motif: /\bconsole\.(log|debug)\s*\(|\bdebugger\b/g,
    message: 'Trace de débogage oubliée.' },
  { id: 'NG-07', gravite: 'MAJOR', fichiers: TS, motif: /ChangeDetectionStrategy\.(Eager|Default)\b/g,
    message: 'Détection de changement forcée en Eager : OnPush est le défaut depuis Angular 22, ce choix doit être justifié.' },
  { id: 'RX-01', gravite: 'MAJOR', fichiers: TS, motif: /\.subscribe\s*\(/g,
    message: "subscribe() : vérifier qu'il est libéré (takeUntilDestroyed, pipe async, toSignal) ou qu'il se termine seul." },
  { id: 'A11Y-01', gravite: 'MAJOR', fichiers: TEMPLATE, motif: /<img\b[^>]*>/g, garde: (t) => !/\s\[?(attr\.)?alt\]?\s*=/.test(t),
    message: 'Image sans attribut alt.' },
  { id: 'A11Y-02', gravite: 'BLOCKER', fichiers: TEMPLATE, motif: /<(div|span|li|p|img|section|article|td)\b[^>]*?\(click\)\s*=/g, decalage: (t) => t.indexOf('(click)'),
    message: 'Clic sur un élément non interactif : ni focus ni clavier. Utiliser un <button> ou un lien.' },
  { id: 'TEST-01', gravite: 'MAJOR', fichiers: /\.spec\.ts$/, specs: true, motif: /\b(fit|fdescribe)\s*\(|\b(it|describe|test)\.only\s*\(/g,
    message: 'Test focalisé : le reste de la suite ne tourne plus.' },
];

const args = process.argv.slice(2);
const seuil = args.includes('--echec-sur') ? args[args.indexOf('--echec-sur') + 1] : null;
if (seuil && !GRAVITES.includes(seuil)) {
  console.error(`--echec-sur ${seuil} : gravité inconnue (${GRAVITES.join(', ')}).`);
  process.exit(2);
}
const racine = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const cheminPerimetre = join(racine, '.review', 'perimetre.json');
if (!existsSync(cheminPerimetre)) {
  console.error('Lance d’abord scripts/perimetre.mjs.');
  process.exit(2);
}
const { fichiers } = JSON.parse(readFileSync(cheminPerimetre, 'utf8'));

const pistes = [];
for (const f of fichiers) {
  if (!existsSync(join(racine, f.chemin))) continue;
  const texte = readFileSync(join(racine, f.chemin), 'utf8');
  const lignes = texte.split('\n');
  const modifiees = new Set(f.lignes);
  const estUnTest = f.chemin.endsWith('.spec.ts');
  for (const r of REGLES.filter((r) => r.fichiers.test(f.chemin) && Boolean(r.specs) === estUnTest)) {
    const motif = typeof r.motif === 'function' ? r.motif(texte) : r.motif;
    if (!motif) continue;
    for (const m of texte.matchAll(motif)) {
      if (r.garde && !r.garde(m[0])) continue;
      const ligne = texte.slice(0, m.index + (r.decalage ? r.decalage(m[0]) : 0)).split('\n').length;
      if (modifiees.has(ligne)) pistes.push({ fichier: f.chemin, ligne, regle: r.id, gravite: r.gravite, message: r.message, extrait: lignes[ligne - 1].trim() });
    }
  }
  // Un nouveau composant, service ou guard arrive avec son fichier de test.
  const testable = f.nouveau && TS.test(f.chemin) && !/\.(spec|routes|config|model)\.ts$|main\.ts$/.test(f.chemin);
  if (testable && !existsSync(join(racine, f.chemin.replace(/\.ts$/, '.spec.ts')))) {
    pistes.push({ fichier: f.chemin, ligne: 1, regle: 'TEST-02', gravite: 'MINOR', message: 'Nouveau fichier sans test (pas de .spec.ts à côté).', extrait: lignes[0].trim() });
  }
}

pistes.sort((a, b) => GRAVITES.indexOf(a.gravite) - GRAVITES.indexOf(b.gravite) || a.fichier.localeCompare(b.fichier) || a.ligne - b.ligne);
writeFileSync(join(racine, '.review', 'verifs.json'), JSON.stringify(pistes, null, 2));
// Avec un seuil, seules les pistes qui ferment la porte s'affichent : un hook bavard pollue chaque tour de l'agent.
const bloquantes = seuil ? pistes.filter((p) => GRAVITES.indexOf(p.gravite) <= GRAVITES.indexOf(seuil)) : pistes;
for (const p of bloquantes) console.log(`${p.fichier}:${p.ligne} [${p.regle}] ${p.gravite} — ${p.message}`);
console.log(seuil
  ? `${bloquantes.length} piste(s) ${seuil} ou plus grave, sur ${pistes.length} → .review/verifs.json`
  : `${pistes.length} piste(s) → .review/verifs.json`);

// En GitHub Actions, chaque piste (seuil ou pas) devient aussi une annotation sur le diff de la PR.
if (process.env.GITHUB_ACTIONS === 'true') {
  const niveau = { BLOCKER: 'error', MAJOR: 'warning', MINOR: 'notice', INFO: 'notice' };
  for (const p of pistes) console.log(`::${niveau[p.gravite]} file=${p.fichier},line=${p.ligne},title=${p.regle}::${p.message}`);
}

if (seuil && bloquantes.length) {
  console.error(`Porte fermée : au moins une piste ${seuil} ou plus grave.`);
  process.exit(1);
}

// SIG-01 : les noms déclarés comme signaux dans le fichier, puis leurs usages sans parenthèses dans une condition.
function signauxNonAppeles(texte) {
  const noms = [...texte.matchAll(/(\w+)\s*(?::[^=;\n]+)?=\s*(?:signal|computed|linkedSignal|input|model|toSignal)\s*(?:\.required)?\s*[<(]/g)].map((m) => m[1]);
  if (!noms.length) return null;
  const nom = `this\\.(?:${noms.join('|')})`;
  return new RegExp(`if\\s*\\(\\s*!?\\s*${nom}\\s*\\)|${nom}\\s*(?:&&|\\|\\|)|!\\s*${nom}\\b(?!\\s*[.(])`, 'g');
}
