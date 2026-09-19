# Architecture

Milestone 0 is implemented as a single TypeScript package. Modules under `src/`
map to the planned responsibilities; they can be split into workspace packages
later if the boundaries prove stable.

## Repository shape

| Module | Responsibility | Status |
| --- | --- | --- |
| `src/config` | Zod schemas for model refs, tool definitions, expectations, and project config. | implemented |
| `src/fixtures` | Fixture schema (v1) and loader with precise validation errors. | implemented |
| `src/adapters` | Normalize saved responses (`generic-v1`, `openai-chat-v1`, `unavailable`). Live adapters are later and opt-in. | saved only |
| `src/checks` | `tool-name`, `tool-arguments` (JSON Schema via Ajv 2020-12), `structured-output`, `outcome-assertion` (exact, schema, property-path, saved allowlisted verifier results). Workflow-precondition checks are not implemented. | partial |
| `src/runner` | Runs enabled checks for one fixture and summarizes results. | implemented |
| `src/report` | JSON report (`reportVersion: 1`) and text renderer. | implemented |
| `src/cli` | `inseat-switch check <fixture>...` with `--json` and `--allow-fail`. | implemented |

Toolchain: Node.js 22+, TypeScript 5 (`NodeNext` ESM), Zod 4, Ajv 8, Vitest.

## Data flow

```text
versioned config + workflow fixture
                 |
                 v
       saved-response adapter
                 |
                 v
       normalized baseline/candidate
                 |
                 v
      deterministic compatibility checks
                 |
                 v
       structured result -> report
```

## Offline first

Milestone 0 should accept committed or locally supplied saved responses. It should
not require network access, provider credentials, or paid API calls. This keeps
fixtures reproducible and allows the report contract to stabilize before provider
behavior is introduced.

Live adapters are a later, opt-in layer. They must expose provider, model, and
request metadata; make cost and data transmission explicit; and normalize output
without hiding provider-specific evidence.

## Result semantics

- `pass`: available evidence satisfies the configured compatibility rule.
- `fail`: available evidence violates the configured compatibility rule.
- `not-tested`: required evidence or evaluator support is unavailable.

`not-tested` must never be silently converted to `pass`. Reports should retain the
observed values and a stable reason code so users can inspect each decision.

## Outcome evidence

`outcome-assertion` reads `outcomeEvidence.candidate.record` (or the candidate
text when `source: "candidate-text"`) and `outcomeEvidence.candidate.verifiers`.
Both are fixture data the user saved after running their own workflow. The
checker does not execute verifiers, call services, or infer outcomes from the
model's wording. Verifier kinds are allowlisted in `ALLOWED_VERIFIER_KINDS` so an
unknown kind is `not-tested` rather than trusted.

## Boundaries

The checker evaluates artifacts supplied by the user. It does not select a model
for production traffic, execute an agent workflow, or claim general model quality.
Configuration, fixtures, normalized observations, and check results should remain
portable across local and future hosted execution.