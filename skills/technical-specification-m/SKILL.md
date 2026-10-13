---
name: technical-specification-m
description: Transform an approved requirements artifact into a compact, repository-grounded technical design before implementation planning. Use when requirements are READY and the change needs technical decisions, especially in existing codebases. Inspect the real project first, map requirement IDs to concrete components, interfaces, data, errors, and test levels, and produce a Superpowers-compatible design spec without implementation tasks or speculative architecture.
disable-model-invocation: true
metadata:
  opencode/autoinvoke: "false"
  opencode/slash: "true"
---

# Technical Specification

Create the technical source of truth that bridges approved behavior to Superpowers planning and TDD.

## Preconditions

Require a requirements artifact with `status: READY`. If none exists, invoke/use `requirements-engineering-m` first instead of inventing requirements.

For an existing codebase, inspect relevant source, tests, configuration, schemas, and recent project conventions before deciding the design. Prefer existing patterns over new abstractions.

## Rules

1. Requirements are authoritative for behavior. Do not silently change, add, or delete product behavior.
2. Ground technical claims in repository evidence when the repository exists. Use exact file/component/interface names where known.
3. Design the smallest change that satisfies the requirements. Apply YAGNI and preserve unaffected behavior.
4. Reuse existing components and interfaces when they fit; introduce new ones only when required by the spec.
5. Do not repeat full requirement text. Reference `FR-*`, `NFR-*`, and `AC-*` IDs.
6. Do not write implementation tasks; Superpowers `writing-plans` owns task decomposition.
7. Do not write production code. Include signatures, schemas, payloads, queries, state transitions, or pseudocode only when they are part of the technical contract.
8. Separate confirmed current-state facts from proposed changes. Never present an unverified cause as fact.
9. Define failure behavior for every changed boundary where failure handling matters.
10. Map each AC to an appropriate test level; do not author the tests here.
11. Reason privately. Never output chain-of-thought, exploratory prose, or discarded alternatives unless a trade-off materially affects the final design.

## Workflow

1. Read the approved requirements.
2. Explore only the repository areas relevant to those IDs.
3. Identify current flow and affected boundaries.
4. Choose the minimal compatible design.
5. Define component changes, interfaces/data/state transitions, error behavior, and test map.
6. Check every requirement is technically covered.
7. Record unresolved technical questions. `BLOCKING` means the implementation plan would materially differ depending on the answer.
8. Set `status: READY_FOR_REVIEW` only when no blocking technical question remains.

## Output contract

Save to `docs/superpowers/specs/YYYY-MM-DD-<slug>-design.md` unless the user specifies another path. This path intentionally matches Superpowers' design-spec convention.

Use exactly this structure. Omit optional sections only when empty. Do not add other sections.

```markdown
# SPEC: <title>
status: READY_FOR_REVIEW|NEEDS_INPUT
requirements: <path>

## CURRENT
- C-01 <confirmed current behavior/architecture fact; include exact path or component when known>.

## IMPACT
- MODIFY `<path|component>` — <one-line responsibility/change> [FR-01].
- CREATE `<path|component>` — <one-line responsibility> [FR-02].
- PRESERVE <behavior/interface that must not regress> [FR-03].

## DESIGN
- TS-01 [FR-01,AC-01] <specific technical behavior or flow>.

## DATA
- D-01 [FR-02] <entity/field/state/schema change or NONE>.

## INTERFACES
- I-01 [FR-03] `<interface>`: IN <contract>; OUT <contract>; ERR <contract>.

## ERRORS
- ER-01 [AC-02] WHEN <failure> THEN <system behavior>.

## TESTMAP
- AC-01 -> UNIT|INTEGRATION|E2E `<target>`: <what must be proven>.

## DECISIONS
- ADR-01 <decision> — <reason in one sentence>.

## OPEN
- Q-01 [BLOCKING|NONBLOCKING] <single precise technical question>.
```

### Compactness constraints

- Do not duplicate FR/AC wording; reference IDs.
- One technical decision per line.
- `CURRENT` contains only facts needed to understand the change.
- `DECISIONS` contains only choices where another plausible design existed and the choice affects maintenance, compatibility, risk, or cost.
- Omit `DATA`, `INTERFACES`, `ERRORS`, or `DECISIONS` when not applicable.
- Avoid architecture essays and generic best-practice commentary.

## Gate

`READY_FOR_REVIEW` requires:
- every FR/NFR has a technical implementation path or is explicitly preserved by existing behavior;
- every AC appears in `TESTMAP`;
- changed boundaries have defined inputs/outputs/errors where relevant;
- all file/component references that claim existing behavior were verified;
- no blocking technical question remains;
- design does not introduce unrequested product behavior.

When `NEEDS_INPUT`, ask only the first blocking question and stop.

## Superpowers handoff

This artifact is the design/spec consumed by `writing-plans`. Do not generate a second design document.

If Superpowers is installed and an approved, reviewed spec already exists, treat the design/spec stage as satisfied and proceed to `writing-plans`; do not rediscover requirements or regenerate the same design.

After writing the file, respond in chat with exactly one line:

`SPEC READY_FOR_REVIEW <path>`

or:

`SPEC NEEDS_INPUT <path> <Q-id>`

Do not echo the artifact unless the user asks.
