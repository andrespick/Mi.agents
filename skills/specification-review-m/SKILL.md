---
name: specification-review-m
description: Independently review an SDD requirements artifact and technical specification before implementation planning. Use after technical-specification-m and before Superpowers writing-plans to detect missing coverage, contradictions, ambiguity, untestable criteria, unsupported repository assumptions, scope creep, regression risk, and broken requirement-to-test traceability. Produces only a compact machine-readable verdict and never implements or redesigns unless a precise fix is required.
disable-model-invocation: true
metadata:
  opencode/autoinvoke: "false"
  opencode/slash: "true"
---

# Specification Review

Act as a gate, not an author. Try to prove the specification is unsafe or incomplete before implementation starts.

## Inputs

Read:
1. the `REQ` artifact;
2. the matching `SPEC` artifact;
3. repository evidence only when needed to verify claims in `CURRENT`, `IMPACT`, interfaces, compatibility, or existing tests.

Prefer a fresh reviewer/subagent when the harness supports it.

## Review checks

Check all of the following silently:

1. **Coverage** — every FR/NFR has technical coverage; every AC has a TESTMAP entry.
2. **Consistency** — REQ and SPEC do not contradict each other or themselves.
3. **Testability** — every AC is observable and deterministic enough to become a test.
4. **Traceability** — referenced IDs exist and links are correct.
5. **Evidence** — claims about existing code/files/interfaces are supported by the repository.
6. **Scope** — SPEC does not introduce behavior absent from REQ.
7. **Compatibility** — preserved behavior and external contracts are not accidentally broken.
8. **Failure behavior** — materially changed boundaries define relevant error paths.
9. **Risk** — flag concrete security, data-integrity, concurrency, migration, or regression risks only when the change actually touches them.
10. **Plan readiness** — a developer could create an implementation plan without guessing product behavior or major technical decisions.

Do not praise the spec. Do not summarize it. Do not output chain-of-thought. Do not create tasks or code.

## Severity

- `BLOCKER`: implementation would require guessing, could violate a requirement, or could cause a material correctness/compatibility risk.
- `WARN`: real issue worth fixing, but implementation can proceed without changing intended behavior or core design.

## Output contract

Save beside the spec as `<spec-name>.review.json`.

Output valid minified JSON with exactly these keys:

```json
{"status":"READY|BLOCKED","issues":[{"id":"R01","sev":"BLOCKER|WARN","type":"coverage|conflict|ambiguity|testability|traceability|evidence|scope|compatibility|failure|risk","refs":["FR-01","TS-01"],"issue":"<one sentence>","fix":"<one precise sentence>"}]}
```

Rules:
- `READY` only when there are zero `BLOCKER` issues.
- `issues` may contain warnings when status is `READY`.
- Omit no keys from an issue object.
- Keep `refs` to the smallest relevant set of IDs/paths.
- One issue per object; do not bundle unrelated findings.
- No Markdown, comments, score, prose, summary, or additional keys.
- Do not invent an issue merely to appear thorough.

## Gate and handoff

If `BLOCKED`, stop before `writing-plans`. The author must revise REQ/SPEC and run this review again.

If `READY`, the reviewed SPEC becomes the binding design input to Superpowers `writing-plans`, followed by its normal TDD execution/review workflow.

After writing the review file, respond in chat with exactly one line:

`REVIEW READY <path>`

or:

`REVIEW BLOCKED <path> <comma-separated BLOCKER ids>`

Do not echo the JSON unless the user asks.
