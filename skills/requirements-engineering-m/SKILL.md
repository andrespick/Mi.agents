---
name: requirements-engineering-m
description: Convert raw client requests, feature ideas, tickets, bug reports, or incident descriptions into a compact, implementation-neutral requirements specification. Use before technical design or planning whenever requirements are informal, incomplete, emotional, ambiguous, scattered, or mixed with proposed solutions. Produces traceable functional requirements, only relevant non-functional requirements, acceptance criteria, edge cases, and blocking questions without inventing technology, architecture, business rules, or root causes.
disable-model-invocation: true
metadata:
  opencode/autoinvoke: "false"
  opencode/slash: "true"
---

# Requirements Engineering

Turn raw intent into the smallest complete behavioral contract needed for design and testing.

## Input

Use the user's request plus any explicitly supplied business context. For an existing project, read only the repository evidence needed to understand current observable behavior; do not design the solution in this skill.

## Rules

1. Separate **what must happen** from **how it will be implemented**.
2. Preserve explicit needs. Infer only behavior that is logically required for the explicit request to work.
3. Mark every requirement source as `[E]` explicit or `[I]` necessary inference.
4. Never invent technologies, architecture, persistence, UI, permissions, limits, SLAs, or business rules.
5. Never state a root cause unless evidence confirms it. Put uncertain causes in `OPEN` as diagnostic questions.
6. Add an NFR only when the request or known project constraint makes it relevant and testable. Do not add generic security/performance boilerplate.
7. Write acceptance criteria as observable GIVEN/WHEN/THEN behavior. One criterion may reference multiple requirements.
8. Ignore emotional language except when it conveys a real deadline, impact, environment, reproduction condition, or business constraint.
9. Do not create implementation tasks, architecture, code, test code, estimates, priorities, or solution alternatives here.
10. Reason privately. Never output scratch work, chain-of-thought, explanations of your reasoning, or duplicate summaries.

## Workflow

1. Extract goal, current behavior, desired behavior, constraints, actors, and evidence.
2. Identify explicit requirements.
3. Add only necessary inferred requirements.
4. Convert each requirement into one atomic, testable statement using MUST/MUST NOT.
5. Derive acceptance criteria and material edge cases.
6. Record unresolved ambiguity. Mark it `BLOCKING` only if different answers would materially change expected behavior.
7. Set `status: READY` when no blocking question remains; otherwise `status: NEEDS_INPUT`.

## Output contract

Save to `docs/requirements/YYYY-MM-DD-<slug>.md` unless the user specifies another path.

Use exactly this structure. Omit optional sections only when they have no entries. Do not add other sections.

```markdown
# REQ: <title>
status: READY|NEEDS_INPUT

## GOAL
<one sentence>

## SCOPE
IN: <semicolon-separated behaviors>
OUT: <semicolon-separated exclusions or ->

## FR
- FR-01 [E|I] <actor/system> MUST <observable behavior>.

## NFR
- NFR-01 [E|I] <measurable or verifiable constraint>.

## AC
- AC-01 [FR-01] GIVEN <state> WHEN <event> THEN <observable result>.

## EDGE
- EC-01 [FR-01] <boundary/error behavior that must be defined>.

## OPEN
- Q-01 [BLOCKING|NONBLOCKING] <single precise unresolved question>.
```

### Compactness constraints

- `GOAL`: exactly one sentence.
- Each FR/NFR/AC/EC/Q: one line unless impossible.
- Do not restate the same requirement in multiple sections; AC verifies FR instead of paraphrasing it.
- Prefer references (`FR-03`) over repeated prose.
- Do not include rationale unless needed to remove ambiguity.
- Target the minimum number of requirements that completely describe requested behavior.

## Gate

`READY` requires:
- every requested behavior represented by at least one FR;
- every FR covered by at least one AC;
- no contradictory requirements;
- no blocking ambiguity;
- no implementation details masquerading as requirements unless the user explicitly mandated them.

When `NEEDS_INPUT`, ask only the first blocking question and stop. Do not speculate around it.

## Handoff

After writing the file, respond in chat with exactly one line:

`REQ READY <path>`

or:

`REQ NEEDS_INPUT <path> <Q-id>`

Do not echo the artifact unless the user asks.
