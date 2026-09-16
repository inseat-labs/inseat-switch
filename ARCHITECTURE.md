# Planned Architecture

This document describes a proposed architecture, not an implemented system.
Inseat Switch is currently documentation only.

## Repository shape

The eventual project is planned as one TypeScript repository containing six
packages with narrow responsibilities:

| Package | Planned responsibility |
| --- | --- |
| `config-schema` | Validate versioned project, model, tool, and check configuration. |
| `fixtures` | Load prompts, workflow state, tool definitions, and saved responses. |
| `adapters` | Normalize saved responses and, later, opt-in live provider responses. |
| `checks` | Evaluate tool choice, tool name, arguments, JSON Schema, and preconditions. |
| `runner` | Pair baseline and candidate cases and coordinate deterministic checks. |
| `report` | Emit machine-readable and human-readable `pass`, `fail`, and `not-tested` results. |

Package APIs and directories are intentionally not fixed until Milestone 0 tests
prove the smallest useful contracts.

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

## Boundaries

The checker evaluates artifacts supplied by the user. It does not select a model
for production traffic, execute an agent workflow, or claim general model quality.
Configuration, fixtures, normalized observations, and check results should remain
portable across local and future hosted execution.