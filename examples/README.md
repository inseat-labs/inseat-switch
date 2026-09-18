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

A workflow-precondition scenario (required state cannot be established) is still
planned and has no check implementation yet.

Fixtures contain the prompt or messages, tool definitions, workflow
preconditions, saved baseline response, saved candidate response, enabled checks,
and expected structured results. They must not contain credentials, personal data,
customer records, or copyrighted provider examples without permission.