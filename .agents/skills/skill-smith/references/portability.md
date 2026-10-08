# Portability across harnesses (checked 2026-10-08)

A skill folder is portable by default. What varies is **where** each harness looks, **how** it is invoked, and which **extra fields** it understands. Source of the kit's installer: `kit/harnesses.json`.

## Where to put it

| Harness | Project folder(s) read | User folder |
|---|---|---|
| Claude Code | `.claude/skills/` — **not** `.agents/skills/` | `~/.claude/skills/` |
| OpenAI Codex | `.agents/skills/` (cwd up to repo root) | `~/.agents/skills/` (`~/.codex/skills/` legacy) |
| GitHub Copilot | `.github/skills/`, `.claude/skills/`, `.agents/skills/` | `~/.copilot/skills/`, `~/.agents/skills/` |
| Cursor | `.agents/skills/`, `.cursor/skills/` (+ `.claude/`, `.codex/`) | `~/.agents/skills/`, `~/.cursor/skills/` |
| Gemini CLI / Antigravity | `.agents/skills/` (wins), `.gemini/skills/` | `~/.agents/skills/`, `~/.gemini/skills/` |
| OpenCode | `.opencode/skills/`, `.claude/skills/`, `.agents/skills/` | `~/.config/opencode/skills/`, `~/.agents/skills/` |
| Kilo Code | `.agents/skills/`, `.kilo/skills/` | `~/.agents/skills/` |
| Continue | `.continue/skills/`, `.claude/skills/` | `~/.continue/skills/` |

**Rule of thumb:** `.agents/skills/` + `.claude/skills/` covers all of them. Commit both (copies, or a symlink — Windows needs Developer Mode for symlinks).

## How it is invoked

- Automatic, from the description, everywhere. Gemini CLI asks the user to consent before activating.
- By name: `/name` (Claude Code, Copilot, Cursor, Antigravity, Kilo), `$name` (Codex).

## Optional extensions and their price

| Field / file | Honoured by | Price |
|---|---|---|
| `disable-model-invocation: true` | Claude Code, Cursor, VS Code Copilot | Rejected by claude.ai upload and `skills-ref validate` (non-spec field) |
| `agents/openai.yaml` → `policy.allow_implicit_invocation: false` | Codex | None: other harnesses ignore the file |
| `context: fork`, `agent`, `hooks`, `model`, `argument-hint` | Claude Code (some in VS Code) | Same as above: breaks strict validators |
| `allowed-tools` | Claude Code (pre-approves for the turn), Copilot CLI | In the spec but experimental; support varies |

Two strategies:

1. **Spec-only `SKILL.md`** (`name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools`) and harness behaviour in harness config — Codex `agents/openai.yaml`, Claude Code `skillOverrides` in settings. Passes every validator.
2. **Extension fields in the frontmatter** for the harnesses that honour them. Simpler for the team, but not uploadable to claude.ai.

Run `node scripts/validate.mjs <dir>` (warnings) or `--strict` (spec-only, like `skills-ref`) to see which strategy a skill follows.

## Limits worth knowing

- Claude Code caps the skill listing at 1% of the context window and each description at 1,536 characters.
- Codex keeps the skill list under 2% of the context.
- Project skills override user skills with the same name (Cline is the exception).
