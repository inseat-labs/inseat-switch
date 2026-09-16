# Implementation Handoff

## Current state

The repository is a documentation-only foundation. There is no CLI, package,
runtime, live adapter, or working evaluation. Do not describe it as usable.

## Next agent instructions

1. Verify every source in [RESEARCH.md](RESEARCH.md) is current. Record changed or
   unsupported claims before making implementation decisions.
2. Reconfirm the product boundary in [PRODUCT_PLAN.md](PRODUCT_PLAN.md) and the
   result semantics in [ARCHITECTURE.md](../ARCHITECTURE.md).
3. Implement only Milestone 0 from [ROADMAP.md](../ROADMAP.md). Do not add live
   provider adapters, hosted services, routing, orchestration, or general benchmark
   features.
4. Start with the smallest testable contracts for config, fixtures, normalized
   saved responses, checks, runner, and reports. Keep execution offline.
5. Use synthetic fixtures and ensure missing evidence produces `not-tested`, never
   an implicit pass.
6. Run the complete test suite and repository build before handing off. Report the
   exact commands and outcomes, and fix errors introduced by the implementation.

## Decisions still open

- Exact TypeScript workspace and package tooling
- Config and report serialization formats
- Strict versus semantic tool-argument comparison
- JSON Schema validator and supported draft
- Redaction defaults and raw-response retention

Choose these only with tests, documented tradeoffs, and consistency with the
offline-first boundary.