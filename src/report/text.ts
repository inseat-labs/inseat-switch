import type { CheckStatus } from "../checks/types.js";
import type { JsonReport } from "./json.js";

const MARK: Record<CheckStatus, string> = {
  pass: "PASS",
  fail: "FAIL",
  "not-tested": "SKIP",
};

export function renderTextReport(report: JsonReport): string {
  const lines: string[] = [];
  for (const c of report.cases) {
    lines.push(`${MARK[c.summary.overall]}  ${c.fixture}`);
    lines.push(`      ${c.baseline}  ->  ${c.candidate}`);
    for (const check of c.checks) {
      lines.push(`      [${MARK[check.status]}] ${check.check} (${check.reasonCode}): ${check.message}`);
    }
    lines.push("");
  }
  const t = report.totals;
  lines.push(
    `${t.cases} case(s): ${t.pass} pass, ${t.fail} fail, ${t.notTested} not-tested. ` +
      `not-tested is never counted as pass.`,
  );
  return lines.join("\n");
}
