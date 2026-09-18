# Implementation Handoff

## Current state

Milestone 0 has a working offline starter. From a clean checkout, `npm ci`,
`npm test`, `npm run build`, and `npm run check:examples` all pass (Node 24,
verified 2026-09-18).

Implemented:

- Fixture format v1 with Zod validation and readable load errors.
- Saved-response adapter for `generic-v1`, `openai-chat-v1`, and `unavailable`.
- Checks: `tool-name`, `tool-arguments` (Ajv, JSON Schema 2020-12),
  `structured-output`. Each returns `pass`, `fail`, or `not-tested` with a
  stable `reasonCode`.
- Runner, JSON report (`reportVersion: 1`), text report, and CLI with exit codes.
- Five synthetic example fixtures and 23 unit/integration tests.
- GitHub Actions CI on Node 22 and 24.

Not implemented: workflow-precondition checks, project-level config file
(`ProjectConfigSchema` exists but the CLI reads fixtures only), redaction, live
adapters, multi-fixture summaries beyond totals, and npm publishing.

## Decisions taken (2026-09-18)

| Open question in earlier planning | Decision |
| --- | --- |
| Workspace tooling | Single package, npm, ESM `NodeNext`. Split later only if needed. |
| Serialization | JSON for fixtures and reports; versioned via `version` / `reportVersion`. |
| Tool-argument comparison | Schema validation of the candidate's arguments only. Baseline-vs-candidate semantic equality is not asserted. |
| JSON Schema validator | Ajv 8, draft 2020-12, `strict: false`. |
| Redaction | Deferred to Milestone 1. Fixtures must already be synthetic. |

## Next agent instructions

1. Add a `workflow-precondition` check and the missing example scenario.
2. Let the CLI accept a project config that lists fixtures, so users run one
   command per project instead of globbing.
3. Add tested redaction for configured sensitive fields before any raw response
   is written to a report.
4. Compare setup and diagnostic value against Promptfoo on the same five
   scenarios and record the result honestly in `docs/RESEARCH.md`.
5. Do not add live provider adapters until Milestone 1 acceptance criteria are
   met and the data-handling statement is written.
6. Run the complete test suite and build before handing off. Report exact
   commands and outcomes.
