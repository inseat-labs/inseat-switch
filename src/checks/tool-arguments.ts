import type { CheckContext } from "./context.js";
import { validateAgainstSchema } from "./json-schema.js";
import { fail, notTested, pass, type CheckResult } from "./types.js";

const CHECK = "tool-arguments";

export function checkToolArguments(ctx: CheckContext): CheckResult {
  if (!ctx.candidate.available) {
    return notTested(CHECK, "candidate-unavailable", ctx.candidate.reason);
  }
  if (ctx.candidate.toolCalls.length === 0) {
    return notTested(CHECK, "no-tool-call", "candidate made no tool call to validate");
  }

  const failures: string[] = [];
  let validated = 0;

  for (const call of ctx.candidate.toolCalls) {
    const tool = ctx.tools.find((t) => t.name === call.name);
    if (!tool) {
      failures.push(`"${call.name}" is not a defined tool`);
      continue;
    }
    if (!tool.parameters) continue;
    validated += 1;
    const result = validateAgainstSchema(tool.parameters, call.arguments);
    if (!result.valid) {
      failures.push(...result.errors.map((e) => `"${call.name}": ${e}`));
    }
  }

  if (failures.length > 0) {
    return fail(CHECK, "schema-violation", failures.join("; "), {
      observed: ctx.candidate.toolCalls,
    });
  }
  if (validated === 0) {
    return notTested(CHECK, "no-parameter-schema", "no called tool declares a parameters schema");
  }
  return pass(CHECK, "arguments-valid", `${validated} tool call(s) matched their parameter schema`, {
    observed: ctx.candidate.toolCalls,
  });
}
