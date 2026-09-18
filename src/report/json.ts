import type { CaseResult } from "../runner/run.js";

export interface JsonReport {
  reportVersion: 1;
  generatedAt: string;
  tool: { name: string; version: string };
  cases: CaseResult[];
  totals: { cases: number; pass: number; fail: number; notTested: number };
}

export function buildJsonReport(cases: CaseResult[], version: string, now = new Date()): JsonReport {
  const totals = { cases: cases.length, pass: 0, fail: 0, notTested: 0 };
  for (const c of cases) {
    totals.pass += c.summary.pass;
    totals.fail += c.summary.fail;
    totals.notTested += c.summary.notTested;
  }
  return {
    reportVersion: 1,
    generatedAt: now.toISOString(),
    tool: { name: "inseat-switch", version },
    cases,
    totals,
  };
}
