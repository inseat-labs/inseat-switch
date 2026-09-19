# Invalid examples

Files here must fail fixture validation. They are excluded from
`npm run check:examples` and asserted in `tests/examples.test.ts`.

| File | Why it is rejected |
| --- | --- |
| `11-malformed-outcome-assertion.json` | `paths[0].path` is not a valid property path and `verifiers[0].kind` is not an allowlisted verifier kind |
