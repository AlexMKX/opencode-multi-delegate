import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderSkill } from '../lib/render-skill.js';

test('renderSkill throws on empty delegate list', () => {
  assert.throws(() => renderSkill([]), /at least one delegate/i);
  assert.throws(() => renderSkill(), /at least one delegate/i);
});

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
