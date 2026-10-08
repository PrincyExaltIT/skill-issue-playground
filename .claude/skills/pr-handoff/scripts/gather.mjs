#!/usr/bin/env node
// gather.mjs — collect the FACTS of a change so the agent writes prose, not guesses.
//   node gather.mjs [--base origin/main]   -> JSON on stdout (and .review/handoff-facts.json)
// Facts: branch, base, commits, diffstat, review verdict and open findings, fixes, test script, remote kind.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = parseArgs(process.argv.slice(2));
const root = args.root ? resolve(String(args.root)) : (git(['rev-parse', '--show-toplevel']) ?? process.cwd());
const base = String(args.base ?? ['origin/main', 'origin/master', 'main', 'master'].find((b) => git(['rev-parse', '--verify', '--quiet', b])) ?? 'HEAD~1');
const mergeBase = git(['merge-base', base, 'HEAD']) ?? base;

const findingsDoc = readJson(join(root, '.review', 'findings.json'));
const findings = findingsDoc?.findings ?? [];
const pkg = readJson(join(root, 'package.json')) ?? {};
const remote = git(['remote', 'get-url', 'origin']) ?? '';

const facts = {
  generatedAt: new Date().toISOString(),
  branch: git(['rev-parse', '--abbrev-ref', 'HEAD']),
  base,
  remote: { url: remote.replace(/\/\/[^@/]+@/, '//'), kind: /gitlab/i.test(remote) ? 'gitlab' : /github/i.test(remote) ? 'github' : 'other' },
  commits: (git(['log', '--format=%h %s', `${mergeBase}..HEAD`]) ?? '').split('\n').filter(Boolean),
  diffstat: git(['diff', '--shortstat', mergeBase]) ?? '',
  files: (git(['diff', '--name-status', mergeBase]) ?? '').split('\n').filter(Boolean),
  uncommitted: (git(['status', '--porcelain']) ?? '').split('\n').filter((l) => l && !l.includes('.review/')).length,
  review: findingsDoc ? {
    verdict: findingsDoc.verdict,
    reviewedAt: findingsDoc.generatedAt,
    counts: Object.fromEntries(['open', 'fixed', 'wontfix', 'candidate'].map((s) => [s, findings.filter((f) => f.status === s).length])),
    open: findings.filter((f) => f.status === 'open').map((f) => `${f.id} ${f.severity} ${f.ruleId} ${f.file}:${f.line} — ${f.title ?? f.message}`),
    wontfix: findings.filter((f) => f.status === 'wontfix').map((f) => `${f.id} ${f.ruleId} — ${f.fixNote ?? ''}`),
    fixed: findings.filter((f) => f.status === 'fixed').map((f) => `${f.id} ${f.ruleId} — ${f.fixNote ?? ''}`),
  } : null,
  fixesLog: existsSync(join(root, '.review', 'FIXES.md')) ? '.review/FIXES.md' : null,
  scripts: Object.fromEntries(Object.entries(pkg.scripts ?? {}).filter(([k]) => /^(test|build|lint|e2e)/.test(k))),
};

mkdirSync(join(root, '.review'), { recursive: true });
writeFileSync(join(root, '.review', 'handoff-facts.json'), JSON.stringify(facts, null, 2));
process.stdout.write(JSON.stringify(facts, null, 2) + '\n');

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
function git(argv) { try { return execFileSync('git', argv, { cwd: root ?? process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null; } catch { return null; } }
function readJson(p) { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } }
