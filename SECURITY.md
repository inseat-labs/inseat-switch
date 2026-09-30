# Security Policy

## Current scope

Switch is an early-stage offline CLI (Milestone 0). It reads local
fixture files containing saved baseline/candidate responses and saved outcome
evidence, runs deterministic checks, and prints a report. It makes no network
requests, calls no model provider, executes no verifier commands, and needs no
credentials. There is no published npm package, hosted service, or live model
integration.

Security reports about the current CLI or the planned design are welcome,
especially reports involving fixture parsing, unsafe JSON Schema handling,
report contents, credentials, provider requests, or redaction.

## Reporting

Please report suspected vulnerabilities privately to
abenezer@inseat.app. Include the affected version, component, or document, impact,
reproduction details when applicable, and any suggested mitigation.

Do not include active secrets, personal data, or unnecessary production data in a
report. Do not open a public issue for an unaddressed vulnerability.

Reports will be reviewed as capacity permits. This project does not promise a
response or remediation service level.