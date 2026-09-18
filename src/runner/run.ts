import { normalizeSavedResponse } from "../adapters/saved-response.js";
import { runChecks, type CheckId, type CheckResult, type CheckStatus } from "../checks/index.js";
import type { Fixture } from "../fixtures/schema.js";

export interface CaseSummary {
  pass: number;
  fail: number;
  notTested: number;
  overall: CheckStatus;
}

export interface CaseResult {
  fixture: string;
  baseline: string;
  candidate: string;
  checks: CheckResult[];
  summary: CaseSummary;
}

export function runFixture(fixture: Fixture): CaseResult {
  const baseline = normalizeSavedResponse(fixture.responses.baseline);
  const candidate = normalizeSavedResponse(fixture.responses.candidate);

  const checks = runChecks(fixture.checks as CheckId[], {
    tools: fixture.tools,
    expectations: fixture.expectations,
    baseline,
    candidate,
  });

  return {
    fixture: fixture.name,
    baseline: `${fixture.baseline.provider}/${fixture.baseline.model}`,
    candidate: `${fixture.candidate.provider}/${fixture.candidate.model}`,
    checks,
    summary: summarize(checks),
  };
}

export function summarize(checks: readonly CheckResult[]): CaseSummary {
  const counts = { pass: 0, fail: 0, notTested: 0 };
  for (const c of checks) {
    if (c.status === "pass") counts.pass += 1;
    else if (c.status === "fail") counts.fail += 1;
    else counts.notTested += 1;
  }
  const overall: CheckStatus = counts.fail > 0 ? "fail" : counts.pass > 0 ? "pass" : "not-tested";
  return { ...counts, overall };
}
