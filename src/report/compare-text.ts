import type { CaseStatus } from "../compare/diff.js";
import type { CaseResult, CompareResult } from "../compare/run.js";

export const STATUS_LABEL: Record<CaseStatus, string> = {
  regression: "✗ REGRESSION",
  change: "~ CHANGE",
  info: "i INFO",
  flaky: "? FLAKY",
  same: "✓ SAME",
  error: "! ERROR",
};

export function usesPromptedTools(result: CompareResult): boolean {
  return result.cases.some((c) => [...c.samples.baseline, ...c.samples.candidate].some((s) => s.toolMode === "prompted"));
}

function caseLines(c: CaseResult): string[] {
  if (c.diff.status === "error") {
    const failed = [...c.samples.baseline, ...c.samples.candidate].find((s) => s.status === "error");
    return [`no usable samples${failed?.error ? `: ${failed.error}` : ""}`];
  }
  const lines = c.diff.findings.map((f) => `${f.category}: ${f.detail} (${f.evidence})`);
  if (c.diff.status === "flaky") lines.push(...c.diff.flaky.map((f) => `${f.feature} (${f.evidence})`));
  else if (c.diff.flaky.length > 0 && lines.length > 0) lines.push(`+${c.diff.flaky.length} flaky difference(s), see report`);
  const failed = [...c.samples.baseline, ...c.samples.candidate].filter((s) => s.status === "error").length;
  if (failed > 0) lines.push(`${failed} sample(s) failed and were excluded`);
  return lines;
}

export function summaryLine(result: CompareResult): string {
  const t = result.totals;
  const parts = [`${t.regression} regression`, `${t.change} change`, `${t.same} same`, `${t.flaky} flaky`];
  if (t.info > 0) parts.push(`${t.info} info`);
  if (t.error > 0) parts.push(`${t.error} error`);
  return `Result: ${parts.join(", ")}`;
}

export function renderCompareText(result: CompareResult, reportPath?: string): string {
  const width = Math.min(28, Math.max(...result.cases.map((c) => c.name.length)));
  const out = [`Switch  ${result.baseline} -> ${result.candidate}   ${result.cases.length} cases x ${result.repeat} samples`];
  if (usesPromptedTools(result)) out.push("(claude-cli: tools are described in the prompt and returned as JSON, not native tool calls)");
  const labelWidth = Math.max(...Object.values(STATUS_LABEL).map((l) => l.length));
  for (const c of result.cases) {
    const label = STATUS_LABEL[c.diff.status].padEnd(labelWidth);
    const name = c.name.length > width ? `${c.name.slice(0, width - 1)}…` : c.name.padEnd(width);
    const [first, ...more] = caseLines(c);
    out.push(`${label}  ${name}  ${first ?? ""}`.trimEnd());
    for (const line of more) out.push(`${" ".repeat(labelWidth + width + 4)}${line}`);
  }
  out.push(`calls: ${result.calls.live} live, ${result.calls.cached} cached, ${result.calls.failed} failed`);
  out.push(`${summaryLine(result)}${reportPath ? `   report: ${reportPath}` : ""}`);
  return out.join("\n");
}
