# Inseat Switch

Inseat Switch is a planned model-migration compatibility checker for developers
who need to compare a baseline model with a candidate model on their own workflow.

> Status: planning phase. This repository is not usable yet. It has no CLI,
> package, runtime implementation, or live evaluation service.

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

No commands are documented because no executable software exists yet. See
[ROADMAP.md](ROADMAP.md) for acceptance criteria and
[docs/PRODUCT_PLAN.md](docs/PRODUCT_PLAN.md) for the proposed product boundary.

## Planned architecture

The eventual implementation is planned as one TypeScript repository with focused
packages for config schema, fixtures, adapters, checks, runner, and report
generation. See [ARCHITECTURE.md](ARCHITECTURE.md).

## Project documents

- [ARCHITECTURE.md](ARCHITECTURE.md): planned components and data flow
- [ROADMAP.md](ROADMAP.md): milestones and acceptance criteria
- [docs/PRODUCT_PLAN.md](docs/PRODUCT_PLAN.md): users, jobs, risks, and boundaries
- [docs/RESEARCH.md](docs/RESEARCH.md): source-backed context and hypotheses
- [examples/README.md](examples/README.md): planned fixture examples
- [CONTRIBUTING.md](CONTRIBUTING.md): documentation contributions during planning
- [SECURITY.md](SECURITY.md): private vulnerability reporting

## License and independence

Public open source distribution is planned under the Apache License 2.0; see
[LICENSE](LICENSE). Inseat Switch is not affiliated with or endorsed by any model
provider or other vendor referenced in this repository.