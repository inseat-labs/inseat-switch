# Examples

All fixtures in `fixtures/` are synthetic. They are not benchmarks, live model
outputs, or evidence about any real provider. Run them with:

```bash
npm run check:examples
```

Each file's `description` states its expected overall result, and
`tests/examples.test.ts` asserts it.

| File | Scenario | Candidate behavior | Result |
| --- | --- | --- | --- |
| `01-same-tool-valid-arguments.json` | Same required tool, valid arguments | Calls `lookup_order` with schema-valid arguments | `pass` |
| `02-wrong-tool-selected.json` | Wrong tool selected | Calls `cancel_order` instead of `lookup_order` | `fail` |
| `03-missing-required-argument.json` | Invalid arguments (OpenAI chat shape) | Omits the required `orderId` | `fail` |
| `04-candidate-evidence-unavailable.json` | Missing candidate tool evidence | Saved response lacks tool-call data | `not-tested` |
| `05-structured-output-type-change.json` | Structured output type change | Returns `total` as a string, schema requires number | `fail` |
| `06-tool-passes-outcome-fails.json` | Right tool, wrong business outcome | Saved order record still `shipped`, refund amount 0 | `fail` |
| `07-outcome-passes.json` | Outcome satisfied | Record matches schema and paths; saved verifier passed | `pass` |
| `08-outcome-evidence-missing.json` | No outcome record saved | Assertion configured, evidence absent | `not-tested` |
| `09-outcome-path-missing.json` | Asserted path absent | Record exists, `order.refund.transactionId` missing | `not-tested` |
| `10-verifier-unavailable.json` | Verifier could not run | Saved verifier status `unavailable` | `not-tested` |

`invalid/11-malformed-outcome-assertion.json` must fail fixture validation and
exits the CLI with code 2. See `invalid/README.md`.

A workflow-precondition scenario (required state cannot be established) is still
planned and has no check implementation yet.

Fixtures contain the prompt or messages, tool definitions, workflow
preconditions, saved baseline response, saved candidate response, enabled checks,
and expected structured results. They must not contain credentials, personal data,
customer records, or copyrighted provider examples without permission.