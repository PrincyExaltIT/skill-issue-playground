#!/usr/bin/env node
// validate.mjs — check skill folders against the Agent Skills spec + the kit's portability rules.
//   node validate.mjs <skill-dir> [<skill-dir>…]      e.g. node validate.mjs skills/*
// Errors (exit 1): what breaks loading in a spec-compliant harness. Warnings: what hurts triggering or portability.
// --strict: non-spec frontmatter fields become errors (what skills-ref validate and the claude.ai upload enforce).

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, basename, resolve, extname } from 'node:path';
import { execFileSync } from 'node:child_process';

const SPEC_FIELDS = new Set(['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools']);
const KNOWN_EXTENSIONS = {
  'disable-model-invocation': 'honoré par Claude Code, Cursor et Copilot (VS Code) ; Codex : utiliser agents/openai.yaml policy.allow_implicit_invocation',
  'user-invocable': 'Claude Code, Copilot (VS Code)',
  'argument-hint': 'Claude Code, Copilot (VS Code)',
  'when_to_use': 'Claude Code',
  model: 'Claude Code',
  effort: 'Claude Code',
  context: 'Claude Code (context: fork), Copilot VS Code (expérimental)',
  agent: 'Claude Code',
  hooks: 'Claude Code',
  paths: 'Claude Code, Cursor',
  shell: 'Claude Code',
  icon: 'Cursor',
  color: 'Cursor',
};

const STRICT = process.argv.includes('--strict'); // spec-only, like skills-ref validate and the claude.ai upload
const dirs = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (dirs.length === 0) { console.error('Usage : node validate.mjs [--strict] <dossier-de-skill> […]'); process.exit(2); }

let errors = 0;
let warnings = 0;
for (const d of dirs) {
  const dir = resolve(d);
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) continue;
  const res = validate(dir);
  errors += res.errors.length;
  warnings += res.warnings.length;
  const status = res.errors.length ? '✖' : res.warnings.length ? '⚠' : '✔';
  console.log(`${status} ${basename(dir)}${res.summary ? ` — ${res.summary}` : ''}`);
  for (const e of res.errors) console.log(`    ✖ ${e}`);
  for (const w of res.warnings) console.log(`    ⚠ ${w}`);
}
console.log(`\n${errors} erreur(s), ${warnings} avertissement(s).`);
process.exit(errors ? 1 : 0);

function validate(dir) {
  const errors = [];
  const warnings = [];
  const file = join(dir, 'SKILL.md');
  if (!existsSync(file)) return { errors: ['SKILL.md introuvable'], warnings };
  const text = readFileSync(file, 'utf8').replace(/^﻿/, '');
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!m) return { errors: ['frontmatter YAML absent (le fichier doit commencer par ---)'], warnings };
  const fm = parseYaml(m[1]);
  const body = m[2];

  // name
  const name = fm.name;
  if (!name) errors.push('name manquant');
  else {
    if (name.length > 64) errors.push(`name trop long (${name.length} > 64)`);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) errors.push(`name "${name}" : minuscules, chiffres et tirets simples uniquement`);
    if (name !== basename(dir)) errors.push(`name "${name}" ≠ nom du dossier "${basename(dir)}"`);
  }
  // description
  const desc = fm.description;
  if (!desc) errors.push('description manquante');
  else {
    if (desc.length > 1024) errors.push(`description trop longue (${desc.length} > 1024)`);
    if (desc.length < 60) warnings.push('description très courte : dire ce que fait le skill ET quand l\'utiliser');
    if (!/\b(use when|use it when|run it|utiliser quand|à utiliser|when asked|when the user)\b/i.test(desc) && fm['disable-model-invocation'] !== 'true') warnings.push('description sans cas de déclenchement explicite ("Use when …")');
    if (/^\s*(I |I'm|Je |J')/.test(desc)) warnings.push('description à la première personne : écrire à la troisième');
  }
  if (fm.compatibility && fm.compatibility.length > 500) errors.push('compatibility > 500 caractères');

  // fields
  for (const key of Object.keys(fm)) {
    if (SPEC_FIELDS.has(key)) continue;
    const msg = KNOWN_EXTENSIONS[key]
      ? `champ "${key}" hors standard : ${KNOWN_EXTENSIONS[key]}. Rejeté par skills-ref validate et l'upload claude.ai`
      : `champ "${key}" hors standard (le ranger sous metadata:)`;
    (STRICT ? errors : warnings).push(msg);
  }

  // body
  const lines = body.split('\n').length;
  if (!body.trim()) errors.push('corps de SKILL.md vide');
  if (lines > 500) warnings.push(`corps de ${lines} lignes (> 500) : déplacer du contenu dans references/`);

  // referenced files exist
  const refs = new Set();
  for (const r of body.matchAll(/\]\(([^)\s#]+)\)/g)) refs.add(r[1]);
  for (const r of body.matchAll(/`((?:scripts|references|assets)\/[^`\s]+)`/g)) refs.add(r[1]);
  for (const r of body.matchAll(/node\s+((?:scripts)\/[\w./-]+\.m?js)/g)) refs.add(r[1]);
  for (const ref of refs) {
    if (/^(https?:|mailto:)/.test(ref) || ref.includes('<') || ref.startsWith('..')) continue;
    const clean = ref.replace(/[),.;:]+$/, '');
    if (!existsSync(join(dir, clean))) errors.push(`fichier référencé introuvable : ${clean}`);
  }

  // scripts parse
  const scriptsDir = join(dir, 'scripts');
  if (existsSync(scriptsDir)) {
    for (const f of walk(scriptsDir).filter((p) => ['.mjs', '.js', '.cjs'].includes(extname(p)))) {
      try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); }
      catch (e) { errors.push(`erreur de syntaxe : ${f.slice(dir.length + 1)} — ${String(e.stderr).split('\n').find((l) => l.includes('Error')) ?? ''}`); }
    }
  }

  // hygiene
  for (const f of walk(dir).filter((p) => /\.(md|mjs|js|json|ya?ml|txt)$/.test(p))) {
    const content = readFileSync(f, 'utf8');
    if (/(?:sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{30,}|glpat-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16})/.test(content)) errors.push(`secret probable dans ${f.slice(dir.length + 1)}`);
    if (/[A-Z]:\\Users\\|\/home\/[a-z]+\/|\/Users\/[a-z]+\//.test(content)) warnings.push(`chemin absolu de poste dans ${f.slice(dir.length + 1)}`);
  }
  if (existsSync(join(dir, 'README.md'))) warnings.push('README.md dans le skill : la doc humaine vit hors du dossier (le skill ne contient que ce que l\'agent utilise)');

  const tokens = Math.round(((fm.name ?? '').length + (desc ?? '').length) / 3.6);
  return { errors, warnings, summary: `N1 ≈ ${tokens} tokens · corps ${lines} lignes` };
}

/** Minimal YAML for frontmatter: scalars, quoted strings, folded (>, >-) and literal (|) blocks, one nested map level. */
function parseYaml(src) {
  const out = {};
  const lines = src.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!m) continue;
    const [, key, rawValue] = m;
    let value = rawValue.trim();
    if (/^[>|][-+]?$/.test(value)) {
      const block = [];
      while (i + 1 < lines.length && (/^\s+\S/.test(lines[i + 1]) || lines[i + 1].trim() === '')) block.push(lines[++i].trim());
      value = value.startsWith('>') ? block.join(' ').trim() : block.join('\n').trim();
    } else if (value === '') {
      const nested = {};
      while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) {
        const n = /^\s+([A-Za-z0-9_-]+):\s*(.*)$/.exec(lines[++i]);
        if (n) nested[n[1]] = unquote(n[2].trim());
      }
      out[key] = nested;
      continue;
    }
    out[key] = unquote(value);
  }
  return out;
}
function unquote(v) { return /^(["']).*\1$/.test(v) ? v.slice(1, -1) : v; }
function walk(d) { return readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; }); }
