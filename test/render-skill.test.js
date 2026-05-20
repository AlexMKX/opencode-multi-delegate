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

test('renderSkill lists a single delegate with one subagent line', () => {
  const out = renderSkill([
    { agentName: 'anthropic_claude-opus-4-7-delegate', model: 'anthropic/claude-opus-4-7' },
  ]);
  const matches = out.match(/^subagent\(agent="[^"]+",/gm) || [];
  assert.equal(matches.length, 1);
  assert.match(
    out,
    /subagent\(agent="anthropic_claude-opus-4-7-delegate", prompt="<FULL user task text>"\)/,
  );
});

test('renderSkill lists multiple delegates in input order', () => {
  const out = renderSkill([
    { agentName: 'a-delegate', model: 'x/a' },
    { agentName: 'b-delegate', model: 'x/b' },
    { agentName: 'c-delegate', model: 'x/c' },
  ]);
  const lines = out.split('\n').filter((l) => l.startsWith('subagent('));
  assert.deepEqual(lines, [
    'subagent(agent="a-delegate", prompt="<FULL user task text>")',
    'subagent(agent="b-delegate", prompt="<FULL user task text>")',
    'subagent(agent="c-delegate", prompt="<FULL user task text>")',
  ]);
});

test('renderSkill output is stable for the same input', () => {
  const input = [{ agentName: 'foo-delegate', model: 'x/foo' }];
  assert.equal(renderSkill(input), renderSkill(input));
});
