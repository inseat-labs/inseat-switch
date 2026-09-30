# Roadmap

Milestone 0 (`check`) has a working starter implementation (see
docs/HANDOFF.md). The `compare` snapshot workflow (Unreleased) covers most of
Milestones 1 and 2. Everything else is a plan.

## Now: `compare` snapshot tests (Unreleased)

Implemented:

- `init` and `compare` with YAML/JSON config, `provider:model` ids, and prompt,
  messages, or imported JSONL cases.
- `claude-cli` (prompted tool mode), `anthropic`, and `openai`-compatible
  providers. Missing keys or a missing CLI exit `2` before any call.
- Repeat sampling with a majority/minority consistency rule, explicit `flaky`,
  and tool-behavior categories.
- Disk cache, JSON report, and a self-contained HTML report.

Open:

- Redaction of secrets and personal data in reports. For example, Claude Code
  injects the account email into the `claude-cli` context.
- Non-English clarification and refusal heuristics.
- Multi-step agent loops with user-supplied tool results.
- Cost and token reporting per model.
- More repeat-aware statistics than a majority rule (e.g. confidence at small N).

## Milestone 0: Offline compatibility core (`check`)

Status: mostly implemented. Workflow-precondition checks remain open.
Deterministic outcome assertions with explicit `not-tested` were added on
2026-09-19 (`outcome-assertion`).

Acceptance criteria:

- A versioned config contract represents a baseline, candidate, tools, workflow
  preconditions, fixtures, and enabled checks.
- Synthetic saved-response fixtures cover tool selection, tool name, arguments,
  JSON Schema compatibility, and workflow preconditions.
- Deterministic checks return structured `pass`, `fail`, or `not-tested` results
  with evidence and stable reason codes.
- A runner compares one baseline/candidate fixture pair without network access.
- A machine-readable report and a concise human-readable report are generated.
- Unit tests cover each result state and malformed fixture/config behavior.
- The TypeScript build and all tests pass from a clean checkout.

Milestone 0 excludes provider SDKs, network calls, a hosted service, and generalized
model scoring.

## Milestone 1: Local developer workflow

Status: mostly covered by `compare` (many cases, per-case evidence in reports).
Versioning rules and redaction remain open.

Acceptance criteria:

- Multiple fixtures can be selected and evaluated locally.
- Reports summarize regressions without hiding per-case evidence.
- Configuration and report formats have documented versioning rules.
- Secret and sensitive-field redaction behavior is tested.

## Milestone 2: Opt-in live adapters

Status: partly covered by `compare` providers. Provider failures become explicit
`error` samples, never passes, and cached responses support replay. Documenting
per-provider data transmission and cost is still open.

Acceptance criteria:

- Each adapter is explicitly enabled and documents transmitted data and expected
  costs.
- Provider-specific output remains inspectable alongside normalized output.
- Saved-response capture supports later offline replay.
- Timeouts, unsupported capabilities, and provider failures become `not-tested` or
  explicit execution errors, never false passes.

## Milestone 3: Team and hosted evaluation exploration

This milestone depends on user validation. Possible work includes shared reports,
history, access controls, and managed execution. It is not a commitment to build a
hosted product.

## Explicit non-goals

Generic scoring, prompt optimization, dataset management, model ranking, and
LLM-as-judge are out of scope for every milestone. See
`docs/ADR-001-JEV-ADVISORY-ONLY.md` for the boundary with probabilistic
decision providers.

## Decision gates

Before expanding beyond Milestone 0, validate that developers can create useful
fixtures, understand failures, and use results in a real migration decision. Before
hosted work, validate willingness to send evaluation data to a third party and pay
for collaboration or managed execution.