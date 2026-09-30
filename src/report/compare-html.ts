import type { CaseStatus } from "../compare/diff.js";
import type { CaseResult, CompareResult, Sample } from "../compare/run.js";
import { STATUS_LABEL, summaryLine, usesPromptedTools } from "./compare-text.js";

export function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const STATUS_CLASS: Record<CaseStatus, string> = {
  regression: "bad",
  change: "warn",
  info: "info",
  flaky: "flaky",
  same: "ok",
  error: "bad",
};

const CSS = `
:root{--bg:#fbfaf7;--fg:#1d1c1a;--muted:#6b675f;--line:#e4e0d8;--card:#fff;--bad:#b42318;--warn:#a15c07;--ok:#1f7a3f;--info:#3a5a8c;--flaky:#6e4fa3}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1180px;margin:0 auto;padding:32px 20px 64px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:17px;margin:0}
.muted{color:var(--muted)}code,pre{font:13px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace}
pre{white-space:pre-wrap;word-break:break-word;margin:6px 0 0;background:#f5f3ee;border-radius:6px;padding:8px}
.summary{display:flex;gap:10px;flex-wrap:wrap;margin:16px 0 24px}.pill{border:1px solid var(--line);border-radius:999px;padding:3px 12px;background:var(--card)}
.case{background:var(--card);border:1px solid var(--line);border-radius:10px;margin:0 0 14px;padding:14px 16px}
.case>summary{cursor:pointer;display:flex;gap:12px;align-items:baseline;list-style:none}.case>summary::-webkit-details-marker{display:none}
.badge{font:600 12px/1 ui-monospace,monospace;padding:4px 8px;border-radius:6px;color:#fff;white-space:nowrap}
.bad{background:var(--bad)}.warn{background:var(--warn)}.ok{background:var(--ok)}.info{background:var(--info)}.flaky{background:var(--flaky)}
ul.findings{margin:10px 0;padding-left:20px}ul.findings li{margin:2px 0}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:10px}@media(max-width:800px){.grid{grid-template-columns:1fr}}
.col h3{font-size:14px;margin:0 0 6px}.sample{border-top:1px solid var(--line);padding:8px 0}
.tags{display:flex;gap:6px;flex-wrap:wrap}.tag{font-size:12px;border:1px solid var(--line);border-radius:4px;padding:0 6px;color:var(--muted)}
.tag.alert{color:var(--bad);border-color:var(--bad)}
.call{font-weight:600}
`;

function sampleHtml(s: Sample): string {
  const tags = [`#${s.index + 1}`, s.source, s.toolMode ? `tools: ${s.toolMode}` : null].filter(Boolean).map((t) => `<span class="tag">${escapeHtml(t)}</span>`);
  if (s.status === "error") tags.push('<span class="tag alert">error</span>');
  if (s.status === "unparseable") tags.push('<span class="tag alert">unparseable</span>');
  if (s.formatNote) tags.push(`<span class="tag">${escapeHtml(s.formatNote)}</span>`);
  if (s.behavior?.asksClarification) tags.push('<span class="tag">asks clarification</span>');
  if (s.behavior?.refused) tags.push('<span class="tag alert">refused</span>');
  if (s.behavior && !s.behavior.argsValid) tags.push('<span class="tag alert">invalid args</span>');
  const parts = [`<div class="tags">${tags.join("")}</div>`];
  if (s.error) parts.push(`<div class="muted">${escapeHtml(s.error)}</div>`);
  for (const call of s.toolCalls) {
    parts.push(`<div class="call">${escapeHtml(call.name)}</div><pre>${escapeHtml(JSON.stringify(call.arguments, null, 2))}</pre>`);
  }
  if (s.behavior && s.behavior.argErrors.length > 0) {
    parts.push(`<div class="muted">${s.behavior.argErrors.map(escapeHtml).join("<br>")}</div>`);
  }
  if (s.status === "unparseable" && s.raw) parts.push(`<pre>${escapeHtml(s.raw)}</pre>`);
  else if (s.text) parts.push(`<pre>${escapeHtml(s.text)}</pre>`);
  else if (s.toolCalls.length === 0 && s.status === "ok") parts.push('<div class="muted">(empty reply)</div>');
  return `<div class="sample">${parts.join("")}</div>`;
}

function promptHtml(c: CaseResult): string {
  const turns = c.messages.map((m) => {
    const calls = (m.toolCalls ?? []).map((t) => `\n→ ${t.name} ${JSON.stringify(t.arguments)}`).join("");
    return `${m.role}: ${m.content ?? ""}${calls}`;
  });
  return `<details><summary class="muted">prompt${c.system !== undefined ? " and system" : ""}</summary>${
    c.system !== undefined ? `<pre>${escapeHtml(`system: ${c.system}`)}</pre>` : ""
  }<pre>${escapeHtml(turns.join("\n\n"))}</pre></details>`;
}

function caseHtml(c: CaseResult, result: CompareResult): string {
  const status = c.diff.status;
  const findings = c.diff.findings.map(
    (f) => `<li><strong>${escapeHtml(f.category)}</strong> (${escapeHtml(f.severity)}): ${escapeHtml(f.detail)} <span class="muted">${escapeHtml(f.evidence)}</span></li>`,
  );
  const flaky = c.diff.flaky.map((f) => `<li class="muted">flaky: ${escapeHtml(f.feature)} <span>${escapeHtml(f.evidence)}</span></li>`);
  const list = findings.length + flaky.length > 0 ? `<ul class="findings">${[...findings, ...flaky].join("")}</ul>` : "";
  const open = status === "regression" || status === "change" || status === "error" ? " open" : "";
  return `<details class="case"${open}><summary><span class="badge ${STATUS_CLASS[status]}">${escapeHtml(STATUS_LABEL[status])}</span><h2>${escapeHtml(c.name)}</h2></summary>
${list}${promptHtml(c)}
<div class="grid"><div class="col"><h3>Baseline · ${escapeHtml(result.baseline)}</h3>${c.samples.baseline.map(sampleHtml).join("")}</div>
<div class="col"><h3>Candidate · ${escapeHtml(result.candidate)}</h3>${c.samples.candidate.map(sampleHtml).join("")}</div></div></details>`;
}

/** A single self-contained HTML file: inline CSS, no scripts, no external assets. Every dynamic value is escaped. */
export function renderCompareHtml(result: CompareResult, generatedAt = new Date().toISOString()): string {
  const t = result.totals;
  const pills = (["regression", "change", "same", "flaky", "info", "error"] as const)
    .filter((k) => t[k] > 0 || k === "regression" || k === "same")
    .map((k) => `<span class="pill">${escapeHtml(`${t[k]} ${k}`)}</span>`)
    .join("");
  const prompted = usesPromptedTools(result)
    ? '<p class="muted">Tool mode <code>prompted</code>: the Claude CLI cannot take tool definitions, so tools were described in the system prompt and the model replied with JSON. This approximates, but is not identical to, native tool calling.</p>'
    : "";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<title>${escapeHtml(`Switch: ${result.baseline} -> ${result.candidate}`)}</title><style>${CSS}</style></head>
<body><main>
<h1>${escapeHtml(result.baseline)} → ${escapeHtml(result.candidate)}</h1>
<p class="muted">${escapeHtml(`${result.cases.length} cases × ${result.repeat} samples per model · ${summaryLine(result)} · calls: ${result.calls.live} live, ${result.calls.cached} cached, ${result.calls.failed} failed · ${generatedAt}`)}</p>
${prompted}
<div class="summary">${pills}</div>
${result.cases.map((c) => caseHtml(c, result)).join("\n")}
<p class="muted">Generated by Switch. A change is reported only when it appears in a majority of one model's samples and a minority of the other's; other differences are marked flaky.</p>
</main></body></html>
`;
}
