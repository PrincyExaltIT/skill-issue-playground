// project.mjs — what kind of Angular project is this, and what kind of file is that?
import { existsSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';

export function safeRead(p) { try { return readFileSync(p, 'utf8'); } catch { return null; } }
export function readJson(p) { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } }
export const normalize = (p) => p.replace(/\\/g, '/');

/** Angular version + the flags that change what counts as a finding. */
export function detectAngular(dir) {
  const pkg = readJson(join(dir, 'package.json')) ?? {};
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const corePkg = readJson(join(dir, 'node_modules', '@angular', 'core', 'package.json'));
  const installed = corePkg?.version;
  const bpPath = corePkg?.angular?.bestPractices?.path;
  const bestPractices = bpPath && existsSync(join(dir, 'node_modules', '@angular', 'core', bpPath))
    ? normalize(join('node_modules', '@angular', 'core', bpPath)) : null;
  const declared = deps['@angular/core']?.replace(/^[^\d]*/, '') ?? null;
  const version = installed ?? declared;
  const major = version ? Number(version.split('.')[0]) : null;

  const angularJson = safeRead(join(dir, 'angular.json')) ?? '';
  const bootstrap = ['src/app/app.config.ts', 'src/main.ts'].map((p) => safeRead(join(dir, p)) ?? '').join('\n');
  const usesZoneJs = /["']zone\.js["']/.test(angularJson) || /provideZoneChangeDetection\s*\(/.test(bootstrap);
  const explicitZoneless = /provideZonelessChangeDetection\s*\(/.test(bootstrap);

  return {
    version,
    major,
    zoneless: explicitZoneless || (major !== null && major >= 21 && !usesZoneJs),
    onPushByDefault: major !== null && major >= 22,
    standaloneByDefault: major !== null && major >= 19,
    ssr: Boolean(deps['@angular/ssr']) || existsSync(join(dir, 'src', 'server.ts')),
    testRunner: deps.vitest ? 'vitest' : deps.karma ? 'karma' : deps.jest ? 'jest' : /unit-test/.test(angularJson) ? 'vitest' : null,
    eslint: Object.keys(deps).some((d) => d === 'angular-eslint' || d.startsWith('@angular-eslint/')),
    typescript: readJson(join(dir, 'node_modules', 'typescript', 'package.json'))?.version ?? deps.typescript ?? null,
    bestPractices, // Angular's own guidance for the INSTALLED version (shipped in @angular/core since v22)
  };
}

export function kindOf(root, path) {
  const name = basename(path);
  if (/\.spec\.ts$/.test(name)) return 'spec';
  if (/\.html$/.test(name)) return 'template';
  if (/\.(css|scss|sass|less)$/.test(name)) return 'style';
  if (/\.json$|eslint/.test(name)) return 'config';
  if (/routes?\.ts$/.test(name)) return 'routes';
  const src = safeRead(join(root, path)) ?? '';
  if (/@Component\s*\(/.test(src)) return 'component';
  if (/@Directive\s*\(/.test(src)) return 'directive';
  if (/@Pipe\s*\(/.test(src)) return 'pipe';
  if (/@(Injectable|Service)\s*\(/.test(src)) return 'service';
  if (/CanActivateFn|CanMatchFn|ResolveFn|implements\s+Can(Activate|Match|Deactivate)/.test(src)) return 'guard';
  if (/HttpInterceptorFn|implements\s+HttpInterceptor/.test(src)) return 'interceptor';
  return 'typescript';
}

export function hasSpec(root, path) {
  if (!/\.ts$/.test(path) || /\.spec\.ts$/.test(path)) return null;
  return existsSync(join(root, path.replace(/\.ts$/, '.spec.ts')));
}
