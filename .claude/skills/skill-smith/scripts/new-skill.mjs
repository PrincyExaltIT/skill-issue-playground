#!/usr/bin/env node
// new-skill.mjs — scaffold a portable skill folder.
//   node new-skill.mjs <name> [--dir skills] [--with scripts,references,assets] [--manual]
// --manual adds the Claude Code extension disable-model-invocation (user-invoked skill).

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const argv = process.argv.slice(2);
const name = argv.find((a) => !a.startsWith('--'));
const opt = (k) => { const i = argv.indexOf(`--${k}`); return i === -1 ? undefined : (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true); };

if (!name || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name) || name.length > 64) {
  console.error('Usage : node new-skill.mjs <nom-en-kebab-case> [--dir skills] [--with scripts,references,assets] [--manual]');
  process.exit(2);
}
const base = resolve(String(opt('dir') ?? 'skills'));
const dir = join(base, name);
if (existsSync(dir)) { console.error(`✖ ${dir} existe déjà.`); process.exit(2); }
const extras = String(opt('with') ?? 'scripts,references').split(',').filter(Boolean);

mkdirSync(dir, { recursive: true });
for (const e of extras) mkdirSync(join(dir, e), { recursive: true });

const manual = opt('manual') ? 'disable-model-invocation: true\n' : '';
writeFileSync(join(dir, 'SKILL.md'), `---
name: ${name}
description: TODO — what it does in one sentence. Use when TODO (one trigger per real situation, in the words your team types).
license: MIT
compatibility: TODO — runtime requirements (e.g. Node.js 18+, git), or remove.
${manual}metadata:
  version: "0.1.0"
---

# ${name.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')}

TODO — one paragraph: the job, the input, the output. Paths below are relative to this skill's folder.

## Workflow

### 1. TODO first step

TODO — what to do.

Done when TODO — a condition the agent can check.

### 2. TODO next step

${extras.includes('scripts') ? 'Run `node scripts/TODO.mjs` — anything that must be exact, repeated or verifiable belongs in a script.\n\n' : ''}Done when TODO.

## Guardrails

- TODO — the few rules that must hold on every run, phrased positively.
${extras.includes('references') ? '\n## References\n\n- `references/TODO.md` — read when TODO (one pointer per branch of the task).\n' : ''}`);

if (extras.includes('scripts')) {
  writeFileSync(join(dir, 'scripts', 'TODO.mjs'), `#!/usr/bin/env node
// TODO.mjs — replace with the deterministic part of the skill. Print JSON on stdout, humans read stderr.
console.log(JSON.stringify({ ok: true }));
`);
}
if (extras.includes('references')) writeFileSync(join(dir, 'references', 'TODO.md'), '# TODO\n\nReference material loaded only when SKILL.md points to it.\n');
mkdirSync(join(dir, 'agents'), { recursive: true });
writeFileSync(join(dir, 'agents', 'openai.yaml'), `interface:\n  display_name: "${name}"\n  short_description: "TODO"\n`);

console.log(`✔ ${dir}\n  Prochaines étapes : remplir les TODO, puis node ${join('scripts', 'validate.mjs')} ${dir}`);
