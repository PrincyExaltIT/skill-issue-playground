// source.mjs — tiny, dependency-free helpers to read Angular sources well enough for heuristics.
// Not a parser. Good enough to point an agent at a line; the agent (or a human) verifies.

/** Replace comments and string/template contents with spaces, keeping line/column positions. */
export function maskCode(text) {
  let out = '';
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    const next = text[i + 1];
    if (c === '/' && next === '/') {
      while (i < n && text[i] !== '\n') { out += ' '; i++; }
    } else if (c === '/' && next === '*') {
      out += '  '; i += 2;
      while (i < n && !(text[i] === '*' && text[i + 1] === '/')) { out += text[i] === '\n' ? '\n' : ' '; i++; }
      if (i < n) { out += '  '; i += 2; }
    } else if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      out += quote; i++;
      while (i < n && text[i] !== quote) {
        if (text[i] === '\\') { out += '  '; i += 2; continue; }
        out += text[i] === '\n' ? '\n' : ' ';
        i++;
      }
      if (i < n) { out += quote; i++; }
    } else {
      out += c; i++;
    }
  }
  return out;
}

/** 1-based line number of a character offset. */
export function lineAt(text, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

/** Index of the parenthesis closing the one at openIndex (works on masked code). -1 if none. */
export function matchParen(masked, openIndex, open = '(', close = ')') {
  let depth = 0;
  for (let i = openIndex; i < masked.length; i++) {
    if (masked[i] === open) depth++;
    else if (masked[i] === close) { depth--; if (depth === 0) return i; }
  }
  return -1;
}

/** Start offset of the statement containing idx (skips balanced groups backwards). */
export function statementStart(masked, idx) {
  let depth = 0;
  for (let i = idx - 1; i >= 0; i--) {
    const c = masked[i];
    if (c === ')' || c === ']' || c === '}') depth++;
    else if (c === '(' || c === '[' || c === '{') { if (depth === 0) return i + 1; depth--; }
    else if (c === ';' && depth === 0) return i + 1;
  }
  return 0;
}

/** Every call `name(` in masked code, with the span of its arguments. */
export function findCalls(masked, nameRegexSource) {
  // Member calls ('\\.subscribe') carry their own dot; bare names must not follow '.', '$' or a word char.
  const guard = nameRegexSource.startsWith('\\.') ? '' : '(?<![\\w$.])';
  const re = new RegExp(`${guard}(?:${nameRegexSource})\\s*\\(`, 'g');
  const calls = [];
  let m;
  while ((m = re.exec(masked))) {
    const open = m.index + m[0].length - 1;
    const close = matchParen(masked, open);
    calls.push({ start: m.index, open, close: close === -1 ? masked.length : close, name: m[0].replace(/\s*\($/, '') });
  }
  return calls;
}

/**
 * For each line of a TS file, the class member that encloses it:
 * { inClass, depthInClass, member } where member is 'constructor', a method name,
 * or null for field initializers / class body level.
 */
export function classMemberMap(masked) {
  const METHOD = /^\s*(?:(?:public|private|protected|static|override|async|get|set)\s+)*([A-Za-z_$][\w$]*)\s*(?:<[^>]*>)?\s*\(/;
  const NOT_METHODS = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'function', 'super', 'await', 'new', 'typeof', 'this']);
  const CLASS_DECL = /(^|[^\w$.])class\s+[A-Za-z_$][\w$]*/;
  const result = [];
  let depth = 0;
  let classBody = null; // depth of the class body (members live at this depth)
  let pendingClass = false;
  let member = null;
  for (const line of masked.split('\n')) {
    if (classBody === null && CLASS_DECL.test(line)) pendingClass = true;
    if (classBody !== null && depth === classBody && member === null) {
      const m = METHOD.exec(line);
      if (m && !NOT_METHODS.has(m[1])) member = m[1];
    }
    result.push({ inClass: classBody !== null && depth >= classBody, member, depth });
    for (const ch of line) {
      if (ch === '{') {
        depth++;
        if (pendingClass) { classBody = depth; pendingClass = false; }
      } else if (ch === '}') {
        depth--;
        if (classBody !== null && depth === classBody) member = null; // method body closed
        if (classBody !== null && depth < classBody) { classBody = null; member = null; }
      }
    }
    // Overloads / abstract members have no body: `abstract load(): void;`
    if (member !== null && classBody !== null && depth === classBody && /;\s*$/.test(line)) member = null;
  }
  return result;
}

/** True when an injection-context-only API (inject, toSignal, takeUntilDestroyed(), effect) is safe at this line. */
export function inInjectionContext(info) {
  if (!info || !info.inClass) return true; // top-level functions: guards, interceptors, factories... cannot tell, assume fine
  return info.member === null || info.member === 'constructor';
}

/** Inline templates of a component file: [{ text, startLine }] (startLine = line of first template char). */
export function inlineTemplates(text) {
  const res = [];
  const re = /\btemplate\s*:\s*`/g;
  let m;
  while ((m = re.exec(text))) {
    const start = m.index + m[0].length;
    let i = start;
    while (i < text.length && text[i] !== '`') { if (text[i] === '\\') i++; i++; }
    res.push({ text: text.slice(start, i), startLine: lineAt(text, start) });
  }
  return res;
}

/** Iterate opening HTML tags: yields { name, attrs, line, raw } with multi-line tags supported. */
export function* htmlTags(html, lineOffset = 1) {
  const re = /<([a-zA-Z][\w-]*)(\s(?:[^>"']|"[^"]*"|'[^']*')*)?\/?>/g;
  let m;
  while ((m = re.exec(html))) {
    yield { name: m[1].toLowerCase(), attrs: m[2] ?? '', line: lineAt(html, m.index) + lineOffset - 1, raw: m[0] };
  }
}

/** Interpolations and bound attribute expressions in a template: [{ expr, line }]. */
export function* templateExpressions(html, lineOffset = 1) {
  const interp = /\{\{([\s\S]*?)\}\}/g;
  let m;
  while ((m = interp.exec(html))) yield { expr: m[1], line: lineAt(html, m.index) + lineOffset - 1, kind: 'interpolation' };
  const bound = /\s\[([\w.-]+)\]\s*=\s*"([^"]*)"/g;
  while ((m = bound.exec(html))) yield { expr: m[2], line: lineAt(html, m.index) + lineOffset - 1, kind: `[${m[1]}]` };
}

export function lineText(lines, n) { return (lines[n - 1] ?? '').trim(); }
