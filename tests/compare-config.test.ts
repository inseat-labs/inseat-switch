import { describe, expect, it } from "vitest";
import { ConfigError, parseConfigText, resolveCompareConfig } from "../src/compare/config.js";

const tools = [{ name: "search_docs", parameters: { type: "object", properties: { query: { type: "string" } } } }];
const base = { baseline: "claude-cli:sonnet", candidate: "claude-cli:haiku", tools, cases: [{ name: "a", prompt: "hi" }] };
const noRead = async () => {
  throw new Error("unexpected read");
};

describe("compare config", () => {
  it("parses YAML and applies defaults", async () => {
    const raw = parseConfigText(
      `baseline: claude-cli:sonnet\ncandidate: openai:gpt-4.1-mini\nsystem: Be brief.\ncases:\n  - name: greet\n    prompt: Hello\n`,
      "switch.yaml",
    );
    const config = await resolveCompareConfig(raw, "/tmp", noRead);
    expect(config.repeat).toBe(3);
    expect(config.cases).toEqual([{ name: "greet", system: "Be brief.", tools: [], recorded: [], messages: [{ role: "user", content: "Hello" }] }]);
  });

  it("accepts OpenAI function-style tools and messages", async () => {
    const config = await resolveCompareConfig(
      {
        ...base,
        tools: [{ type: "function", function: { name: "t", description: "d", parameters: { type: "object" } } }],
        cases: [{ name: "m", messages: [{ role: "user", content: "a" }, { role: "assistant", content: null, tool_calls: [{ id: "c1", type: "function", function: { name: "t", arguments: '{"x":1}' } }] }, { role: "tool", tool_call_id: "c1", content: "ok" }] }],
      },
      "/tmp",
      noRead,
    );
    expect(config.cases[0]!.tools).toEqual([{ name: "t", description: "d", parameters: { type: "object" } }]);
    expect(config.cases[0]!.messages[1]!.toolCalls).toEqual([{ id: "c1", name: "t", arguments: { x: 1 } }]);
  });

  it.each([
    [{ ...base, baseline: undefined }, "baseline"],
    [{ ...base, candidate: "haiku" }, 'must look like "provider:model"'],
    [{ ...base, repeat: 0 }, "repeat"],
    [{ ...base, repeats: 3 }, "repeats"],
    [{ ...base, cases: [] }, "at least one case"],
    [{ ...base, cases: [{ name: "a", promt: "typo" }] }, "each case must be"],
    [{ ...base, cases: [{ name: "a", prompt: "x" }, { name: "a", prompt: "y" }] }, 'duplicate case name "a"'],
    [{ ...base, tools: [{ name: "t" }, { name: "t" }] }, 'duplicate tool "t"'],
    [{ ...base, cases: [{ name: "a", messages: [{ role: "robot", content: "x" }] }] }, "role"],
  ])("rejects invalid config %#", async (raw, message) => {
    const error = await resolveCompareConfig(raw, "/tmp", noRead).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConfigError);
    expect((error as Error).message).toContain(message);
  });

  it("reports unparseable YAML as a config error", () => {
    expect(() => parseConfigText("cases: [unclosed", "switch.yaml")).toThrow(ConfigError);
  });

  it("expands imported traffic into cases with recorded baseline samples", async () => {
    const line = JSON.stringify({
      request: { model: "gpt-4o", messages: [{ role: "user", content: "find docs" }] },
      response: { choices: [{ message: { content: null, tool_calls: [{ function: { name: "search_docs", arguments: '{"query":"docs"}' } }] } }] },
    });
    const read = async (path: string) => {
      expect(path).toBe("/proj/logs/traffic.jsonl");
      return `${line}\n\n${line}\n`;
    };
    const config = await resolveCompareConfig({ ...base, cases: [{ import: "logs/traffic.jsonl" }] }, "/proj", read);
    expect(config.cases.map((c) => c.name)).toEqual(["traffic.jsonl#1", "traffic.jsonl#3"]);
    expect(config.cases[0]!.tools).toEqual(tools);
    expect(config.cases[0]!.recorded).toEqual([{ text: null, toolCalls: [{ name: "search_docs", arguments: { query: "docs" } }], toolMode: "recorded" }]);
  });

  it("reports a missing import file as a config error", async () => {
    const read = async () => {
      throw Object.assign(new Error("nope"), { code: "ENOENT" });
    };
    await expect(resolveCompareConfig({ ...base, cases: [{ import: "missing.jsonl" }] }, "/p", read)).rejects.toThrow(/cases\[0\]\.import: cannot read missing\.jsonl: ENOENT/);
  });
});
