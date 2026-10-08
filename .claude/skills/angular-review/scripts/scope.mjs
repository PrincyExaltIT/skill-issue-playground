#!/usr/bin/env node
// scope.mjs — decide WHAT to review and in WHICH Angular context. Writes .review/scope.json.
//
//   node scope.mjs                       merge-base(base, HEAD) -> working tree (commits + uncommitted + untracked)
//   node scope.mjs --committed           merge-base(base, HEAD) -> HEAD (exactly what a PR/MR contains)
//   node scope.mjs --staged              index vs HEAD (pre-commit review)
//   node scope.mjs --base origin/develop explicit base (branch, tag or sha)
//   node scope.mjs --files a.ts,b.html   explicit files, whole content (no git needed)
//
// Base auto-detection: --base, CI variables (GitHub, GitLab), origin/HEAD, origin/main, origin/master, main, master.
// Zero dependencies, Node >= 18. Human summary on stderr, JSON on stdout.

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { detectAngular, kindOf, hasSpec, safeRead, normalize } from './lib/project.mjs';

const args = parseArgs(process.argv.slice(2));
const root = args.root ? resolve(String(args.root)) : (gitAt(process.cwd(), ['rev-parse', '--show-toplevel']) ?? process.cwd());
const out = args.out ?? join(root, '.review', 'scope.json');

const REVIEWABLE = /\.(ts|html|css|scss|sass|less)$/i;
const CONFIG_FILES = /(^|\/)(package\.json|angular\.json|tsconfig[\w.-]*\.json|eslint\.config\.\w+|\.eslintrc[\w.]*)$/i;
const IGNORED = /(^|\/)(node_modules|dist|\.angular|coverage|\.review|out-tsc)\//;

const angular = detectAngular(root);
let base = null;
let mergeBase = null;
let files;
const mode = args.files ? 'files' : args.staged ? 'staged' : args.committed ? 'committed' : 'working-tree';

if (mode === 'files') {
  files = String(args.files).split(',').map((f) => f.trim()).filter(Boolean)
    .map((p) => ({ path: normalize(p), status: 'E', changedLines: 'all' }));
} else if (mode === 'staged') {
  files = collectDiff(['--cached'], false);
} else {
  base = resolveBase(args.base);
  if (!base) fail('No base ref found. Pass --base <branch|sha>, e.g. --base origin/main.');
  mergeBase = git(['merge-base', base, 'HEAD']);
  files = collectDiff(mode === 'committed' ? [mergeBase, 'HEAD'] : [mergeBase], mode === 'working-tree');
}

const reviewable = [];
const skipped = [];
for (const f of files) {
  if (IGNORED.test(f.path)) skipped.push({ path: f.path, reason: 'generated or vendored' });
  else if (!REVIEWABLE.test(f.path) && !CONFIG_FILES.test(f.path)) skipped.push({ path: f.path, reason: 'not an Angular source file' });
  else if (f.status === 'D') skipped.push({ path: f.path, reason: 'deleted' });
  else reviewable.push({ ...f, kind: kindOf(root, f.path), hasSpec: hasSpec(root, f.path) });
}

const stats = reviewable.reduce((s, f) => ({ files: s.files + 1, added: s.added + (f.added ?? 0), deleted: s.deleted + (f.deleted ?? 0) }), { files: 0, added: 0, deleted: 0 });
const scope = {
  generatedAt: new Date().toISOString(),
  root: normalize(root),
  mode,
  base,
  mergeBase,
  head: gitAt(root, ['rev-parse', 'HEAD']),
  branch: gitAt(root, ['rev-parse', '--abbrev-ref', 'HEAD']),
  angular,
  stats,
  files: reviewable,
  skipped,
  hints: hintsFor(angular, reviewable),
};

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(scope, null, 2));
if (!args.quiet) process.stdout.write(JSON.stringify(scope, null, 2) + '\n');
console.error(`[scope] Angular ${angular.version ?? '?'} | ${mode} | ${stats.files} file(s) (+${stats.added} -${stats.deleted}) | base=${base ?? 'n/a'} -> ${normalize(out)}`);
if (stats.files === 0) console.error('[scope] Aucun changement Angular à reviewer.');

// ---------------------------------------------------------------------------

function collectDiff(range, includeUntracked) {
  const result = new Map();
  for (const line of git(['diff', '--name-status', '-M', ...range]).split('\n').filter(Boolean)) {
    const parts = line.split('\t');
    const path = normalize(parts[parts.length - 1]);
    result.set(path, { path, status: parts[0][0] });
  }
  if (includeUntracked) {
    for (const p of (gitAt(root, ['ls-files', '--others', '--exclude-standard']) ?? '').split('\n').filter(Boolean)) {
      result.set(normalize(p), { path: normalize(p), status: 'A', untracked: true });
    }
  }
  for (const f of result.values()) {
    if (f.status === 'D') continue;
    if (f.untracked) {
      const lines = safeRead(join(root, f.path))?.split('\n').length ?? 0;
      Object.assign(f, { changedLines: [[1, lines]], added: lines, deleted: 0 });
    } else {
      Object.assign(f, parseHunks(gitAt(root, ['diff', '-U0', ...range, '--', f.path]) ?? ''));
    }
  }
  return [...result.values()];
}

/** "@@ -a,b +c,d @@" headers -> changed line ranges in the NEW file. */
function parseHunks(diff) {
  const changedLines = [];
  let added = 0;
  let deleted = 0;
  for (const line of diff.split('\n')) {
    const m = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (m) {
      const start = Number(m[1]);
      const count = m[2] === undefined ? 1 : Number(m[2]);
      if (count > 0) changedLines.push([start, start + count - 1]);
    } else if (line.startsWith('+') && !line.startsWith('+++')) added++;
    else if (line.startsWith('-') && !line.startsWith('---')) deleted++;
  }
  return { changedLines, added, deleted };
}

function resolveBase(explicit) {
  const candidates = [];
  if (explicit) candidates.push(explicit);
  if (process.env.GITHUB_BASE_REF) candidates.push(`origin/${process.env.GITHUB_BASE_REF}`);
  if (process.env.CI_MERGE_REQUEST_DIFF_BASE_SHA) candidates.push(process.env.CI_MERGE_REQUEST_DIFF_BASE_SHA);
  if (process.env.CI_MERGE_REQUEST_TARGET_BRANCH_NAME) candidates.push(`origin/${process.env.CI_MERGE_REQUEST_TARGET_BRANCH_NAME}`);
  const originHead = gitAt(root, ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD']);
  if (originHead) candidates.push(originHead);
  candidates.push('origin/main', 'origin/master', 'main', 'master');
  return candidates.find((c) => gitAt(root, ['rev-parse', '--verify', '--quiet', `${c}^{commit}`])) ?? null;
}

function hintsFor(ng, files) {
  const hints = [];
  if (ng.onPushByDefault) hints.push('Angular >= 22 : OnPush est le défaut. Ne pas réclamer OnPush ; questionner plutôt ChangeDetectionStrategy.Eager/Default.');
  else if (ng.major) hints.push(`Angular ${ng.major} : OnPush est opt-in. Un nouveau composant sans OnPush est un finding valide (R-PERF-020).`);
  if (ng.zoneless) hints.push('Application zoneless : un état modifié hors signals/markForCheck (setTimeout, callbacks, champs simples) ne rafraîchit pas la vue.');
  hints.push(ng.ssr
    ? 'SSR détecté : window/document/localStorage doivent être protégés (afterNextRender, DOCUMENT).'
    : "Pas de SSR : un accès direct à window/localStorage est acceptable, ne pas le signaler comme risque SSR.");
  if (ng.standaloneByDefault) hints.push('standalone: true est le défaut depuis v19 : le flag explicite est du bruit (INFO), jamais un bug.');
  if (ng.testRunner) hints.push(`Runner de tests : ${ng.testRunner}. Proposer des tests dans cet idiome.`);
  if (ng.bestPractices) hints.push(`Bonnes pratiques officielles de la version installée : ${ng.bestPractices} — elles priment sur les références du skill (les règles du projet priment sur tout).`);
  if (ng.eslint) hints.push('angular-eslint est installé : ignorer les candidats dont eslintRule est déjà appliqué par la CI.');
  if (files.some((f) => f.kind === 'component' && f.hasSpec === false)) hints.push('Des composants modifiés n\'ont pas de fichier spec voisin.');
  return hints;
}

function parseArgs(argv) {
  const res = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) res[key] = true;
    else { res[key] = next; i++; }
  }
  return res;
}

function git(argv) { return execFileSync('git', argv, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 }).trim(); }
function gitAt(cwd, argv) { try { return execFileSync('git', argv, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null; } catch { return null; } }
function fail(msg) { console.error(`[scope] ${msg}`); process.exit(2); }
