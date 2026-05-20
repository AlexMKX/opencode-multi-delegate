# Dynamic SKILL.md Generation — Implementation Plan

**Goal:** Replace static `SKILL.md` with runtime-rendered file driven by `multi-delegate.jsonc`, so the orchestrator skill always lists the actual delegate agents.

**Architecture:** Pure render function in `lib/render-skill.js` produces the markdown body from a list of delegates. `index.js` calls it at plugin init, writes the result to `{configDir}/skills/multi-delegate/multi-delegate/SKILL.md`. Empty config → file removed (skill disappears from opencode). Symlink-based scaffolding is replaced by direct file write.

**Tech Stack:** Node.js ESM, `node:test`, `node:fs`, `node:path`. No new deps.

---

## File Structure

- **Create:** `lib/render-skill.js` — exports `renderSkill(delegates)`. Pure function.
- **Create:** `test/render-skill.test.js` — `node:test` unit tests for the render function.
- **Modify:** `index.js` — drop symlink logic, drop static `DELEGATE_PROMPT` location duplication, call `renderSkill` and write to configDir at init.
- **Modify:** `package.json` — add `test` script, update `files` array (drop static SKILL.md, add `lib/`).
- **Delete:** `skills/multi-delegate/multi-delegate/SKILL.md` — no longer source of truth.
- **Delete:** `skills/` dir (after SKILL.md removal it's empty).

---

## Task 1: Render module skeleton

**Files:**
- Create: `lib/render-skill.js`
- Create: `test/render-skill.test.js`

- [ ] **Step 1: Write the failing test for empty delegates**

`test/render-skill.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderSkill } from '../lib/render-skill.js';

test('renderSkill throws on empty delegate list', () => {
  assert.throws(() => renderSkill([]), /at least one delegate/i);
  assert.throws(() => renderSkill(), /at least one delegate/i);
});
```

- [ ] **Step 2: Run the test, verify it fails**

```
cd /home/alex/Projects/multi-delegate
node --test test/render-skill.test.js
```

Expected: FAIL with `Cannot find module '../lib/render-skill.js'`.

- [ ] **Step 3: Create render module with minimal body**

`lib/render-skill.js`:

```js
/**
 * Render the multi-delegate SKILL.md body from a list of registered
 * delegate agents. Pure function — does no I/O.
 *
 * @param {Array<{ agentName: string, model: string }>} delegates
 * @returns {string} Full SKILL.md content (frontmatter + body)
 */
export function renderSkill(delegates) {
  if (!Array.isArray(delegates) || delegates.length === 0) {
    throw new Error('renderSkill: expected at least one delegate');
  }
  return '';
}
```

- [ ] **Step 4: Run the test, verify it passes**

```
node --test test/render-skill.test.js
```

Expected: PASS (1 passing).

- [ ] **Step 5: Commit**

```
git add lib/render-skill.js test/render-skill.test.js
git commit -m "feat: scaffold renderSkill function with empty-list guard"
```

---

## Task 2: Frontmatter and orchestrator body

**Files:**
- Modify: `lib/render-skill.js`
- Modify: `test/render-skill.test.js`

- [ ] **Step 1: Add frontmatter and core-body tests**

Append to `test/render-skill.test.js`:

```js
const ONE = [{ agentName: 'anthropic_claude-opus-4-7-delegate', model: 'anthropic/claude-opus-4-7' }];

test('renderSkill output starts with valid frontmatter', () => {
  const out = renderSkill(ONE);
  assert.match(out, /^---\nname: multi-delegate\ndescription: [^\n]+\n---/);
});

test('renderSkill body retains orchestrator rules', () => {
  const out = renderSkill(ONE);
  assert.match(out, /## Step 1: Dispatch/);
  assert.match(out, /## Step 2: Collect/);
  assert.match(out, /## Step 3: Analyze/);
  assert.match(out, /## Step 4: Output/);
  assert.match(out, /## Rules/);
});
```

- [ ] **Step 2: Run tests, verify new ones fail**

```
node --test test/render-skill.test.js
```

Expected: 1 passing, 2 failing (frontmatter and rules not present).

- [ ] **Step 3: Implement render with full body**

Replace `lib/render-skill.js`:

```js
const FRONTMATTER = `---
name: multi-delegate
description: Use when the user wants to delegate a task to multiple AI models in parallel and get a consolidated analysis with cross-model verdicts
---`;

const HEADER = `# Multi-Delegate

You are an ORCHESTRATOR. Your ONLY job is to dispatch the user's task to delegate agents and consolidate their reports. You do NOT do the work yourself.

<CRITICAL>
- You MUST use the \`subagent\` tool to dispatch to ALL registered \`*-delegate\` agents
- You MUST dispatch ALL delegates in PARALLEL (all subagent calls in ONE message)
- You MUST NOT read files, run commands, or do analysis yourself
- You MUST NOT use \`task\`, \`explore\`, \`bash\`, \`read\`, \`grep\`, \`glob\` or any other tool — ONLY \`subagent\`
- If a delegate fails, report the failure — do NOT try to do its work yourself
</CRITICAL>`;

const STEP_1_PREAMBLE = `## Step 1: Dispatch

Call the \`subagent\` tool for EACH registered delegate agent, ALL in ONE message (parallel). Pass the user's full request as-is:

\`\`\``;

const STEP_1_POSTAMBLE = `\`\`\`

Do NOT modify, summarize, or pre-process the task. Pass it verbatim.`;

const TAIL = `## Step 2: Collect

Wait for ALL delegates to return.

## Step 3: Analyze

For each finding across all reports:

1. **Group** — match findings that describe the same issue (even if worded differently)
2. **Attribute** — note which delegates reported it
3. **Verdict**:
   - **confirmed** — 2+ delegates agree AND argumentation is valid
   - **disputed** — only 1 delegate claims it, OR arguments contradict each other
   - **rejected** — argumentation doesn't hold up, others explicitly refute, or clear hallucination

## Step 4: Output

\`\`\`
## Multi-Delegate Report

### Finding #1: [Title]

**Description:** [What, where, why it matters. File paths, line numbers.]

**Severity:** critical | important | minor | info

**Recommendations:**
- [Concrete action 1]
- [Concrete action 2]

**Claimed by:** [which delegates]

**Orchestrator verdict:** confirmed / disputed / rejected
[WHY this verdict.]

---

## Consensus
[What delegates agree on]

## Disagreements
[Where opinions diverged]

## Final Recommendation
[Your synthesized conclusion]
\`\`\`

## Rules

- **Do NOT** do delegate work yourself — you are ONLY an orchestrator
- **Do NOT** use any tool except \`subagent\` — no \`task\`, \`read\`, \`bash\`, \`grep\`, \`glob\`, \`explore\`
- **Do NOT** skip any delegate's findings — every finding must appear in the report
- **Do NOT** blindly trust majority — 2 models agreeing on a hallucination is still a hallucination
- **Do NOT** add your own findings — you analyze THEIR reports, not the code
- **Do NOT** run delegates sequentially — ALL in ONE parallel dispatch
- **Do NOT** modify the task before sending to delegates — pass it as-is`;

function formatDispatchBlock(delegates) {
  return delegates
    .map((d) => `subagent(agent="${d.agentName}", prompt="<FULL user task text>")`)
    .join('\n');
}

/**
 * Render the multi-delegate SKILL.md body from a list of registered
 * delegate agents. Pure function — does no I/O.
 *
 * @param {Array<{ agentName: string, model: string }>} delegates
 * @returns {string} Full SKILL.md content (frontmatter + body)
 */
export function renderSkill(delegates) {
  if (!Array.isArray(delegates) || delegates.length === 0) {
    throw new Error('renderSkill: expected at least one delegate');
  }

  return [
    FRONTMATTER,
    '',
    HEADER,
    '',
    STEP_1_PREAMBLE,
    formatDispatchBlock(delegates),
    STEP_1_POSTAMBLE,
    '',
    TAIL,
    '',
  ].join('\n');
}
```

- [ ] **Step 4: Run tests, verify all pass**

```
node --test test/render-skill.test.js
```

Expected: 3 passing.

- [ ] **Step 5: Commit**

```
git add lib/render-skill.js test/render-skill.test.js
git commit -m "feat: render full SKILL.md body with orchestrator rules"
```

---

## Task 3: Delegate list rendering

**Files:**
- Modify: `test/render-skill.test.js`

- [ ] **Step 1: Add tests for delegate listing**

Append to `test/render-skill.test.js`:

```js
test('renderSkill lists a single delegate with one subagent line', () => {
  const out = renderSkill([
    { agentName: 'anthropic_claude-opus-4-7-delegate', model: 'anthropic/claude-opus-4-7' },
  ]);
  const matches = out.match(/^subagent\(agent="[^"]+",/gm) || [];
  assert.equal(matches.length, 1);
  assert.match(out, /subagent\(agent="anthropic_claude-opus-4-7-delegate", prompt="<FULL user task text>"\)/);
});

test('renderSkill lists multiple delegates in input order', () => {
  const out = renderSkill([
    { agentName: 'a-delegate', model: 'x/a' },
    { agentName: 'b-delegate', model: 'x/b' },
    { agentName: 'c-delegate', model: 'x/c' },
  ]);
  const lines = out.split('\n').filter((l) => l.startsWith('subagent('));
  assert.deepEqual(
    lines,
    [
      'subagent(agent="a-delegate", prompt="<FULL user task text>")',
      'subagent(agent="b-delegate", prompt="<FULL user task text>")',
      'subagent(agent="c-delegate", prompt="<FULL user task text>")',
    ],
  );
});

test('renderSkill output is stable for the same input', () => {
  const input = [{ agentName: 'foo-delegate', model: 'x/foo' }];
  assert.equal(renderSkill(input), renderSkill(input));
});
```

- [ ] **Step 2: Run tests, verify they pass**

The Task 2 implementation already covers these cases — no code change needed. Just confirm:

```
node --test test/render-skill.test.js
```

Expected: 6 passing.

- [ ] **Step 3: Commit**

```
git add test/render-skill.test.js
git commit -m "test: cover single/multi delegate ordering and stability"
```

---

## Task 4: Wire renderSkill into the plugin

**Files:**
- Modify: `index.js`

- [ ] **Step 1: Replace symlink scaffolding with direct write**

In `index.js`:

1. Remove `ensureSkillLink` function entirely.
2. Add an import for `renderSkill`:

```js
import { renderSkill } from './lib/render-skill.js';
```

3. Replace `ensureSkillLink` and the static `DELEGATE_PROMPT` placement is unchanged, but add a new function:

```js
// Write SKILL.md to {configDir}/skills/multi-delegate/multi-delegate/SKILL.md.
// If no delegates are configured, remove any existing file so the skill
// disappears from opencode's discovery (an empty multi-delegate skill is useless).
const writeSkillFile = (configDir, delegates) => {
  const dir = path.join(configDir, 'skills', 'multi-delegate', 'multi-delegate');
  const file = path.join(dir, 'SKILL.md');

  try {
    // Clean up any prior symlink/file/dir from older plugin versions
    // before deciding what to write.
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch (_) {
      // ignore
    }

    if (delegates.length === 0) return;

    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, renderSkill(delegates), 'utf8');
  } catch (e) {
    // Non-fatal — the orchestrator skill just won't appear.
  }
};
```

4. In `MultiDelegatePlugin`, replace the call to `ensureSkillLink(configDir)` with a deferred call after we know the delegate list. Move the call into the `config` hook OR pre-compute the agent names from `pluginConfig.delegate_models` and call before returning. Use the latter — `config()` runs after init and the file should be on disk before any session asks for skills:

```js
export const MultiDelegatePlugin = async ({ client, directory }) => {
  const configDir = getConfigDir();
  const pluginConfig = loadConfig(configDir);

  const delegates = (pluginConfig.delegate_models || [])
    .filter((d) => d && d.model)
    .map(({ model, variant }) => ({
      agentName: toAgentName(model),
      model,
      variant,
    }));

  writeSkillFile(configDir, delegates);

  return {
    config: async (config) => {
      const agents = config.agent || {};

      for (const { agentName, model, variant } of delegates) {
        const agentDefaults = {
          description: `Multi-delegate: analyst subagent on ${model} (variant: ${variant || 'default'}).`,
          model,
          ...(variant && { variant }),
          mode: 'subagent',
          prompt: DELEGATE_PROMPT,
          tools: { read: true, glob: true, grep: true, list: true, bash: true },
          permission: { bash: { '*': 'allow' } },
        };

        agents[agentName] = {
          ...agentDefaults,
          ...(agents[agentName] || {}),
        };
      }

      config.agent = agents;
    },
  };
};
```

5. Remove the now-unused `__dirname` and `fileURLToPath` imports if no other code references them.

- [ ] **Step 2: Verify it loads (smoke import check)**

```
node -e "import('./index.js').then((m) => console.log(typeof m.MultiDelegatePlugin))"
```

Expected: prints `function`.

- [ ] **Step 3: Verify file is rendered with current user config**

```
OPENCODE_CONFIG_DIR=/tmp/md-test node -e "import('./index.js').then(async (m) => { await m.MultiDelegatePlugin({client:null, directory:'.'}); })"
ls /tmp/md-test/skills/multi-delegate/multi-delegate/
cat /tmp/md-test/skills/multi-delegate/multi-delegate/SKILL.md | head -20
```

Expected: empty `SKILL.md` is NOT created (scaffolded config has no delegates). Add one model:

```
mkdir -p /tmp/md-test
cat > /tmp/md-test/multi-delegate.jsonc <<'EOF'
{ "delegate_models": [ { "model": "anthropic/claude-opus-4-7" } ] }
EOF
OPENCODE_CONFIG_DIR=/tmp/md-test node -e "import('./index.js').then(async (m) => { await m.MultiDelegatePlugin({client:null, directory:'.'}); })"
cat /tmp/md-test/skills/multi-delegate/multi-delegate/SKILL.md
```

Expected: file contains `subagent(agent="anthropic_claude-opus-4-7-delegate", prompt="<FULL user task text>")` in Step 1.

- [ ] **Step 4: Commit**

```
git add index.js
git commit -m "feat: render SKILL.md from delegate config at plugin init"
```

---

## Task 5: Drop the static SKILL.md from the package

**Files:**
- Delete: `skills/multi-delegate/multi-delegate/SKILL.md`
- Delete: `skills/` (empty after step above)
- Modify: `package.json`

- [ ] **Step 1: Remove the static skill file and dir**

```
git rm skills/multi-delegate/multi-delegate/SKILL.md
rmdir skills/multi-delegate/multi-delegate skills/multi-delegate skills
```

- [ ] **Step 2: Update package.json**

Change `package.json`:

```json
{
  "name": "@alexmkx/opencode-multi-delegate",
  "version": "0.6.0",
  "description": "Multi-delegate plugin for OpenCode — dispatches tasks to multiple AI models in parallel and produces consolidated reports",
  "type": "module",
  "main": "./index.js",
  "license": "MIT",
  "author": "alexmkx",
  "keywords": [
    "opencode",
    "plugin",
    "multi-delegate",
    "multi-model",
    "code-review",
    "parallel-agents"
  ],
  "files": [
    "index.js",
    "lib"
  ],
  "scripts": {
    "test": "node --test test/"
  }
}
```

- [ ] **Step 3: Run the full test suite**

```
npm test
```

Expected: 6 passing.

- [ ] **Step 4: Commit**

```
git add package.json
git commit -m "chore: drop static SKILL.md, bump to 0.6.0, add npm test"
```

---

## Task 6: Cleanup stale symlink in real configDir

**Files:** none — verification only.

- [ ] **Step 1: Inspect existing user config dir**

```
ls -la ~/.config/opencode/skills/multi-delegate/
readlink ~/.config/opencode/skills/multi-delegate/multi-delegate 2>/dev/null && echo "STILL SYMLINK"
```

If a symlink from the old plugin version still exists, the next plugin run will remove it via `writeSkillFile` (Task 4 — `fs.rmSync(dir, {recursive:true,force:true})` handles symlinks correctly).

- [ ] **Step 2: Trigger a real plugin load against real config**

```
OPENCODE_CONFIG_DIR=$HOME/.config/opencode node -e "import('./index.js').then(async (m) => { await m.MultiDelegatePlugin({client:null, directory:'.'}); })"
ls -la ~/.config/opencode/skills/multi-delegate/multi-delegate/
head -10 ~/.config/opencode/skills/multi-delegate/multi-delegate/SKILL.md
```

Expected: no symlink, regular file, frontmatter present, agent names match `~/.config/opencode/multi-delegate.jsonc`.

- [ ] **Step 3: Commit (if any doc tweaks)**

If everything's clean, no commit needed for this task.

---

## Self-Review Notes

- **Spec coverage:**
  - "Pure render function" → Tasks 1-3.
  - "Write to configDir, no symlink" → Task 4 (`writeSkillFile`).
  - "Empty config → no file" → Task 4 + Task 1 throws + Task 4 early-return guard.
  - "Symlink migration" → Task 4 `fs.rmSync(dir, {recursive,force})` removes symlink-or-dir; verified in Task 6.
  - "Drop static SKILL.md" → Task 5.
  - "`node:test` unit tests" → Tasks 1-3.
- **Placeholders:** none — all code blocks are complete.
- **Type consistency:** `delegates` is consistently `Array<{ agentName, model, variant? }>` across the plan.
