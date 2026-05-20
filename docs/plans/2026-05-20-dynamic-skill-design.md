# Multi-Delegate: Dynamic SKILL.md Generation

## Problem

`SKILL.md` is currently a static markdown file shipped with the plugin. It
contains a hard-coded example of `subagent(...)` calls referencing specific
models (`claude-opus-4-6`, `gpt-5.4`, `gemini-3.1-pro-preview`). When the user
configures different models in `multi-delegate.jsonc`, the skill instructions
become out of sync — the orchestrator either dispatches a wrong agent name
shown in the example, or has to derive names by guessing the rule.

Today the plugin also relies on a symlink from
`~/.config/opencode/skills/multi-delegate` to the package directory inside
`node_modules`. That couples the runtime skill content to the installed
package contents and prevents per-user dynamic rendering.

## Goal

Make the skill list of dispatch targets reflect the current
`multi-delegate.jsonc` exactly, with no manual editing of `SKILL.md`.

## Design

### Source of truth

Move the markdown body into the plugin code. `SKILL.md` is no longer shipped
as a static file — it is rendered at plugin init time from a JS template
literal and written to the opencode config dir.

### Location on disk

Render directly into
`{configDir}/skills/multi-delegate/multi-delegate/SKILL.md`. No symlink. The
skill is owned by the runtime config dir; the npm package no longer ships a
`SKILL.md` at all.

### Render module

`lib/render-skill.js` exports a single pure function:

```js
export function renderSkill(delegates: { agentName: string, model: string }[]): string
```

It produces the full `SKILL.md` content (frontmatter + body). The Step 1
section lists one `subagent(agent="<name>", prompt="<FULL user task text>")`
line per delegate, in the order received.

Pure function, no I/O, no config parsing — easy to unit-test.

### Empty config behaviour

When `delegate_models` is empty (or absent), the skill is not registered at
all: any pre-existing `SKILL.md` in the target path is removed. Opencode's
discovery walks the dir and finds nothing — the skill silently disappears
from `available_skills`. Rationale: a multi-delegate skill with zero
delegates is useless and would only confuse the orchestrator.

### Symlink migration

If a previous version of the plugin created a symlink at the target path,
`fs.rmSync(target, {force: true, recursive: true})` removes it before the
new directory is created. Idempotent — safe to run on every startup.

### Package contents

Drop `skills/multi-delegate/multi-delegate/SKILL.md` from the published
package. `package.json` `files` array updated to ship only `index.js` and
`lib/`.

## Out of scope

- Schema or version migration of `multi-delegate.jsonc` — unchanged.
- Hot reload of `SKILL.md` when the config file changes mid-session —
  opencode caches skills per-instance; restart is fine.
- Hooking into opencode's `Skill.Service` directly — opencode plugin API
  has no skill-injection hook (verified against `packages/opencode/src/skill/`
  in `anomalyco/opencode` dev branch). Filesystem is the only public path.

## Testing

`test/render-skill.test.js` using built-in `node:test`:

- `renderSkill([])` throws (caller should not invoke with empty list).
- `renderSkill([{agentName: 'a', model: 'x/y'}])` contains exactly one
  `subagent(agent="a"` line in Step 1.
- Multiple delegates: each agent name appears as a separate line, in input
  order.
- Output starts with valid YAML frontmatter `---\nname: multi-delegate\n...`
- Body still includes the orchestrator rules verbatim (Step 2/3/4, Rules
  section) — guard against accidentally dropping them in a refactor.

Run via `npm test`.
