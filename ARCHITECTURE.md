# Architecture

Switch is a single TypeScript package with two commands:

- `compare`, the main workflow: live snapshot comparison of a baseline and a
  candidate model.
- `check`, the original Milestone 0 offline checker for saved-response
  fixtures. It is kept as an advanced feature.

## `compare`

| Module | Responsibility |
| --- | --- |
| `src/compare/config.ts` | YAML/JSON config schema (Zod, strict keys), case expansion, `import:` resolution relative to the config file. |
| `src/compare/import.ts` | OpenAI chat-completions JSONL parsing and message/tool normalization. |
| `src/providers/` | `claude-cli` (spawned without a shell in a temp dir, prompted JSON tool mode), `anthropic`, and `openai` (fetch). Each provider has `preflight()` for missing keys or CLI. |
| `src/compare/cache.ts` | SHA-256 keyed disk cache (`.switch-cache/`) over provider id, model, system, messages, tools, sample index, and the provider prompt version. |
| `src/compare/run.ts` | Runs `repeat` samples per model per case with bounded concurrency. Provider errors become per-sample `error` samples. Recorded samples are appended to the baseline. |
| `src/compare/behavior.ts` | Normalizes each sample: tool calls, text, clarification and refusal heuristics, and Ajv argument validation. |
| `src/compare/diff.ts` | Pure diff engine. It counts behavior features per model and applies the majority rule, then classifies findings and flaky notes. |
| `src/report/compare-*.ts` | Terminal summary, JSON report, and a self-contained HTML report (inline CSS, CSP `default-src 'none'`, all values escaped). |
| `src/cli/main.ts` | `init`, `compare`, `check`. |

```text
switch.yaml ──> config + imports ──> cases
                                        │
              ┌── baseline provider ────┤ repeat × (cache | live call)
              └── candidate provider ───┘
                                        │
                              behavior per sample
                                        │
                   diff: consistent findings | flaky | same
                                        │
                        text summary, JSON, HTML, exit code
```

### Consistency rule

For each feature (calls tool X, passes argument X.k, asks, refuses, has invalid
args, is unparseable), Switch counts the samples that have it on each side. A
finding requires a strict majority (more than half) on one side and a strict
minority (fewer than half) on the other. Exactly half is undecided. Any other
difference is flaky. A value is compared only when it is identifier-like (no
whitespace) and the same value is used in a majority of baseline samples.

## `check` (advanced)

The Milestone 0 modules. They map to the original planned responsibilities.

### Repository shape

| Module | Responsibility | Status |
| --- | --- | --- |
| `src/config` | Zod schemas for model refs, tool definitions, expectations, and project config. | implemented |
| `src/fixtures` | Fixture schema (v1) and loader with precise validation errors. | implemented |
| `src/adapters` | Normalize saved responses (`generic-v1`, `openai-chat-v1`, `unavailable`). Live calls live in `src/providers` and are used only by `compare`. | saved only |
| `src/checks` | `tool-name`, `tool-arguments` (JSON Schema via Ajv 2020-12), `structured-output`, `outcome-assertion` (exact, schema, property-path, saved allowlisted verifier results). Workflow-precondition checks are not implemented. | partial |
| `src/runner` | Runs enabled checks for one fixture and summarizes results. | implemented |
| `src/report` | JSON report (`reportVersion: 1`) and text renderer. | implemented |
| `src/cli` | `switch check <fixture>...` with `--json` and `--allow-fail` (plus `init` and `compare`, above). | implemented |

Toolchain: Node.js 22+, TypeScript 5 (`NodeNext` ESM), Zod 4, Ajv 8, `yaml`, Vitest.

### Data flow

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

### Offline first (`check`)

`check` accepts committed or locally supplied saved responses. It does not
require network access, provider credentials, or paid API calls.

`compare` is the opt-in live layer. It calls providers only when you run it,
shows the provider and model ids, records each sample's source (`live`,
`cache`, `recorded`) and tool mode (`native`, `prompted`, `recorded`, `none`),
and keeps raw unparseable replies in the report.

### Result semantics

- `pass`: available evidence satisfies the configured compatibility rule.
- `fail`: available evidence violates the configured compatibility rule.
- `not-tested`: required evidence or evaluator support is unavailable.

`not-tested` must never be silently converted to `pass`. Reports should retain the
observed values and a stable reason code so users can inspect each decision.

### Outcome evidence

`outcome-assertion` reads `outcomeEvidence.candidate.record` (or the candidate
text when `source: "candidate-text"`) and `outcomeEvidence.candidate.verifiers`.
Both are fixture data the user saved after running their own workflow. The
checker does not execute verifiers, call services, or infer outcomes from the
model's wording. Verifier kinds are allowlisted in `ALLOWED_VERIFIER_KINDS` so an
unknown kind is `not-tested` rather than trusted.

## Boundaries

Switch evaluates the user's own cases and artifacts. It does not select a model
for production traffic, execute tools or agent loops, or claim general model quality.
Configuration, fixtures, normalized observations, and check results should remain
portable across local and future hosted execution.