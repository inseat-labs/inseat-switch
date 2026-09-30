import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cacheKey, DiskCache } from "../src/compare/cache.js";
import { runCompare } from "../src/compare/run.js";
import type { CompareConfig } from "../src/compare/types.js";
import { call, out, ScriptedProvider } from "./helpers.js";

const dirs: string[] = [];
async function tempDir() {
  const dir = await mkdtemp(join(tmpdir(), "switch-cache-test-"));
  dirs.push(dir);
  return dir;
}
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

const request = { model: "m", messages: [{ role: "user" as const, content: "hi" }], tools: [] };

describe("cacheKey", () => {
  it("is stable and sensitive to provider, messages, tools, and sample index", () => {
    const key = cacheKey("p:m", request, 0);
    expect(cacheKey("p:m", { ...request }, 0)).toBe(key);
    expect(cacheKey("q:m", request, 0)).not.toBe(key);
    expect(cacheKey("p:m", request, 1)).not.toBe(key);
    expect(cacheKey("p:m", { ...request, messages: [{ role: "user", content: "hi!" }] }, 0)).not.toBe(key);
    expect(cacheKey("p:m", { ...request, tools: [{ name: "t" }] }, 0)).not.toBe(key);
    expect(cacheKey("p:m", { ...request, system: "s" }, 0)).not.toBe(key);
  });
});

describe("runCompare with a disk cache", () => {
  const config: CompareConfig = {
    baseline: "fake:base",
    candidate: "fake:cand",
    repeat: 2,
    cases: [{ name: "c", messages: [{ role: "user", content: "p" }], tools: [], recorded: [] }],
  };

  it("serves reruns from the cache without calling providers", async () => {
    const cache = new DiskCache(await tempDir());
    const make = () => ({
      baseline: new ScriptedProvider("fake:base", { p: [out([call("a")])] }),
      candidate: new ScriptedProvider("fake:cand", { p: [out([call("a")])] }),
    });
    const first = make();
    const r1 = await runCompare(config, { ...first, cache, concurrency: 1 });
    expect(r1.calls).toEqual({ live: 4, cached: 0, failed: 0 });
    expect(await readdir(cache.dir)).toHaveLength(4);

    const second = make();
    const r2 = await runCompare(config, { ...second, cache, concurrency: 1 });
    expect(r2.calls).toEqual({ live: 0, cached: 4, failed: 0 });
    expect(second.baseline.calls).toHaveLength(0);
    expect(r2.cases[0]!.samples.candidate.every((s) => s.source === "cache")).toBe(true);
  });

  it("does not cache provider errors and reports them per sample", async () => {
    const cache = new DiskCache(await tempDir());
    const baseline = new ScriptedProvider("fake:base", { p: [out([call("a")])] });
    const candidate = new ScriptedProvider("fake:cand", {});
    const result = await runCompare(config, { baseline, candidate, cache, concurrency: 1 });
    expect(result.calls).toEqual({ live: 2, cached: 0, failed: 2 });
    expect(result.cases[0]!.diff.status).toBe("error");
    expect(result.cases[0]!.samples.candidate[0]).toMatchObject({ status: "error", error: "no scripted reply for p" });
    expect(await readdir(cache.dir)).toHaveLength(2);
  });

  it("adds recorded responses as extra baseline samples", async () => {
    const withRecorded: CompareConfig = { ...config, repeat: 1, cases: [{ ...config.cases[0]!, recorded: [{ text: null, toolCalls: [call("a")], toolMode: "recorded" }] }] };
    const result = await runCompare(withRecorded, {
      baseline: new ScriptedProvider("fake:base", { p: [out([call("a")])] }),
      candidate: new ScriptedProvider("fake:cand", { p: [out([call("a")])] }),
      cache: null,
    });
    expect(result.cases[0]!.samples.baseline.map((s) => s.source)).toEqual(["live", "recorded"]);
    expect(result.cases[0]!.diff.status).toBe("same");
  });
});
