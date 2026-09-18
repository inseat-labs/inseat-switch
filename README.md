# Inseat Switch

Inseat Switch is a planned model-migration compatibility checker for developers
who need to compare a baseline model with a candidate model on their own workflow.

> Status: early development (Milestone 0 starter). An offline CLI exists that
> compares saved baseline/candidate responses against synthetic fixtures. There
> are no live model adapters, no hosted service, and no published npm package yet.

The goal is to make model changes reviewable before rollout. A future evaluation
will replay representative workflow fixtures against saved responses first, and
later against explicitly enabled live model adapters. Reports are planned to show
`pass`, `fail`, or `not-tested` for checks such as:

- tool selection and tool name
- tool arguments and JSON Schema compatibility
- workflow preconditions

Inseat Switch is not a general model benchmark, model router, or agent
orchestrator. It is also distinct from Inseat Fusion.

## Intended audience

The project is intended for application and platform developers who own an
LLM-backed workflow and need evidence about whether a model migration preserves
that workflow's contract.

## Planned workflow

1. Describe a baseline model, candidate model, tools, and workflow preconditions.
2. Add representative fixtures without secrets or production customer data.
3. Compare saved baseline and candidate responses offline.
4. Review check-level results and unresolved `not-tested` cases.
5. Optionally enable live adapters after costs, credentials, and data handling are
   understood.

## Quick start (offline)

Requires Node.js 22 or newer.

```bash
git clone https://github.com/inseat-labs/inseat-switch.git
cd inseat-switch
npm ci
npm test
npm run check:examples
```

`check:examples` runs the CLI against the synthetic fixtures in
`examples/fixtures/` and prints `PASS`, `FAIL`, or `SKIP` (not-tested) per check.
Add `-- --json` for the machine-readable report. The process exits `1` when any
check fails, which makes it usable as a CI gate.

Everything runs offline. No provider credentials, network calls, or paid API usage
are involved. See [ROADMAP.md](ROADMAP.md) for acceptance criteria and
[docs/PRODUCT_PLAN.md](docs/PRODUCT_PLAN.md) for the product boundary.

## Fixture format (v1)

A fixture is one JSON file describing one workflow case:

| Field | Purpose |
| --- | --- |
| `baseline`, `candidate` | Provider and model identifiers for labeling. |
| `messages` | The conversation the models were given. |
| `tools` | Tool definitions with JSON Schema `parameters`. |
| `expectations.requiredTool` | The tool the workflow requires. Falls back to the baseline's first tool call. |
| `expectations.outputSchema` | JSON Schema the candidate's text output must satisfy. |
| `checks` | Any of `tool-name`, `tool-arguments`, `structured-output`. |
| `responses.baseline`, `responses.candidate` | Saved responses in `generic-v1`, `openai-chat-v1`, or `unavailable` format. |

Missing evidence produces `not-tested`, never an implicit `pass`. See
[examples/README.md](examples/README.md) for the scenario table.

## Planned architecture

The implementation is one TypeScript package with focused modules under `src/`
for config schema, fixtures, adapters, checks, runner, report generation, and the
CLI. See [ARCHITECTURE.md](ARCHITECTURE.md).

## Project documents

- [ARCHITECTURE.md](ARCHITECTURE.md): planned components and data flow
- [ROADMAP.md](ROADMAP.md): milestones and acceptance criteria
- [docs/PRODUCT_PLAN.md](docs/PRODUCT_PLAN.md): users, jobs, risks, and boundaries
- [docs/RESEARCH.md](docs/RESEARCH.md): source-backed context and hypotheses
- [examples/README.md](examples/README.md): synthetic fixture examples
- [docs/HANDOFF.md](docs/HANDOFF.md): implementation state and next steps
- [CONTRIBUTING.md](CONTRIBUTING.md): how to contribute
- [SECURITY.md](SECURITY.md): private vulnerability reporting

## License and independence

Public open source distribution is planned under the Apache License 2.0; see
[LICENSE](LICENSE). Inseat Switch is not affiliated with or endorsed by any model
provider or other vendor referenced in this repository.