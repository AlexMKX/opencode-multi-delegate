/**
 * Multi-Delegate plugin for OpenCode.
 *
 * Dynamically registers delegate agents from a list of models defined in
 * a standalone config file: {configDir}/multi-delegate.jsonc
 *
 * Config format:
 *
 * {
 *   "delegate_models": [
 *     { "model": "anthropic/claude-opus-4-6", "variant": "medium" },
 *     { "model": "openai/gpt-5.3-codex", "variant": "high" }
 *   ]
 * }
 *
 * Agent names are derived from model IDs: "anthropic/claude-opus-4-6"
 * becomes "@anthropic_claude-opus-4-6-delegate".
 *
 * Provider-level timeouts: provider.<name>.timeout (ms), default 300000.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CONFIG_FILENAME = 'multi-delegate.jsonc';

const CONFIG_TEMPLATE = `{
  "delegate_models": [
    // Add your models here
    // { "model": "provider/model-id", "variant": "low|medium|high|max" }
    // { "model": "anthropic/claude-opus-4-6", "variant": "medium" }
  ]
}
`;

const DELEGATE_PROMPT = `You are an analyst delegate. You receive a task from the orchestrator and execute it thoroughly.

## Rules

- Be thorough and specific — file paths, line numbers, concrete evidence.
- Do NOT hallucinate. If you're unsure, say so explicitly.
- Stay strictly on topic. Do not add unrelated observations.

## Output Format

Return your results as a structured list of findings:

### Findings

1. **[Short finding title]**
   - Description: [What exactly was found, where, why it matters]
   - Severity: critical | important | minor | info
   - Details: [Specifics — files, lines, code snippets, argumentation]
   - Recommendation: [What to do about it]

2. **[Next finding]**
   ...

### Summary
[1-2 sentences — overall verdict on the task]`;

// "anthropic/claude-opus-4-6" -> "anthropic_claude-opus-4-6-delegate"
const toAgentName = (modelId) =>
  modelId.replace(/[^a-zA-Z0-9-]/g, '_') + '-delegate';

// Strip single-line (//) and block (/* */) comments for JSONC parsing
const stripJsonComments = (str) =>
  str
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

const getConfigDir = () =>
  process.env.OPENCODE_CONFIG_DIR || path.join(os.homedir(), '.config', 'opencode');

// Scaffold config if missing, read and parse if present
const loadConfig = (configDir) => {
  const configPath = path.join(configDir, CONFIG_FILENAME);

  try {
    if (!fs.existsSync(configPath)) {
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(configPath, CONFIG_TEMPLATE, 'utf8');
      return { delegate_models: [] };
    }

    const raw = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(stripJsonComments(raw));
  } catch (e) {
    // If config is broken, don't crash the whole plugin
    return { delegate_models: [] };
  }
};

// Ensure skill symlink exists in {configDir}/skills/
const ensureSkillLink = (configDir) => {
  const skillsDir = path.join(configDir, 'skills');
  const target = path.join(skillsDir, 'multi-delegate');
  const source = path.join(__dirname, 'skills', 'multi-delegate');

  try {
    fs.mkdirSync(skillsDir, { recursive: true });

    // Check if symlink already points to the right place
    try {
      const existing = fs.readlinkSync(target);
      if (existing === source) return;
      fs.rmSync(target, { recursive: true });
    } catch (e) {
      // Does not exist or not a symlink — fine
    }

    fs.symlinkSync(source, target);
  } catch (e) {
    // Non-fatal — skill just won't appear in `opencode debug skill`
  }
};

export const MultiDelegatePlugin = async ({ client, directory }) => {
  const configDir = getConfigDir();
  ensureSkillLink(configDir);
  const pluginConfig = loadConfig(configDir);

  return {
    config: async (config) => {
      const delegates = pluginConfig.delegate_models || [];
      const agents = config.agent || {};

      for (const { model, variant } of delegates) {
        if (!model) continue;

        const agentName = toAgentName(model);
        const agentDefaults = {
          description: `Multi-delegate: analyst subagent on ${model} (variant: ${variant || 'default'}).`,
          model,
          ...(variant && { variant }),
          mode: 'subagent',
          prompt: DELEGATE_PROMPT,
          tools: { read: true, glob: true, grep: true, list: true, bash: true },
          permission: { bash: { '*': 'allow' } }
        };

        // User overrides in agent.<name> take priority
        agents[agentName] = {
          ...agentDefaults,
          ...(agents[agentName] || {})
        };
      }

      config.agent = agents;
    }
  };
};
