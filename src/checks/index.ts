import type { CheckContext } from "./context.js";
import { checkOutcomeAssertion } from "./outcome-assertion.js";
import { checkStructuredOutput } from "./structured-output.js";
import { checkToolArguments } from "./tool-arguments.js";
import { checkToolName } from "./tool-name.js";
import type { CheckId, CheckResult } from "./types.js";

export type CheckFn = (ctx: CheckContext) => CheckResult;

export const CHECKS: Record<CheckId, CheckFn> = {
  "tool-name": checkToolName,
  "tool-arguments": checkToolArguments,
  "structured-output": checkStructuredOutput,
  "outcome-assertion": checkOutcomeAssertion,
};

export function runChecks(ids: readonly CheckId[], ctx: CheckContext): CheckResult[] {
  return ids.map((id) => CHECKS[id](ctx));
}

export * from "./types.js";
export type { CheckContext } from "./context.js";
