# Changelog

All notable changes to this project are documented here. The project follows
[Semantic Versioning](https://semver.org/); while the version is `0.x`, any
release may contain breaking changes.

## 0.1.0 - 2026-09-26

First tagged release of the Milestone 0 offline starter. Early-stage: fixture
and report formats may still change, and the package is not published to npm.

### Added

- `inseat-switch check <fixture.json>...` CLI with a text report, `--json`
  machine-readable report (`reportVersion: 1`), and `--allow-fail`. Exit codes:
  `0` no failing checks, `1` at least one check failed, `2` usage error or a
  fixture could not be loaded.
- Fixture format v1 with Zod validation and readable load errors.
- Saved-response adapter for `generic-v1`, `openai-chat-v1`, and `unavailable`
  formats.
- Deterministic checks, each returning `pass`, `fail`, or `not-tested` with a
  stable reason code:
  - `tool-name`
  - `tool-arguments` (JSON Schema 2020-12 via Ajv)
  - `structured-output`
  - `outcome-assertion` (exact match, JSON Schema, property paths, and saved
    allowlisted verifier results)
- Ten synthetic example fixtures, one invalid fixture, and 40 tests.
- GitHub Actions CI on Node.js 22 and 24.

### Limits

- Offline only: no network requests, provider calls, live model adapters, or
  command execution. Verifier results must already be saved in the fixture.
- Workflow-precondition checks, project config files, and redaction are not
  implemented yet. See `ROADMAP.md` and `docs/HANDOFF.md`.
