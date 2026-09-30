import type { Provider } from "../providers/types.js";
import { toBehavior, type Behavior } from "./behavior.js";
import { cacheKey, type ResponseCache } from "./cache.js";
import { diffBehaviors, type CaseDiff, type CaseStatus } from "./diff.js";
import type { ChatMessage, CompareConfig, ProviderOutput, ProviderRequest, ToolCall, ToolMode } from "./types.js";

export interface Sample {
  index: number;
  source: "live" | "cache" | "recorded";
  status: "ok" | "unparseable" | "error";
  toolMode: ToolMode | null;
  text: string | null;
  toolCalls: ToolCall[];
  error?: string;
  raw?: string;
  formatNote?: string;
  behavior?: Behavior;
}

export interface CaseResult {
  name: string;
  system?: string;
  messages: ChatMessage[];
  diff: CaseDiff;
  samples: { baseline: Sample[]; candidate: Sample[] };
}

export interface CompareResult {
  baseline: string;
  candidate: string;
  repeat: number;
  cases: CaseResult[];
  totals: Record<CaseStatus, number>;
  calls: { live: number; cached: number; failed: number };
}

export interface RunOptions {
  baseline: Provider;
  candidate: Provider;
  cache: ResponseCache | null;
  concurrency?: number;
  onProgress?: (done: number, total: number) => void;
}

function toSample(index: number, source: Sample["source"], output: ProviderOutput, tools: CompareConfig["cases"][number]["tools"]): Sample {
  const sample: Sample = {
    index,
    source,
    status: output.unparseable ? "unparseable" : "ok",
    toolMode: output.toolMode,
    text: output.text,
    toolCalls: output.toolCalls,
    behavior: toBehavior(output, tools),
  };
  if (output.unparseable) {
    sample.error = output.unparseable.reason;
    sample.raw = output.unparseable.raw;
  }
  if (output.formatNote) sample.formatNote = output.formatNote;
  return sample;
}

async function pool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const runners = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const item = items[next++]!;
      await worker(item);
    }
  });
  await Promise.all(runners);
}

export async function runCompare(config: CompareConfig, options: RunOptions): Promise<CompareResult> {
  const calls = { live: 0, cached: 0, failed: 0 };
  const results: CaseResult[] = config.cases.map((c) => {
    const result: CaseResult = {
      name: c.name,
      messages: c.messages,
      diff: { status: "same", findings: [], flaky: [] },
      samples: { baseline: [], candidate: [] },
    };
    if (c.system !== undefined) result.system = c.system;
    return result;
  });

  interface Job {
    caseIndex: number;
    side: "baseline" | "candidate";
    index: number;
  }
  const jobs: Job[] = [];
  for (const caseIndex of config.cases.keys()) {
    for (const side of ["baseline", "candidate"] as const) {
      for (let index = 0; index < config.repeat; index++) jobs.push({ caseIndex, side, index });
    }
  }

  let done = 0;
  await pool(jobs, options.concurrency ?? 4, async ({ caseIndex, side, index }) => {
    const c = config.cases[caseIndex]!;
    const provider = options[side];
    const request: ProviderRequest = { model: provider.model, messages: c.messages, tools: c.tools };
    if (c.system !== undefined) request.system = c.system;
    const key = cacheKey(provider.id, request, index, provider.cacheSalt);
    let sample: Sample;
    try {
      const cached = options.cache ? await options.cache.get(key) : null;
      if (cached) {
        calls.cached += 1;
        sample = toSample(index, "cache", cached, c.tools);
      } else {
        const output = await provider.call(request);
        calls.live += 1;
        await options.cache?.set(key, output);
        sample = toSample(index, "live", output, c.tools);
      }
    } catch (error) {
      calls.failed += 1;
      sample = { index, source: "live", status: "error", toolMode: null, text: null, toolCalls: [], error: (error as Error).message };
    }
    results[caseIndex]!.samples[side].push(sample);
    done += 1;
    options.onProgress?.(done, jobs.length);
  });

  const totals: Record<CaseStatus, number> = { regression: 0, change: 0, info: 0, flaky: 0, same: 0, error: 0 };
  for (const [i, result] of results.entries()) {
    const c = config.cases[i]!;
    result.samples.baseline.sort((a, b) => a.index - b.index);
    result.samples.candidate.sort((a, b) => a.index - b.index);
    c.recorded.forEach((output, n) => result.samples.baseline.push(toSample(config.repeat + n, "recorded", output, c.tools)));
    const usable = (s: Sample[]) => s.flatMap((x) => (x.behavior ? [x.behavior] : []));
    result.diff = diffBehaviors(usable(result.samples.baseline), usable(result.samples.candidate));
    totals[result.diff.status] += 1;
  }

  return { baseline: options.baseline.id, candidate: options.candidate.id, repeat: config.repeat, cases: results, totals, calls };
}
