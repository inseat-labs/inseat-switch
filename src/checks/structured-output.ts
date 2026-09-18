import type { CheckContext } from "./context.js";
import { validateAgainstSchema } from "./json-schema.js";
import { fail, notTested, pass, type CheckResult } from "./types.js";

const CHECK = "structured-output";

export function checkStructuredOutput(ctx: CheckContext): CheckResult {
  const schema = ctx.expectations.outputSchema;
  if (!schema) {
    return notTested(CHECK, "no-output-schema", "no expectations.outputSchema configured");
  }
  if (!ctx.candidate.available) {
    return notTested(CHECK, "candidate-unavailable", ctx.candidate.reason);
  }
  if (ctx.candidate.text === null || ctx.candidate.text.trim() === "") {
    return fail(CHECK, "no-text-output", "candidate produced no text to validate against outputSchema");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(ctx.candidate.text);
  } catch (error) {
    return fail(CHECK, "not-json", `candidate text is not valid JSON: ${(error as Error).message}`, {
      observed: ctx.candidate.text,
    });
  }

  const result = validateAgainstSchema(schema, parsed);
  if (!result.valid) {
    return fail(CHECK, "schema-violation", result.errors.join("; "), { observed: parsed });
  }
  return pass(CHECK, "output-valid", "candidate output matched outputSchema", { observed: parsed });
}
