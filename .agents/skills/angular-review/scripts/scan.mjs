#!/usr/bin/env node
// scan.mjs — mechanical pass. Finds CANDIDATES on changed lines only; the review step decides.
//
//   node scan.mjs                         uses .review/scope.json (runs scope.mjs first if missing)
//   node scan.mjs --base origin/main      (re)computes the scope with that base
//   node scan.mjs --files src/a.ts --all  explicit files, whole content
//   node scan.mjs --format text|json|gitlab|sarif|github|markdown [--out file] [--fail-on BLOCKER|MAJOR] [--fail-confidence high]
//
// Works without any LLM: the same script is the CI gate (see kit/ci/).

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULES } from './lib/rules.mjs';
import { maskCode, classMemberMap, inlineTemplates } from './lib/source.mjs';
import { detectAngular, kindOf, hasSpec, safeRead, readJson, normalize } from './lib/project.mjs';
import { exportAs, breaches, rank } from './lib/formats.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const args = parseArgs(process.argv.slice(2));
const root = args.root ? resolve(String(args.root)) : (gitAt(process.cwd(), ['rev-parse', '--show-toplevel']) ?? process.cwd());
const scopePath = join(root, '.review', 'scope.json');

let scope;
if (args.files) {
  scope = {
    angular: detectAngular(root),
    files: String(args.files).split(',').map((p) => normalize(p.trim())).filter(Boolean)
      .map((path) => ({ path, status: 'E', changedLines: 'all', kind: kindOf(root, path), hasSpec: hasSpec(root, path) })),
  };
} else {
  if (args.base || args.committed || args.staged || !existsSync(scopePath)) {
    const passthrough = ['--quiet'];
    if (args.base) passthrough.push('--base', args.base);
    if (args.committed) passthrough.push('--committed');
    if (args.staged) passthrough.push('--staged');
    execFileSync(process.execPath, [join(here, 'scope.mjs'), ...passthrough], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] });
  }
  scope = readJson(scopePath);
}

const ng = scope.angular ?? detectAngular(root);
const only = args.rules ? new Set(String(args.rules).split(',')) : null;
const candidates = [];
const seen = new Set();

for (const file of scope.files) {
  if (!/\.(ts|html)$/.test(file.path)) continue;
  const text = safeRead(join(root, file.path));
  if (text === null) continue;
  const masked = maskCode(text);
  const isHtml = file.path.endsWith('.html');
  const ctx = {
    path: file.path,
    text,
    lines: text.split('\n'),
    masked,
    maskedLines: masked.split('\n'),
    members: isHtml ? [] : classMemberMap(masked),
    templates: isHtml ? [{ text, startLine: 1 }] : inlineTemplates(text),
    kind: file.kind ?? kindOf(root, file.path),
    hasSpec: file.hasSpec,
    status: file.status,
    ng,
  };

  for (const rule of RULES) {
    if (only && !only.has(rule.id)) continue;
    if (!appliesTo(rule, ctx, isHtml)) continue;
    for (const hit of rule.detect(ctx)) {
      if (!args.all && !inChangedLines(file.changedLines, hit.line)) continue;
      const key = `${rule.id}|${file.path}|${hit.line}`;
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({
        ruleId: rule.id,
        severity: hit.severity ?? rule.severity,
        domain: rule.domain,
        file: file.path,
        line: hit.line,
        snippet: (ctx.lines[hit.line - 1] ?? '').trim().slice(0, 200),
        title: rule.title,
        message: hit.message ?? rule.message,
        suggestion: rule.suggestion,
        source: rule.source,
        evidence: { kind: 'static', confidence: hit.confidence ?? rule.confidence ?? 'high' },
        origin: 'scan',
        ...(rule.eslintRule ? { eslintRule: rule.eslintRule } : {}),
      });
    }
  }
}

candidates.sort((a, b) => rank(a.severity) - rank(b.severity) || a.file.localeCompare(b.file) || a.line - b.line);
const bySeverity = Object.fromEntries(['BLOCKER', 'MAJOR', 'MINOR', 'INFO'].map((s) => [s, candidates.filter((c) => c.severity === s).length]));
const report = {
  generatedAt: new Date().toISOString(),
  angular: ng,
  files: scope.files.length,
  stats: { candidates: candidates.length, bySeverity },
  candidates,
};

// --no-save: leave .review/scan.json untouched (used by the edit hook, which must not clobber a review in progress).
if (!args['no-save']) {
  const reviewDir = join(root, '.review');
  mkdirSync(reviewDir, { recursive: true });
  writeFileSync(join(reviewDir, 'scan.json'), JSON.stringify(report, null, 2));
}

const format = args.format ?? (args.out ? 'json' : 'text');
const rendered = format === 'json' ? JSON.stringify(report, null, 2) : exportAs(format, candidates);
if (args.out) writeFileSync(args.out, rendered);
else process.stdout.write(rendered + '\n');

console.error(`[scan] ${candidates.length} candidat(s) — ${Object.entries(bySeverity).map(([k, v]) => `${k}:${v}`).join(' ')}${args['no-save'] ? '' : ' — .review/scan.json'}`);
// CI gate: --fail-on BLOCKER [--fail-confidence high] ignores low-confidence candidates (they need the review step).
const CONF = ['low', 'medium', 'high'];
const minConf = CONF.indexOf(String(args['fail-confidence'] ?? 'low'));
const gated = candidates.filter((c) => CONF.indexOf(c.evidence.confidence) >= minConf);
if (breaches(gated, args['fail-on'])) {
  console.error(`[scan] Seuil --fail-on ${args['fail-on']} atteint (confiance ≥ ${CONF[minConf]}).`);
  process.exit(1);
}

// ---------------------------------------------------------------------------

function appliesTo(rule, ctx, isHtml) {
  if (rule.on === 'ts' && isHtml) return false;
  if (rule.on === 'template' && !isHtml && ctx.templates.length === 0) return false;
  if (ctx.kind === 'spec' && rule.domain !== 'testing') return false;
  if (rule.domain === 'testing' && rule.id !== 'R-TEST-001' && ctx.kind !== 'spec') return false;
  if (rule.newFilesOnly && ctx.status !== 'A') return false;
  if (rule.zonelessOnly && !ctx.ng.zoneless) return false;
  const major = ctx.ng.major;
  if (rule.maxMajor !== undefined && (major === null || major > rule.maxMajor)) return false;
  if (rule.minMajor !== undefined && major !== null && major < rule.minMajor) return false;
  return true;
}

function inChangedLines(changed, line) {
  if (changed === 'all' || changed === undefined) return true;
  return changed.some(([a, b]) => line >= a && line <= b);
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

function gitAt(cwd, argv) { try { return execFileSync('git', argv, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null; } catch { return null; } }
