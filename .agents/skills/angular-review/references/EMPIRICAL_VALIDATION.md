# Empirical validation (optional)

Static review cannot see the rendered DOM. When a Playwright MCP server is available (tools named like `browser_navigate`, `browser_snapshot`), confirm the findings that a browser can prove: accessibility (R-A11Y), runtime performance hints (R-PERF), project constraints (R-PROJ). Skip this file entirely otherwise.

## Steps

1. **Start the app.** Find the dev script in `package.json` (`start`, `dev`, `serve`), run it in the background, wait for the URL (Angular CLI default `http://localhost:4200`).
2. **For each finding worth proving**:
   - navigate to the page that renders the component;
   - take an accessibility snapshot (`browser_snapshot`) — a control without accessible name shows up without a label;
   - evaluate a precise property when needed (attribute, computed style, element count);
   - resize the viewport when the finding is about layout.
3. **Record the outcome** in one line per check, then store it:
   `node scripts/findings.mjs note --empirical "✅ /talks : snapshot ARIA, champ de recherche sans nom accessible confirmé (F-002) · ✅ resize 1280→390 OK"`
   A check that contradicts a finding is a reason to `dismiss` it; a check that reveals a new problem becomes a finding with prefix `R-RUNTIME-NNN` (add it to `.review/reviewers/runtime.json`, then `merge` again).
4. **Versioned e2e suite**: run it only if `@playwright/test` is already installed locally — `npx --no-install playwright test --reporter=list` — never let it download.
5. **Stop the dev server** you started.

## Guardrails

- Never edit `src/` because a check failed: report it.
- If the server or the browser cannot start, write `Non exécutée — <raison>` with `note --empirical` and continue; this step never blocks the verdict.
- Suggest (do not perform) adding `playwright-report/` and `test-results/` to `.gitignore`.
