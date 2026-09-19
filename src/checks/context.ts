import type { NormalizedResponse } from "../adapters/normalized.js";
import type { Expectations, ToolDefinition } from "../config/schema.js";
import type { OutcomeEvidence } from "../fixtures/schema.js";

export interface CheckContext {
  tools: ToolDefinition[];
  expectations: Expectations;
  baseline: NormalizedResponse;
  candidate: NormalizedResponse;
  candidateOutcome?: OutcomeEvidence;
}
