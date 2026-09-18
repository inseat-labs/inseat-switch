export type CheckStatus = "pass" | "fail" | "not-tested";

export type CheckId = "tool-name" | "tool-arguments" | "structured-output";

export const ALL_CHECK_IDS: readonly CheckId[] = [
  "tool-name",
  "tool-arguments",
  "structured-output",
];

export interface CheckResult {
  check: CheckId;
  status: CheckStatus;
  reasonCode: string;
  message: string;
  observed?: unknown;
  expected?: unknown;
}

export function pass(check: CheckId, reasonCode: string, message: string, extra: Partial<CheckResult> = {}): CheckResult {
  return { check, status: "pass", reasonCode, message, ...extra };
}

export function fail(check: CheckId, reasonCode: string, message: string, extra: Partial<CheckResult> = {}): CheckResult {
  return { check, status: "fail", reasonCode, message, ...extra };
}

export function notTested(check: CheckId, reasonCode: string, message: string, extra: Partial<CheckResult> = {}): CheckResult {
  return { check, status: "not-tested", reasonCode, message, ...extra };
}
