import type { Behavior } from "./behavior.js";

export type Severity = "regression" | "change" | "info";
export type Category =
  | "tool-dropped"
  | "tool-added"
  | "tool-switched"
  | "arg-added"
  | "arg-removed"
  | "arg-value-changed"
  | "args-invalid"
  | "acted-instead-of-asking"
  | "asked-instead-of-acting"
  | "refused"
  | "output-unparseable"
  | "text-only-change";

export interface Count {
  count: number;
  total: number;
}

export interface Finding {
  category: Category;
  severity: Severity;
  detail: string;
  /** Human-readable sample counts, baseline first, e.g. "3/3 -> 0/3". */
  evidence: string;
}

export interface FlakyNote {
  feature: string;
  evidence: string;
}

export type CaseStatus = "regression" | "change" | "info" | "flaky" | "same" | "error";

export interface CaseDiff {
  status: CaseStatus;
  findings: Finding[];
  flaky: FlakyNote[];
}

const MAX_VALUE_CHARS = 60;

function count(samples: Behavior[], pred: (b: Behavior) => boolean): Count {
  return { count: samples.filter(pred).length, total: samples.length };
}

/** Strictly more than half of the samples. */
const majority = (c: Count): boolean => c.count * 2 > c.total;
/** Strictly fewer than half of the samples. Exactly half is undecided. */
const minority = (c: Count): boolean => c.count * 2 < c.total;
const fmt = (c: Count): string => `${c.count}/${c.total}`;
const arrow = (b: Count, c: Count): string => `${fmt(b)} -> ${fmt(c)}`;

type Direction = "added" | "dropped" | "flaky" | "same";

/** A change is consistent only when one side has it in a majority of samples and the other in a minority. */
export function direction(b: Count, c: Count): Direction {
  if (minority(b) && majority(c)) return "added";
  if (majority(b) && minority(c)) return "dropped";
  if (b.count * c.total !== c.count * b.total) return "flaky";
  return "same";
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((k) => [k, sortKeys((value as Record<string, unknown>)[k])]),
    );
  }
  return typeof value === "string" ? value.trim().toLowerCase() : value;
}

/** Comparison key for argument values: key order, surrounding whitespace, and letter case are ignored. */
export function canonicalValue(value: unknown): string {
  return JSON.stringify(sortKeys(value)) ?? "undefined";
}

/** Identifier-like values (ids, emails, dates, enums, numbers) are compared; free text containing spaces is not. */
export function isComparableValue(value: unknown): boolean {
  if (typeof value === "string") return !/\s/.test(value.trim());
  if (Array.isArray(value)) return value.every(isComparableValue);
  if (value && typeof value === "object") return Object.values(value).every(isComparableValue);
  return true;
}

export function displayValue(value: unknown): string {
  const text = JSON.stringify(value) ?? "undefined";
  return text.length > MAX_VALUE_CHARS ? `${text.slice(0, MAX_VALUE_CHARS - 1)}…` : text;
}

function callsTo(b: Behavior, tool: string) {
  return b.toolCalls.filter((c) => c.name === tool);
}

function hasArg(b: Behavior, tool: string, key: string): boolean {
  return callsTo(b, tool).some((c) => Object.hasOwn(c.arguments, key));
}

function argValue(b: Behavior, tool: string, key: string): { present: boolean; value?: unknown } {
  const call = callsTo(b, tool).find((c) => Object.hasOwn(c.arguments, key));
  return call ? { present: true, value: call.arguments[key] } : { present: false };
}

/** The value used by a strict majority of all samples, or null if values vary. */
function majorityValue(samples: Behavior[], tool: string, key: string): { canon: string; value: unknown } | null {
  const groups = new Map<string, { value: unknown; n: number }>();
  for (const s of samples) {
    const v = argValue(s, tool, key);
    if (!v.present) continue;
    const canon = canonicalValue(v.value);
    const group = groups.get(canon) ?? { value: v.value, n: 0 };
    group.n += 1;
    groups.set(canon, group);
  }
  for (const [canon, group] of groups) {
    if (group.n * 2 > samples.length) return { canon, value: group.value };
  }
  return null;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function textChange(base: Behavior[], cand: Behavior[]): Finding | null {
  const bText = count(base, (b) => !!b.text?.trim());
  const cText = count(cand, (b) => !!b.text?.trim());
  const dir = direction(bText, cText);
  if (dir === "added" || dir === "dropped") {
    return {
      category: "text-only-change",
      severity: "info",
      detail: dir === "added" ? "candidate adds a text reply" : "candidate stops replying with text",
      evidence: arrow(bText, cText),
    };
  }
  const bLen = base.map((b) => b.text?.trim().length ?? 0);
  const cLen = cand.map((b) => b.text?.trim().length ?? 0);
  const bMed = Math.round(median(bLen));
  const cMed = Math.round(median(cLen));
  if (Math.max(bMed, cMed) < 40) return null;
  const allShorter = Math.max(...cLen) < Math.min(...bLen);
  const allLonger = Math.min(...cLen) > Math.max(...bLen);
  if ((allShorter && cMed * 2 <= bMed) || (allLonger && cMed >= bMed * 2)) {
    return {
      category: "text-only-change",
      severity: "info",
      detail: `reply ${allShorter ? "much shorter" : "much longer"}`,
      evidence: `median ${bMed} -> ${cMed} chars`,
    };
  }
  return null;
}

function toolNames(samples: Behavior[]): string[] {
  const names = new Set<string>();
  for (const s of samples) for (const c of s.toolCalls) names.add(c.name);
  return [...names].sort();
}

function argKeys(samples: Behavior[], tool: string): string[] {
  const keys = new Set<string>();
  for (const s of samples) for (const c of callsTo(s, tool)) for (const k of Object.keys(c.arguments)) keys.add(k);
  return [...keys].sort();
}

/**
 * Classifies how candidate behavior differs from baseline behavior for one case.
 * Only majority-vs-minority differences are findings; any other difference is flaky.
 */
export function diffBehaviors(base: Behavior[], cand: Behavior[]): CaseDiff {
  if (base.length === 0 || cand.length === 0) return { status: "error", findings: [], flaky: [] };

  const findings: Finding[] = [];
  const flaky: FlakyNote[] = [];
  const handledTools = new Set<string>();

  const feature = (pred: (b: Behavior) => boolean) => {
    const b = count(base, pred);
    const c = count(cand, pred);
    return { b, c, dir: direction(b, c) };
  };
  const noteFlaky = (name: string, f: { b: Count; c: Count; dir: Direction }) => {
    if (f.dir === "flaky") flaky.push({ feature: name, evidence: arrow(f.b, f.c) });
  };

  const unparseable = feature((b) => b.unparseable);
  if (unparseable.dir === "added") {
    findings.push({ category: "output-unparseable", severity: "regression", detail: "candidate replies could not be parsed", evidence: arrow(unparseable.b, unparseable.c) });
  } else if (unparseable.dir === "dropped") {
    findings.push({ category: "output-unparseable", severity: "info", detail: "baseline replies could not be parsed; candidate replies can", evidence: arrow(unparseable.b, unparseable.c) });
  }
  noteFlaky("unparseable", unparseable);

  const acted = feature((b) => b.toolCalls.length > 0);
  const asks = feature((b) => b.asksClarification);
  const baseTools = toolNames(base);
  const candTools = toolNames(cand);
  if (majority(asks.b) && minority(asks.c) && majority(acted.c) && minority(acted.b)) {
    const called = candTools.filter((t) => majority(count(cand, (b) => callsTo(b, t).length > 0)));
    called.forEach((t) => handledTools.add(t));
    findings.push({
      category: "acted-instead-of-asking",
      severity: "regression",
      detail: `called ${called.join(", ") || "a tool"} instead of asking for missing details`,
      evidence: `asked ${fmt(asks.b)} -> ${fmt(asks.c)}, acted ${arrow(acted.b, acted.c)}`,
    });
  } else if (majority(acted.b) && minority(acted.c) && majority(asks.c) && minority(asks.b)) {
    const skipped = baseTools.filter((t) => majority(count(base, (b) => callsTo(b, t).length > 0)));
    skipped.forEach((t) => handledTools.add(t));
    findings.push({
      category: "asked-instead-of-acting",
      severity: "change",
      detail: `asked a clarifying question instead of calling ${skipped.join(", ") || "a tool"}`,
      evidence: `acted ${arrow(acted.b, acted.c)}, asked ${fmt(asks.b)} -> ${fmt(asks.c)}`,
    });
  } else {
    if ((asks.dir === "added" || asks.dir === "dropped") && unparseable.dir !== "added" && unparseable.dir !== "dropped") {
      findings.push({
        category: "text-only-change",
        severity: "info",
        detail: asks.dir === "added" ? "candidate starts asking a clarifying question" : "candidate stops asking a clarifying question",
        evidence: arrow(asks.b, asks.c),
      });
    }
    noteFlaky("asks-clarification", asks);
  }

  const refused = feature((b) => b.refused);
  if (refused.dir === "added") {
    findings.push({ category: "refused", severity: "regression", detail: "candidate refuses the request", evidence: arrow(refused.b, refused.c) });
  } else if (refused.dir === "dropped") {
    findings.push({ category: "refused", severity: "change", detail: "candidate no longer refuses the request", evidence: arrow(refused.b, refused.c) });
  }
  noteFlaky("refused", refused);

  const dropped: string[] = [];
  const added: string[] = [];
  const stable: string[] = [];
  for (const tool of [...new Set([...baseTools, ...candTools])].sort()) {
    const f = feature((b) => callsTo(b, tool).length > 0);
    if (f.dir === "dropped" && !handledTools.has(tool)) dropped.push(tool);
    else if (f.dir === "added" && !handledTools.has(tool)) added.push(tool);
    else if (majority(f.b) && majority(f.c)) stable.push(tool);
    if (!handledTools.has(tool)) noteFlaky(`tool ${tool}`, f);
  }
  const presence = (samples: Behavior[], tool: string) => count(samples, (b) => callsTo(b, tool).length > 0);
  while (dropped.length > 0 && added.length > 0) {
    const from = dropped.shift()!;
    const to = added.shift()!;
    findings.push({
      category: "tool-switched",
      severity: "regression",
      detail: `${from} -> ${to}`,
      evidence: `${from} ${arrow(presence(base, from), presence(cand, from))}, ${to} ${arrow(presence(base, to), presence(cand, to))}`,
    });
  }
  for (const tool of dropped) {
    findings.push({ category: "tool-dropped", severity: "regression", detail: tool, evidence: arrow(presence(base, tool), presence(cand, tool)) });
  }
  for (const tool of added) {
    findings.push({ category: "tool-added", severity: "change", detail: tool, evidence: arrow(presence(base, tool), presence(cand, tool)) });
  }

  for (const tool of stable) {
    for (const key of argKeys([...base, ...cand], tool)) {
      const f = feature((b) => hasArg(b, tool, key));
      if (f.dir === "added") {
        const v = majorityValue(cand, tool, key);
        findings.push({ category: "arg-added", severity: "change", detail: `${tool}.${key}${v ? `=${displayValue(v.value)}` : ""}`, evidence: arrow(f.b, f.c) });
        continue;
      }
      if (f.dir === "dropped") {
        findings.push({ category: "arg-removed", severity: "change", detail: `${tool}.${key}`, evidence: arrow(f.b, f.c) });
        continue;
      }
      noteFlaky(`arg ${tool}.${key}`, f);
      if (!(majority(f.b) && majority(f.c))) continue;
      const bv = majorityValue(base, tool, key);
      if (!bv || !isComparableValue(bv.value)) continue;
      const cv = majorityValue(cand, tool, key);
      const bSame = count(base, (b) => argValue(b, tool, key).present && canonicalValue(argValue(b, tool, key).value) === bv.canon);
      if (cv && cv.canon !== bv.canon) {
        const cSame = count(cand, (b) => argValue(b, tool, key).present && canonicalValue(argValue(b, tool, key).value) === cv.canon);
        findings.push({
          category: "arg-value-changed",
          severity: "change",
          detail: `${tool}.${key}: ${displayValue(bv.value)} -> ${displayValue(cv.value)}`,
          evidence: `${fmt(bSame)} -> ${fmt(cSame)}`,
        });
      } else if (!cv) {
        const cSame = count(cand, (b) => argValue(b, tool, key).present && canonicalValue(argValue(b, tool, key).value) === bv.canon);
        flaky.push({ feature: `value ${tool}.${key}=${displayValue(bv.value)}`, evidence: arrow(bSame, cSame) });
      }
    }
  }

  const invalid = feature((b) => !b.argsValid);
  if (invalid.dir === "added") {
    const example = cand.find((b) => !b.argsValid)?.argErrors[0] ?? "invalid arguments";
    findings.push({ category: "args-invalid", severity: "regression", detail: example, evidence: arrow(invalid.b, invalid.c) });
  } else if (invalid.dir === "dropped") {
    findings.push({ category: "args-invalid", severity: "info", detail: "baseline arguments were invalid; candidate arguments are valid", evidence: arrow(invalid.b, invalid.c) });
  }
  noteFlaky("invalid-args", invalid);

  if (findings.length === 0) {
    const text = textChange(base, cand);
    if (text) findings.push(text);
  }

  return { status: statusOf(findings, flaky), findings, flaky };
}

function statusOf(findings: Finding[], flaky: FlakyNote[]): CaseStatus {
  if (findings.some((f) => f.severity === "regression")) return "regression";
  if (findings.some((f) => f.severity === "change")) return "change";
  if (findings.length > 0) return "info";
  return flaky.length > 0 ? "flaky" : "same";
}
