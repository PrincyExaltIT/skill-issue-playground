#!/usr/bin/env node
// findings.mjs — the deterministic half of the review: merge, verify bookkeeping, verdict, report, CI export.
//
//   node findings.mjs merge                         scan.json + reviewers/*.json -> findings.json (dedup, ids, evidence check)
//   node findings.mjs keep F-003 [--severity MINOR] [--note "..."]
//   node findings.mjs dismiss F-004 --reason "HttpClient complète après une émission"
//   node findings.mjs decide --file .review/decisions.json   batch: [{ "id": "F-001", "decision": "keep|dismiss", "severity"?, "reason"? }]
//   node findings.mjs note --summary "..." | --praise "..." | --empirical "..."
//   node findings.mjs render [--force]              verdict + .review/REVIEW.md (refuses while candidates remain unverified)
//   node findings.mjs export --format gitlab|sarif|github|markdown|text [--out file] [--fail-on BLOCKER|MAJOR]
//   node findings.mjs list [--status candidate|open|dismissed]
//
// Severities and verdict rules are the v1 ones (BLOCKER/MAJOR/MINOR/INFO; REQUEST_CHANGES/COMMENT/APPROVE).

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportAs, breaches, rank, SEVERITY_ORDER } from './lib/formats.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const skillRoot = resolve(here, '..');
const [command = 'help', ...rest] = process.argv.slice(2);
const positional = rest.filter((a, i) => !a.startsWith('--') && !(i > 0 && rest[i - 1].startsWith('--') && !rest[i - 1].includes('=')));
const args = parseArgs(rest);
const root = args.root ? resolve(String(args.root)) : (gitAt(process.cwd(), ['rev-parse', '--show-toplevel']) ?? process.cwd());
const reviewDir = join(root, '.review');
const findingsPath = join(reviewDir, 'findings.json');


// ─────────────────────────────────────────────────────────────────────────────

function merge() {
  const scope = readJson(join(reviewDir, 'scope.json')) ?? {};
  const scan = readJson(join(reviewDir, 'scan.json'));
  const reviewersDir = join(reviewDir, 'reviewers');
  const sources = [];
  if (scan) sources.push({ agent: 'scan', findings: scan.candidates ?? [] });
  if (existsSync(reviewersDir)) {
    for (const f of readdirSync(reviewersDir).filter((n) => n.endsWith('.json')).sort()) {
      const data = readJson(join(reviewersDir, f));
      if (!data || !Array.isArray(data.findings)) { warn(`reviewers/${f} : JSON invalide ou sans "findings" — ignoré.`); continue; }
      sources.push({ agent: data.agent ?? f.replace(/\.json$/, ''), findings: data.findings });
    }
  }

  const byKey = new Map();
  const problems = [];
  for (const src of sources) {
    for (const raw of src.findings) {
      const errors = validateShape(raw);
      if (errors.length) { problems.push(`${src.agent} ${raw.ruleId ?? '?'} ${raw.file ?? '?'}:${raw.line ?? '?'} — ${errors.join(', ')}`); continue; }
      const key = `${raw.file}|${raw.line}|${raw.ruleId}`;
      const existing = byKey.get(key);
      const origin = src.agent === 'scan' ? 'scan' : 'review';
      if (existing) {
        if (origin === 'review') {
          // Keep a trace when a reviewer re-grades a scan candidate: severity drift between runs is worth seeing.
          if (raw.severity !== existing.severity) existing.severityChange = `${existing.severity} → ${raw.severity} (${src.agent})`;
          Object.assign(existing, { message: raw.message, suggestion: raw.suggestion, severity: raw.severity });
        }
        existing.origin = existing.origin === origin ? origin : 'scan+review';
        existing.agents = [...new Set([...existing.agents, src.agent])];
      } else {
        byKey.set(key, { ...raw, origin, agents: [src.agent] });
      }
    }
  }

  const findings = [...byKey.values()]
    .sort((a, b) => rank(a.severity) - rank(b.severity) || a.file.localeCompare(b.file) || a.line - b.line)
    .map((f, i) => ({ id: `F-${String(i + 1).padStart(3, '0')}`, ...f, evidenceCheck: checkEvidence(f), status: 'candidate' }));

  const doc = {
    version: 2,
    generatedAt: new Date().toISOString(),
    target: { mode: scope.mode ?? null, base: scope.base ?? null, head: scope.head ?? null, branch: scope.branch ?? null, files: scope.stats?.files ?? scan?.files ?? null },
    angular: scope.angular?.version ?? scan?.angular?.version ?? null,
    reviewers: sources.map((s) => ({ agent: s.agent, findings: s.findings.length })),
    summary: null,
    praise: [],
    empirical: null,
    verdict: null,
    findings,
    dismissed: [],
  };
  save(doc);
  const mismatches = findings.filter((f) => f.evidenceCheck !== 'ok');
  console.error(`[findings] ${findings.length} candidat(s) fusionné(s) depuis ${sources.map((s) => s.agent).join(', ') || 'aucune source'}.`);
  for (const p of problems) warn(`ignoré (schéma) : ${p}`);
  for (const m of mismatches) warn(`${m.id} ${m.ruleId} ${m.file}:${m.line} — evidence ${m.evidenceCheck} : relire le fichier, corriger la ligne ou rejeter.`);
  console.error('[findings] Étape suivante : vérifier chaque candidat (keep / dismiss), puis `render`.');
  printList(findings);
}

function keep() {
  const doc = load();
  const f = byId(doc, positional[0]);
  if (args.severity) {
    const s = String(args.severity).toUpperCase();
    if (!SEVERITY_ORDER.includes(s)) fail(`Sévérité invalide : ${s}`);
    f.severityChange = f.severity === s ? undefined : `${f.severity} → ${s}`;
    f.severity = s;
  }
  if (args.note) f.note = String(args.note);
  f.status = 'open';
  save(doc);
  console.error(`[findings] ${f.id} confirmé (${f.severity}).`);
}

function dismiss() {
  const doc = load();
  const f = byId(doc, positional[0]);
  if (!args.reason || args.reason === true) fail('dismiss exige --reason "<pourquoi c\'est un faux positif>".');
  doc.findings = doc.findings.filter((x) => x !== f);
  doc.dismissed.push({ id: f.id, ruleId: f.ruleId, file: f.file, line: f.line, origin: f.origin, reason: String(args.reason) });
  save(doc);
  console.error(`[findings] ${f.id} écarté : ${args.reason}`);
}

function decide() {
  const doc = load();
  const decisions = readJson(resolve(String(args.file ?? join(reviewDir, 'decisions.json'))));
  if (!Array.isArray(decisions)) fail('decide --file doit pointer vers un tableau JSON de décisions.');
  for (const d of decisions) {
    const f = doc.findings.find((x) => x.id === d.id);
    if (!f) { warn(`${d.id} introuvable — ignoré.`); continue; }
    if (d.decision === 'dismiss') {
      doc.findings = doc.findings.filter((x) => x !== f);
      doc.dismissed.push({ id: f.id, ruleId: f.ruleId, file: f.file, line: f.line, origin: f.origin, reason: d.reason ?? 'non précisé' });
    } else {
      if (d.severity && SEVERITY_ORDER.includes(d.severity)) { f.severityChange = f.severity === d.severity ? undefined : `${f.severity} → ${d.severity}`; f.severity = d.severity; }
      if (d.reason) f.note = d.reason;
      f.status = 'open';
    }
  }
  save(doc);
  const left = doc.findings.filter((f) => f.status === 'candidate').length;
  console.error(`[findings] ${decisions.length} décision(s) appliquée(s). Candidats restants : ${left}.`);
}

function note() {
  const doc = load();
  if (args.summary) doc.summary = String(args.summary);
  if (args.praise) doc.praise.push(String(args.praise));
  if (args.empirical) doc.empirical = String(args.empirical);
  save(doc);
  console.error('[findings] Note enregistrée.');
}

function render() {
  const doc = load();
  const pending = doc.findings.filter((f) => f.status === 'candidate');
  if (pending.length && !args.force) {
    printList(pending);
    fail(`${pending.length} candidat(s) non vérifié(s). Décider keep/dismiss pour chacun (ou --force pour un rapport brut).`, 3);
  }
  const open = doc.findings.filter((f) => f.status !== 'dismissed');
  const projectPrefix = readProjectPrefix();
  doc.verdict = verdictOf(open, projectPrefix);
  save(doc);

  const template = readFileSync(join(skillRoot, 'assets', 'report-template.md'), 'utf8');
  const counts = Object.fromEntries(SEVERITY_ORDER.map((s) => [s, open.filter((f) => f.severity === s).length]));
  const project = open.filter((f) => f.ruleId.startsWith(projectPrefix));
  const target = doc.target?.branch && doc.target?.base ? `${doc.target.branch} → ${doc.target.base}` : (doc.target?.mode ?? 'diff');
  const md = fill(template, {
    TARGET: target,
    VERDICT: VERDICT_LABELS[doc.verdict],
    ANGULAR: doc.angular ?? '?',
    N_FILES: doc.target?.files ?? '?',
    DATE: new Date().toISOString().slice(0, 10),
    SUMMARY: doc.summary ?? '_Résumé non fourni (findings.mjs note --summary "...")._',
    N_BLOCKER: counts.BLOCKER, N_MAJOR: counts.MAJOR, N_MINOR: counts.MINOR, N_INFO: counts.INFO,
    PROJECT_SECTION: project.length ? `## Conformité projet (${projectPrefix})\n\n${project.length} finding(s) ${projectPrefix} — un seul BLOCKER ${projectPrefix} suffit à demander des changements.\n` : '',
    FINDINGS: open.length ? open.map(renderFinding).join('\n') : '_Aucun finding : rien à signaler sur ce diff._',
    DISMISSED: doc.dismissed.length ? doc.dismissed.map((d) => `- ~~${d.ruleId}~~ \`${d.file}:${d.line}\` — ${d.reason}`).join('\n') : '_Aucun._',
    PRAISE: doc.praise.length ? doc.praise.map((p) => `- ${p}`).join('\n') : '_—_',
    REVIEWERS: doc.reviewers.map((r) => `- ${r.agent} — ${r.findings} constat(s) brut(s)`).join('\n') || '_—_',
    EMPIRICAL: doc.empirical ?? 'Non exécutée.',
  });
  writeFileSync(join(reviewDir, 'REVIEW.md'), md);
  process.stdout.write(md + '\n');
  console.error(`[findings] Verdict ${doc.verdict} — ${open.length} finding(s) — .review/REVIEW.md`);
}

function exportCmd() {
  const doc = load();
  const open = doc.findings.filter((f) => f.status !== 'candidate' || args.force);
  const out = exportAs(String(args.format ?? 'text'), open);
  if (args.out) writeFileSync(String(args.out), out); else process.stdout.write(out + '\n');
  if (breaches(open, args['fail-on'])) { console.error(`[findings] Seuil --fail-on ${args['fail-on']} atteint.`); process.exit(1); }
}

function list() {
  const doc = load();
  const wanted = args.status ? String(args.status) : null;
  if (wanted === 'dismissed') { for (const d of doc.dismissed) console.log(`${d.id} ${d.ruleId} ${d.file}:${d.line} — ${d.reason}`); return; }
  printList(doc.findings.filter((f) => !wanted || f.status === wanted));
}

function help() {
  console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n'));
}

// ─────────────────────────────────────────────────────────────────────────────

const VERDICT_LABELS = {
  REQUEST_CHANGES: '🔴 REQUEST_CHANGES — corrections nécessaires avant merge',
  COMMENT: '🟡 COMMENT — mergeable, remarques à traiter',
  APPROVE: '🟢 APPROVE — rien à signaler',
};

/** v1 verdict rules, now executed by code instead of prose. */
function verdictOf(findings, projectPrefix) {
  const blockers = findings.filter((f) => f.severity === 'BLOCKER');
  if (blockers.some((f) => f.ruleId.startsWith(projectPrefix))) return 'REQUEST_CHANGES';
  if (blockers.length >= 1) return 'REQUEST_CHANGES';
  if (findings.filter((f) => f.severity === 'MAJOR').length >= 3) return 'REQUEST_CHANGES';
  if (findings.length === 0) return 'APPROVE';
  return 'COMMENT';
}

const ICON = { BLOCKER: '🔴', MAJOR: '🟠', MINOR: '🟡', INFO: '🔵' };
function renderFinding(f) {
  const lang = f.file.endsWith('.html') ? 'html' : 'ts';
  const meta = [`\`${f.file}:${f.line}\``, f.domain, `confiance ${f.evidence?.confidence ?? '—'}`, f.origin, f.severityChange ? `sévérité ${f.severityChange}` : null].filter(Boolean).join(' · ');
  return [
    `### ${ICON[f.severity]} ${f.id} · ${f.ruleId}${f.title ? ` — ${f.title}` : ''}`,
    meta,
    '',
    '```' + lang,
    f.snippet,
    '```',
    `**Problème** — ${f.message}`,
    '',
    `**Correctif** — ${f.suggestion}`,
    f.note ? `\n> Note de vérification : ${f.note}` : '',
    `\nSource : ${f.source}`,
    '',
  ].join('\n');
}

function validateShape(f) {
  const errors = [];
  for (const k of ['ruleId', 'severity', 'file', 'line', 'snippet', 'message', 'suggestion']) if (f[k] === undefined || f[k] === '') errors.push(`${k} manquant`);
  if (f.severity && !SEVERITY_ORDER.includes(f.severity)) errors.push(`severity "${f.severity}" hors BLOCKER|MAJOR|MINOR|INFO`);
  if (f.line !== undefined && !(Number.isInteger(f.line) && f.line >= 1)) errors.push('line doit être un entier ≥ 1');
  if (f.ruleId && !/^[A-Z][A-Z0-9]*(-[A-Z0-9]+)*-\d+$/.test(f.ruleId)) errors.push(`ruleId "${f.ruleId}" invalide`);
  return errors;
}

/** Anti-hallucination guard: the quoted snippet must exist near the claimed line. */
function checkEvidence(f) {
  const text = safeRead(join(root, f.file));
  if (text === null) return 'missing-file';
  const lines = text.split('\n');
  if (f.line > lines.length) return 'invalid-line';
  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  const needle = norm(String(f.snippet)).slice(0, 80);
  if (!needle) return 'empty-snippet';
  const window = norm(lines.slice(Math.max(0, f.line - 4), f.line + 3).join(' '));
  return window.includes(needle) ? 'ok' : 'mismatch';
}

function readProjectPrefix() {
  const md = safeRead(join(skillRoot, 'references', 'PROJECT_COMPLIANCE_REVIEW.md')) ?? '';
  return /rule_prefix:\s*([A-Z][A-Z0-9-]*)/.exec(md)?.[1] ?? 'R-PROJ';
}

function printList(findings) {
  for (const f of findings) console.error(`  ${f.id} ${f.status.padEnd(9)} ${f.severity.padEnd(7)} ${f.ruleId.padEnd(11)} ${f.file}:${f.line}${f.evidenceCheck && f.evidenceCheck !== 'ok' ? `  [evidence ${f.evidenceCheck}]` : ''}`);
}

function fill(template, values) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => (values[k] === undefined ? '' : String(values[k]))).replace(/\n{3,}/g, '\n\n');
}

function byId(doc, id) {
  const f = doc.findings.find((x) => x.id === id);
  if (!f) fail(`Finding ${id ?? '(aucun id)'} introuvable.`);
  return f;
}

function load() {
  const doc = readJson(findingsPath);
  if (!doc) fail('Pas de .review/findings.json : lancer `node findings.mjs merge` d\'abord.');
  return doc;
}
function save(doc) { mkdirSync(reviewDir, { recursive: true }); writeFileSync(findingsPath, JSON.stringify(doc, null, 2)); }
function safeRead(p) { try { return readFileSync(p, 'utf8'); } catch { return null; } }
function readJson(p) { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } }
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
function warn(msg) { console.error(`[findings] ⚠ ${msg}`); }
function fail(msg, code = 2) { console.error(`[findings] ✖ ${msg}`); process.exit(code); }

// Dispatch last: every const above is initialised by now.
const commands = { merge, keep, dismiss, decide, note, render, export: exportCmd, list, help };
if (!commands[command]) fail(`Commande inconnue : ${command}. Voir : node findings.mjs help`);
commands[command]();
