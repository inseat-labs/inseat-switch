import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { main, type CliIo } from "../src/cli/main.js";
import { renderCompareHtml } from "../src/report/compare-html.js";
import { renderCompareText } from "../src/report/compare-text.js";
import type { CompareResult } from "../src/compare/run.js";
import type { ProviderOutput } from "../src/compare/types.js";
import { call, out, ScriptedProvider } from "./helpers.js";

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

async function setup(config?: string) {
  const cwd = await mkdtemp(join(tmpdir(), "switch-cli-test-"));
  dirs.push(cwd);
  if (config !== undefined) await writeFile(join(cwd, "switch.yaml"), config);
  return cwd;
}

function io(cwd: string, scripts: Record<string, Record<string, ProviderOutput[]>> = {}, failPreflight?: string) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const cli: CliIo = {
    cwd,
    stdout: (t) => stdout.push(t),
    stderr: (t) => stderr.push(t),
    providerFactory: (id) => new ScriptedProvider(id, scripts[id] ?? {}, failPreflight),
    now: () => "2026-01-01T00:00:00.000Z",
  };
  return { cli, out: () => stdout.join(""), err: () => stderr.join("") };
}

const CONFIG = `baseline: fake:big
candidate: fake:small
repeat: 3
tools:
  - name: cancel_order
    parameters: { type: object, properties: { id: { type: string } }, required: [id] }
cases:
  - name: cancel order
    prompt: cancel ORD-1
  - name: greet
    prompt: hello
`;

const cancel = out([call("cancel_order", { id: "ORD-1" })]);
const hello = out([], "Hi there!");

describe("init", () => {
  it("writes a valid starter switch.yaml and refuses to overwrite it", async () => {
    const cwd = await setup();
    const t = io(cwd);
    expect(await main(["init"], t.cli)).toBe(0);
    const written = await readFile(join(cwd, "switch.yaml"), "utf8");
    expect(written).toContain("baseline: claude-cli:sonnet");
    expect(await main(["init"], t.cli)).toBe(2);
    expect(t.err()).toContain("already exists");
    expect(await readFile(join(cwd, "switch.yaml"), "utf8")).toBe(written);

    const { loadCompareConfig } = await import("../src/compare/config.js");
    const config = await loadCompareConfig(join(cwd, "switch.yaml"));
    expect(config.cases.length).toBeGreaterThan(0);
  });
});

describe("compare", () => {
  it("exits 1 on a consistent regression and writes text, HTML, and JSON reports", async () => {
    const cwd = await setup(CONFIG);
    const t = io(cwd, {
      "fake:big": { "cancel ORD-1": [cancel], hello: [hello] },
      "fake:small": { "cancel ORD-1": [out([], "Your order is cancelled.")], hello: [hello] },
    });
    expect(await main(["compare", "--json", "report.json", "--no-cache"], t.cli)).toBe(1);
    const text = t.out();
    expect(text).toContain("Switch  fake:big -> fake:small   2 cases x 3 samples");
    expect(text).toMatch(/✗ REGRESSION\s+cancel order\s+tool-dropped: cancel_order \(3\/3 -> 0\/3\)/);
    expect(text).toMatch(/✓ SAME\s+greet/);
    expect(text).toContain("Result: 1 regression, 0 change, 1 same, 0 flaky   report: switch-report.html");
    const json = JSON.parse(await readFile(join(cwd, "report.json"), "utf8"));
    expect(json).toMatchObject({ reportVersion: 1, kind: "compare", totals: { regression: 1, same: 1 } });
    expect(json.cases[0].samples.baseline).toHaveLength(3);
    expect(await readFile(join(cwd, "switch-report.html"), "utf8")).toContain("<!doctype html>");
  });

  it("exits 0 when differences are only flaky", async () => {
    const cwd = await setup(CONFIG);
    const t = io(cwd, {
      "fake:big": { "cancel ORD-1": [cancel], hello: [hello] },
      "fake:small": { "cancel ORD-1": [cancel, cancel, out([], "Done")], hello: [hello] },
    });
    expect(await main(["compare", "--no-cache", "--no-html"], t.cli)).toBe(0);
    expect(t.out()).toMatch(/\? FLAKY\s+cancel order\s+tool cancel_order \(3\/3 -> 2\/3\)/);
    expect(t.out()).not.toContain("report:");
  });

  it("exits 2 for an invalid config, missing config, bad flags, unknown provider, or failed preflight", async () => {
    const bad = await setup("baseline: fake:a\ncases: []\n");
    expect(await main(["compare"], io(bad).cli)).toBe(2);

    const missing = await setup();
    const m = io(missing);
    expect(await main(["compare"], m.cli)).toBe(2);
    expect(m.err()).toContain("switch init");

    const cwd = await setup(CONFIG);
    expect(await main(["compare", "--repeat", "0"], io(cwd).cli)).toBe(2);
    expect(await main(["compare", "--bogus"], io(cwd).cli)).toBe(2);
    const pre = io(cwd, {}, "fake:big needs FAKE_API_KEY");
    expect(await main(["compare"], pre.cli)).toBe(2);
    expect(pre.err()).toContain("FAKE_API_KEY");

    const real = await setup(CONFIG.replace("fake:big", "gemini:pro"));
    const r = io(real);
    r.cli.providerFactory = (await import("../src/providers/index.js")).createProvider;
    expect(await main(["compare"], r.cli)).toBe(2);
    expect(r.err()).toContain('unknown provider "gemini"');
  });

  it("keeps the check command working", async () => {
    const t = io(process.cwd());
    expect(await main(["check", "examples/fixtures/01-same-tool-valid-arguments.json"], t.cli)).toBe(0);
    expect(await main(["check", "examples/fixtures/02-wrong-tool-selected.json"], t.cli)).toBe(1);
    expect(await main(["check", "examples/invalid/11-malformed-outcome-assertion.json"], t.cli)).toBe(2);
  });
});

describe("reports", () => {
  const hostile = '<script>alert("x")</script>';
  const result: CompareResult = {
    baseline: "fake:<b>",
    candidate: "fake:c",
    repeat: 1,
    calls: { live: 2, cached: 0, failed: 0 },
    totals: { regression: 0, change: 1, info: 0, flaky: 0, same: 0, error: 0 },
    cases: [
      {
        name: hostile,
        messages: [{ role: "user", content: hostile }],
        diff: { status: "change", findings: [{ category: "arg-added", severity: "change", detail: `t.x=${hostile}`, evidence: "0/1 -> 1/1" }], flaky: [] },
        samples: {
          baseline: [{ index: 0, source: "live", status: "ok", toolMode: "prompted", text: hostile, toolCalls: [] }],
          candidate: [{ index: 0, source: "live", status: "unparseable", toolMode: "prompted", text: hostile, toolCalls: [{ name: hostile, arguments: { a: hostile } }], raw: hostile, error: hostile }],
        },
      },
    ],
  };

  it("escapes every model- and user-provided value in HTML", () => {
    const html = renderCompareHtml(result, "now");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(html).not.toMatch(/<link|src=|https?:\/\//);
    expect(html).toContain("tools: prompted");
  });

  it("notes prompted tool mode in the terminal summary", () => {
    const text = renderCompareText(result);
    expect(text).toContain("claude-cli: tools are described in the prompt");
    expect(text).toContain("Result: 0 regression, 1 change, 0 same, 0 flaky");
  });
});
