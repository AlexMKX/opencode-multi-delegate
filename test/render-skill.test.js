import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderSkill } from '../lib/render-skill.js';

test('renderSkill throws on empty delegate list', () => {
  assert.throws(() => renderSkill([]), /at least one delegate/i);
  assert.throws(() => renderSkill(), /at least one delegate/i);
});
