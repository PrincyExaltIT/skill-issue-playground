// formats.mjs — export findings to the formats CI platforms understand natively.
import { createHash } from 'node:crypto';

export const SEVERITY_ORDER = ['BLOCKER', 'MAJOR', 'MINOR', 'INFO'];
export const rank = (s) => SEVERITY_ORDER.indexOf(s);

const fingerprint = (f) => createHash('sha1').update(`${f.ruleId}|${f.file}|${(f.snippet ?? '').trim()}`).digest('hex');

/** GitLab Code Quality report (shown in the MR widget). */
export function toGitLab(findings) {
  const map = { BLOCKER: 'blocker', MAJOR: 'major', MINOR: 'minor', INFO: 'info' };
  return JSON.stringify(findings.map((f) => ({
    description: `${f.ruleId} ${f.title ?? ''} — ${f.message}`.trim(),
    check_name: f.ruleId,
    fingerprint: fingerprint(f),
    severity: map[f.severity] ?? 'info',
    location: { path: f.file, lines: { begin: f.line } },
  })), null, 2);
}

/** SARIF 2.1.0 (GitHub code scanning, VS Code SARIF viewer). */
export function toSarif(findings, toolName = 'angular-review') {
  const level = { BLOCKER: 'error', MAJOR: 'error', MINOR: 'warning', INFO: 'note' };
  const rules = [...new Map(findings.map((f) => [f.ruleId, {
    id: f.ruleId,
    shortDescription: { text: f.title ?? f.ruleId },
    helpUri: f.source?.startsWith('http') ? f.source : undefined,
  }])).values()];
  return JSON.stringify({
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [{
      tool: { driver: { name: toolName, informationUri: 'https://github.com/PrincyExaltIT/skill-issue', rules } },
      results: findings.map((f) => ({
        ruleId: f.ruleId,
        level: level[f.severity] ?? 'note',
        message: { text: `${f.message}${f.suggestion ? `\nFix: ${f.suggestion}` : ''}` },
        partialFingerprints: { 'angularReview/v1': fingerprint(f) }, // primaryLocationLineHash is computed by the upload action
        locations: [{ physicalLocation: { artifactLocation: { uri: f.file }, region: { startLine: f.line } } }],
      })),
    }],
  }, null, 2);
}

/** GitHub Actions workflow commands: inline annotations on the PR diff. */
export function toGitHubAnnotations(findings) {
  const cmd = { BLOCKER: 'error', MAJOR: 'error', MINOR: 'warning', INFO: 'notice' };
  const esc = (s) => String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  return findings.map((f) => `::${cmd[f.severity] ?? 'notice'} file=${f.file},line=${f.line},title=${esc(`${f.ruleId} ${f.title ?? ''}`.trim())}::${esc(`${f.message} → ${f.suggestion ?? ''}`)}`).join('\n');
}

/** Compact human text (terminal). */
export function toText(findings) {
  if (findings.length === 0) return 'Aucun finding.';
  return findings.map((f) => `${f.severity.padEnd(7)} ${f.ruleId.padEnd(11)} ${f.file}:${f.line}  ${f.title ?? f.message}`).join('\n');
}

/** Markdown table for a CI job summary ($GITHUB_STEP_SUMMARY): the full list, whereas GitHub keeps 10 annotations per level and step. */
export function toMarkdown(findings) {
  const icon = { BLOCKER: '🔴', MAJOR: '🟠', MINOR: '🟡', INFO: '🔵' };
  if (findings.length === 0) return '### angular-review · scan\n\nAucun candidat sur les lignes modifiées.';
  const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
  return [
    `### angular-review · scan (${findings.length} candidat(s))`,
    '',
    SEVERITY_ORDER.map((s) => `${icon[s]} ${s} : ${findings.filter((f) => f.severity === s).length}`).join(' · '),
    '',
    '| Sévérité | Règle | Emplacement | Constat | Confiance |',
    '|---|---|---|---|---|',
    ...findings.map((f) => `| ${icon[f.severity] ?? ''} ${f.severity} | \`${f.ruleId}\` | \`${cell(f.file)}:${f.line}\` | ${cell(f.title ?? f.message)} | ${f.evidence?.confidence ?? ''} |`),
    '',
    'Candidats du scan déterministe, avant vérification : la review complète confirme ou écarte chacun.',
  ].join('\n');
}

export function exportAs(format, findings) {
  switch (format) {
    case 'gitlab': return toGitLab(findings);
    case 'sarif': return toSarif(findings);
    case 'github': return toGitHubAnnotations(findings);
    case 'markdown': return toMarkdown(findings);
    case 'text': return toText(findings);
    default: return JSON.stringify(findings, null, 2);
  }
}

/** True when at least one finding is at or above the threshold severity. */
export function breaches(findings, threshold) {
  if (!threshold) return false;
  const t = rank(String(threshold).toUpperCase());
  return t >= 0 && findings.some((f) => rank(f.severity) <= t);
}
