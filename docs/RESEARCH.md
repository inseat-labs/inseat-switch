# Research Notes

Last reviewed: 2026-09-16. Sources should be rechecked before implementation
because provider and product documentation changes.

## Source-backed facts

The statements in this section are limited to what the linked sources describe.
They do not imply affiliation with or endorsement by any vendor.

| Source | Relevant documented capability or context |
| --- | --- |
| [OpenAI deprecations](https://developers.openai.com/api/docs/deprecations) | OpenAI publishes deprecation notices and recommended replacements, demonstrating that applications need to plan model and API migrations. |
| [Promptfoo assertions](https://www.promptfoo.dev/docs/configuration/expected-outputs/) | Promptfoo supports configurable assertions over evaluation outputs, including structured and custom checks. |
| [Not Diamond requirements and concepts](https://docs.notdiamond.ai/docs/requirements-and-concepts) | Not Diamond documents requirements and concepts for model selection. This page alone does not establish broader evaluation capabilities. |
| [Langfuse documentation](https://langfuse.com/docs) | Langfuse documents tracing, prompt management, evaluation, and related LLM engineering workflows. |
| [Braintrust documentation](https://www.braintrust.dev/docs) | Braintrust documents evaluations, datasets, experiments, and observability workflows. |
| [vLLM tool calling](https://docs.vllm.ai/en/stable/features/tool_calling/) | vLLM documents tool-calling support and model/parser-specific configuration, showing that tool-call compatibility can depend on serving configuration. |
| [vLLM issue 39056](https://github.com/vllm-project/vllm/issues/39056) | This issue report is an example of reported tool-calling behavior. It is not treated as product documentation or proof of a general vLLM limitation. |

## Competitive overlap

Promptfoo, Not Diamond, Langfuse, and Braintrust overlap with parts of the proposed
evaluation workflow. Their documented scopes include combinations of assertions,
evaluation, datasets, experiments, observability, or model selection. Inseat Switch
does not claim those products cannot perform migration checks.

The proposed differentiation is narrower product framing: an offline-first,
contract-focused comparison of a baseline and candidate for one owned workflow,
with explicit `pass`, `fail`, and `not-tested` outcomes. Whether that framing is
valuable enough to justify another tool remains unverified.

## Hypotheses to validate

These are product hypotheses, not established facts:

- Developers have representative saved responses but lack a concise migration
  compatibility report.
- Tool names, arguments, JSON Schema conformance, and workflow preconditions are a
  useful minimum check set.
- Offline replay materially lowers adoption and data-governance barriers.
- Explicit `not-tested` results improve migration decisions compared with a binary
  score.
- Existing evaluation products feel too broad or require too much setup for this
  narrow task.

Validate these through the interviews and manual workflow described in
[PRODUCT_PLAN.md](PRODUCT_PLAN.md), not through feature implementation alone.

## Research gaps

- Compare exact setup effort and report semantics across overlapping products.
- Collect real migration failure examples with sensitive details removed.
- Define how semantic argument equivalence should differ from strict JSON equality.
- Determine which workflow preconditions can be checked deterministically.
- Review provider data retention, pricing, and tool-call contracts immediately
  before any live adapter is designed.