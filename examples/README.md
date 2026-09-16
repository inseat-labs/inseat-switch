# Planned Examples

No runnable examples exist yet. This directory documents the fixture scenarios
Milestone 0 should eventually include using synthetic data.

| Scenario | Baseline | Candidate | Expected result |
| --- | --- | --- | --- |
| Same required tool and valid arguments | Calls `lookup_order` | Calls `lookup_order` with schema-valid equivalent arguments | `pass` |
| Wrong tool selected | Calls `lookup_order` | Calls `cancel_order` | `fail` |
| Invalid arguments | Uses schema-valid order ID | Omits the required order ID | `fail` |
| Missing candidate tool evidence | Calls a required tool | Saved response lacks supported tool-call data | `not-tested` |
| Unmet workflow precondition | Required state is present | Required state cannot be established | `fail` or `not-tested`, according to the configured rule and available evidence |

Future fixtures should contain the prompt or messages, tool definitions, workflow
preconditions, saved baseline response, saved candidate response, enabled checks,
and expected structured results. They must not contain credentials, personal data,
customer records, or copyrighted provider examples without permission.