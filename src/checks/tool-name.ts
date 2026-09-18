import type { CheckContext } from "./context.js";
import { fail, notTested, pass, type CheckResult } from "./types.js";

const CHECK = "tool-name";

export function checkToolName(ctx: CheckContext): CheckResult {
  if (!ctx.candidate.available) {
    return notTested(CHECK, "candidate-unavailable", ctx.candidate.reason);
  }

  const expected = resolveExpectedTool(ctx);
  if (expected.kind === "none") {
    return notTested(CHECK, expected.reasonCode, expected.message);
  }

  const observedNames = ctx.candidate.toolCalls.map((call) => call.name);
  if (observedNames.length === 0) {
    return fail(CHECK, "no-tool-call", `candidate made no tool call; expected "${expected.name}"`, {
      expected: expected.name,
      observed: observedNames,
    });
  }

  if (observedNames.includes(expected.name)) {
    return pass(CHECK, "tool-matched", `candidate called "${expected.name}"`, {
      expected: expected.name,
      observed: observedNames,
    });
  }

  return fail(
    CHECK,
    "wrong-tool",
    `candidate called ${observedNames.map((n) => `"${n}"`).join(", ")}; expected "${expected.name}"`,
    { expected: expected.name, observed: observedNames },
  );
}

type ExpectedTool =
  | { kind: "tool"; name: string; source: "expectations" | "baseline" }
  | { kind: "none"; reasonCode: string; message: string };

function resolveExpectedTool(ctx: CheckContext): ExpectedTool {
  if (ctx.expectations.requiredTool) {
    return { kind: "tool", name: ctx.expectations.requiredTool, source: "expectations" };
  }
  if (!ctx.baseline.available) {
    return {
      kind: "none",
      reasonCode: "baseline-unavailable",
      message: `no requiredTool configured and baseline is unavailable: ${ctx.baseline.reason}`,
    };
  }
  const first = ctx.baseline.toolCalls[0];
  if (!first) {
    return {
      kind: "none",
      reasonCode: "no-expected-tool",
      message: "no requiredTool configured and baseline made no tool call",
    };
  }
  return { kind: "tool", name: first.name, source: "baseline" };
}
