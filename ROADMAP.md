# Roadmap

All milestones are plans. No milestone is implemented today.

## Milestone 0: Offline compatibility core

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

Acceptance criteria:

- Multiple fixtures can be selected and evaluated locally.
- Reports summarize regressions without hiding per-case evidence.
- Configuration and report formats have documented versioning rules.
- Secret and sensitive-field redaction behavior is tested.

## Milestone 2: Opt-in live adapters

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

## Decision gates

Before expanding beyond Milestone 0, validate that developers can create useful
fixtures, understand failures, and use results in a real migration decision. Before
hosted work, validate willingness to send evaluation data to a third party and pay
for collaboration or managed execution.