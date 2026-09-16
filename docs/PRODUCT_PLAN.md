# Product Plan

## Status and premise

Inseat Switch is in planning. It has no usable CLI, package, or live evaluation.
The premise is that model migrations should be checked against the application's
own workflow contracts, not inferred from broad benchmark scores.

## Personas

- Application developer: owns prompts, tools, schemas, and release behavior.
- Platform engineer: supports several model-backed services and migration policy.
- Engineering lead: needs concise evidence and unresolved risk before approving a
  model change.

## Jobs to be done

- When a model is deprecated, repriced, or replaced, compare a candidate against
  the current model on representative workflow cases.
- When tool calling changes, identify incompatible names, arguments, schemas, or
  preconditions before production rollout.
- When evidence is incomplete, distinguish `not-tested` from success.
- Preserve a reviewable artifact that explains why a migration passed or failed.

## Proposed first workflow

A developer supplies synthetic or approved fixtures and saved baseline/candidate
responses. The checker normalizes those artifacts, runs deterministic checks, and
produces an inspectable report. Live calls come later and require explicit opt-in.

## Non-goals

- Ranking models for general intelligence or quality
- Routing production traffic between models
- Orchestrating agents or executing arbitrary workflows
- Replacing domain-specific human review
- Guaranteeing equivalent behavior outside supplied fixtures and checks
- Reproducing Inseat Fusion

## Validation plan

Interview 8 to 12 developers who have completed or expect a model migration. Ask
for the last migration trigger, artifacts compared, regressions missed, review
participants, data restrictions, and time spent. Avoid pitching until their current
process is understood.

For a manual workflow study, work with 3 to 5 participants to:

1. Select one real but sanitized workflow and 10 to 30 representative cases.
2. Capture baseline and candidate responses outside Inseat Switch.
3. Manually apply the proposed checks and result semantics.
4. Measure setup time, disputed results, missing checks, and whether the report
   would alter a release decision.

Evidence to proceed: repeated tool-contract failures, a report users can interpret
without assistance, and willingness to maintain fixtures. Evidence to reconsider:
fixtures are consistently unavailable, failures are mostly subjective, or existing
tools already solve the workflow with little friction.

## OSS and hosted boundary

The planned Apache-2.0 open source core includes config and fixture contracts,
offline adapters, deterministic checks, the runner, and local reports. A possible
hosted product could provide managed live runs, secure secret handling, report
history, access controls, and collaboration. Local artifact portability must not
depend on the hosted service.

## Risks

| Risk | Planned response |
| --- | --- |
| Fixtures do not represent production behavior | Document coverage and surface untested conditions. |
| Normalization hides meaningful provider differences | Preserve raw evidence and provider metadata. |
| Live evaluation leaks sensitive data | Stay offline first; require opt-in, redaction, and clear transmission boundaries. |
| A pass creates false confidence | Scope results to fixtures/checks and preserve `not-tested`. |
| Provider APIs change quickly | Version adapters and verify current provider documentation before implementation. |
| Competitors already cover the need | Validate the narrow migration workflow before expanding scope. |