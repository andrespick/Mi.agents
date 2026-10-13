---
name: using-superpowers
description: Use when explicitly enabling the complete Superpowers development workflow or choosing which development skills a substantial task needs. Not required for greetings, explanations, inspections or small well-defined edits.
disable-model-invocation: true
metadata:
  opencode/autoinvoke: "false"
  opencode/slash: "true"
---

# Using Superpowers in Mi.agents

Choose the smallest workflow that satisfies the user's request. The presence of
a skill is not an instruction to load it. Read one only when the user asks for
it, the selected agent's explicit workflow requires it, or it materially helps
resolve the task. A simple answer or clear small change needs no ceremony.

- Explanations and read-only inspections: inspect the necessary evidence and answer.
- Small, well-defined changes: implement and verify proportionally. Do not create
  requirements, designs, plans, worktrees or subagents just because they exist.
- A concrete defect: use systematic-debugging if the cause is uncertain; add a
  regression test when the behavior and impact justify one.
- Substantial development: clarify missing intent only; then use
  requirements-engineering-m -> technical-specification-m ->
  specification-review-m -> writing-plans. A READY artifact is reused.
- brainstorming is optional before requirements when intent is genuinely open.
  It must not produce a second design after technical-specification-m.
- Security audits use security-audit-m and the cybersecurity role, independently
  of the development workflow.

Do not trigger a skill merely because there is a small chance it is related.
Do not spawn agents for a small task. Within an explicitly selected workflow,
follow its applicable steps without requesting the same authorization again.
User instructions and runtime permissions remain authoritative.

Use local skill names, without a plugin prefix. Platform references in
references/ are upstream guidance, not proof that an API or model exists in the
current runtime: verify against the available tools before using it.
