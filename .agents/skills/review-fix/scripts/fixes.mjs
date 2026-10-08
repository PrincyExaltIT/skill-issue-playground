#!/usr/bin/env node
// fixes.mjs — bookkeeping for review-fix. Reads and updates the angular-review contract: .review/findings.json
//
//   node fixes.mjs status                          counts by severity and status
//   node fixes.mjs next [--max-severity MAJOR]     next open finding in scope (highest severity first)
//   node fixes.mjs done F-003 --note "..."         mark fixed (records HEAD and the note)
//   node fixes.mjs skip F-007 --reason "..."       mark wontfix, with the reason
//   node fixes.mjs log                             write .review/FIXES.md and print it
//
// This skill shares a FILE FORMAT with angular-review, not its code: either skill can evolve alone.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ORDER = ['BLOCKER', 'MAJOR', 'MINOR', 'INFO'];
const [command = 'status', id] = process.argv.slice(2);
const args = parseArgs(process.argv.slice(2));
const root = args.root ? resolve(String(args.root)) : (git(['rev-parse', '--show-toplevel']) ?? process.cwd());
const path = join(root, '.review', 'findings.json');

if (!existsSync(path)) fail('Pas de .review/findings.json. Lancer d\'abord le skill angular-review.');
const doc = JSON.parse(readFileSync(path, 'utf8'));
const findings = doc.findings ?? [];
const pending = findings.filter((f) => f.status === 'candidate');
if (pending.length) console.error(`[fixes] ⚠ ${pending.length} finding(s) encore "candidate" : la review n'est pas finalisée (étape Verify d'angular-review).`);

const commands = {
  status() {
    for (const s of ORDER) {
      const all = findings.filter((f) => f.severity === s);
      if (!all.length) continue;
      const by = (st) => all.filter((f) => f.status === st).length;
      console.log(`${s.padEnd(7)} ${all.length} — ouverts ${by('open')}, corrigés ${by('fixed')}, écartés ${by('wontfix')}`);
    }
    console.log(`Verdict de la review : ${doc.verdict ?? 'non rendu'}`);
  },
  next() {
    const max = ORDER.indexOf(String(args['max-severity'] ?? 'MAJOR').toUpperCase());
    const next = findings
      .filter((f) => f.status === 'open' && ORDER.indexOf(f.severity) <= max)
      .sort((a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity) || a.file.localeCompare(b.file) || a.line - b.line)[0];
    if (!next) { console.log('Rien à corriger dans ce périmètre.'); return; }
    console.log([
      `${next.id} · ${next.severity} · ${next.ruleId}${next.title ? ` — ${next.title}` : ''}`,
      `${next.file}:${next.line}`,
      `> ${next.snippet}`,
      `Problème : ${next.message}`,
      `Correctif proposé : ${next.suggestion}`,
      next.note ? `Note de vérification : ${next.note}` : '',
    ].filter(Boolean).join('\n'));
  },
  done() { update('fixed', args.note); },
  skip() {
    if (!args.reason || args.reason === true) fail('skip exige --reason "<pourquoi>".');
    update('wontfix', args.reason);
  },
  log() {
    const rows = findings.filter((f) => f.status === 'fixed' || f.status === 'wontfix');
    const md = [
      '# Corrections appliquées',
      '',
      `Review source : \`.review/findings.json\` (${doc.generatedAt ?? '?'}) · verdict initial : ${doc.verdict ?? '?'}`,
      '',
      '| Finding | Sévérité | Règle | Fichier | Statut | Note |',
      '|---|---|---|---|---|---|',
      ...rows.map((f) => `| ${f.id} | ${f.severity} | ${f.ruleId} | \`${f.file}:${f.line}\` | ${f.status === 'fixed' ? '✅ corrigé' : '⏭ écarté'} | ${(f.fixNote ?? '').replace(/\|/g, '\\|')} |`),
      '',
      `Restent ouverts : ${summarizeOpen(findings.filter((f) => f.status === 'open'))}.`,
      '',
    ].join('\n');
    writeFileSync(join(root, '.review', 'FIXES.md'), md);
    console.log(md);
  },
};

if (!commands[command]) fail(`Commande inconnue : ${command}`);
commands[command]();

function summarizeOpen(open) {
  if (!open.length) return 'aucun';
  const bySev = ORDER.map((s) => [s, open.filter((f) => f.severity === s).length]).filter(([, n]) => n).map(([s, n]) => `${n} ${s}`).join(', ');
  const first = open.slice(0, 8).map((f) => f.id).join(', ');
  return `${bySev} (${first}${open.length > 8 ? `, … +${open.length - 8}` : ''})`;
}

function update(status, note) {
  const f = findings.find((x) => x.id === id);
  if (!f) fail(`Finding ${id ?? '(aucun id)'} introuvable.`);
  f.status = status;
  f.fixNote = note && note !== true ? String(note) : undefined;
  f.fixedAt = new Date().toISOString();
  f.fixedOn = git(['rev-parse', '--short', 'HEAD']);
  writeFileSync(path, JSON.stringify(doc, null, 2));
  console.log(`[fixes] ${f.id} → ${status}.`);
}

function parseArgs(argv) {
  const res = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) res[argv[i].slice(2)] = true;
    else { res[argv[i].slice(2)] = next; i++; }
  }
  return res;
}
function git(argv) { try { return execFileSync('git', argv, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null; } catch { return null; } }
function fail(msg) { console.error(`[fixes] ✖ ${msg}`); process.exit(2); }
