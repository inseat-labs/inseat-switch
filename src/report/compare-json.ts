import type { CompareResult } from "../compare/run.js";

export function buildCompareJson(result: CompareResult, switchVersion: string, generatedAt = new Date().toISOString()) {
  return {
    reportVersion: 1,
    kind: "compare" as const,
    switchVersion,
    generatedAt,
    baseline: result.baseline,
    candidate: result.candidate,
    repeat: result.repeat,
    totals: result.totals,
    calls: result.calls,
    cases: result.cases.map((c) => ({
      name: c.name,
      status: c.diff.status,
      findings: c.diff.findings,
      flaky: c.diff.flaky,
      ...(c.system !== undefined ? { system: c.system } : {}),
      messages: c.messages,
      samples: c.samples,
    })),
  };
}

export type CompareJsonReport = ReturnType<typeof buildCompareJson>;
