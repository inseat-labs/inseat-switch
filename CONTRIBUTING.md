# Contributing

Inseat Switch is in early development. A Milestone 0 offline checker exists.

## Development

```bash
npm ci
npm test            # vitest
npm run typecheck   # tsc --noEmit
npm run build       # emits dist/
npm run dev -- check examples/fixtures/*.json
```

Add a test for every new check, adapter format, or fixture field. A new check must
return `not-tested` with a stable `reasonCode` whenever its evidence is missing.
New example fixtures must be synthetic and state their expected result in
`description`, and `tests/examples.test.ts` must assert it.

Contributions that improve product definitions, architecture decisions, research
accuracy, threat modeling, or fixture design are equally welcome. Please keep
proposals scoped and distinguish:

- verified facts, with primary or credible official sources
- product decisions, with their tradeoffs
- hypotheses, with a proposed validation method

Do not add provider credentials, customer data, production prompts, proprietary
model responses, or other secrets. Example material must be synthetic or cleared
for public use.

Before proposing runtime code, confirm that the change belongs to Milestone 0 in
[ROADMAP.md](ROADMAP.md). Runtime implementation should begin only after the
Milestone 0 contracts are agreed. Contributions are expected to follow the
Apache License 2.0 in [LICENSE](LICENSE).