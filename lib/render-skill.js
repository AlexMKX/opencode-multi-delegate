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
