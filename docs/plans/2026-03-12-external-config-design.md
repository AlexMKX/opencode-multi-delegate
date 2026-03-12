# Multi-Delegate: External Config File

## Summary

Move plugin configuration from `opencode.json` section to a standalone `multi-delegate.jsonc` file in the opencode config directory. Auto-scaffold the file on first run. Simplify the config format.

## Decisions

- **Config location:** `{configDir}/multi-delegate.jsonc` where `configDir = OPENCODE_CONFIG_DIR || ~/.config/opencode`
- **No backward compat:** Drop support for `opencode.json` `multi-delegate` section entirely (v0.2.0, low user base)
- **Format:** `delegate_models` array of objects `{ "model": "provider/id", "variant": "low|medium|high|max" }`
- **No maxSteps:** Removed from config and code — let opencode use its own defaults
- **No new dependencies:** JSONC parsing via simple regex comment stripping
- **Scaffolding:** Empty template with commented-out examples on first run

## Config Template

```jsonc
{
  "delegate_models": [
    // Add your models here
    // { "model": "provider/model-id", "variant": "low|medium|high|max" }
    // { "model": "anthropic/claude-opus-4-6", "variant": "medium" }
  ]
}
```

## Changes

### `index.js`

1. Remove `DEFAULT_DELEGATES`, `DEFAULT_MAX_STEPS`
2. Remove reading from `config['multi-delegate']`
3. Add `getConfigDir()` — resolves config directory path
4. Add `ensureConfig(configDir)` — scaffolds `multi-delegate.jsonc` if missing, reads and parses if exists
5. Add `stripJsonComments(str)` — strips `//` and `/* */` comments for JSONC parsing
6. Iterate `delegate_models` array instead of `Object.entries(delegates)`
7. Remove `maxSteps` from agent registration

### `SKILL.md`

1. Update config example to new format with `delegate_models` array
2. Update config path reference to `~/.config/opencode/multi-delegate.jsonc`
3. Remove `maxSteps` mentions

### Not changed

- `package.json` — no new dependencies
- `ensureSkillLink()` — symlink logic stays
- `DELEGATE_PROMPT` — unchanged
- `toAgentName()` — unchanged
