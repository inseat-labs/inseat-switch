import { describe, expect, it } from "vitest";
import { createProvider } from "../src/providers/index.js";
import { AnthropicProvider, toAnthropicRequest } from "../src/providers/anthropic.js";
import { OpenAiProvider } from "../src/providers/openai.js";
import type { FetchLike } from "../src/providers/types.js";

function fakeFetch(status: number, body: unknown) {
  const requests: { url: string; headers: Record<string, string>; body: unknown }[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    requests.push({ url, headers: init.headers, body: JSON.parse(init.body) });
    return { ok: status < 400, status, text: async () => JSON.stringify(body) };
  };
  return { fetchImpl, requests };
}

const tools = [{ name: "search_docs", description: "Search", parameters: { type: "object", properties: { query: { type: "string" } } } }];
const request = { model: "m", system: "sys", messages: [{ role: "user" as const, content: "find x" }], tools };

describe("OpenAI-compatible provider", () => {
  it("sends native tools and parses tool calls", async () => {
    const { fetchImpl, requests } = fakeFetch(200, {
      choices: [{ message: { content: null, tool_calls: [{ id: "1", type: "function", function: { name: "search_docs", arguments: '{"query":"x"}' } }] } }],
    });
    const provider = new OpenAiProvider("gpt-test", { OPENAI_API_KEY: "sk-secret", OPENAI_BASE_URL: "http://localhost:1234/v1/" }, fetchImpl);
    const result = await provider.call(request);
    expect(result).toEqual({ text: null, toolCalls: [{ name: "search_docs", arguments: { query: "x" } }], toolMode: "native" });
    expect(requests[0]!.url).toBe("http://localhost:1234/v1/chat/completions");
    expect(requests[0]!.headers.authorization).toBe("Bearer sk-secret");
    expect(requests[0]!.body).toMatchObject({
      model: "m",
      messages: [{ role: "system", content: "sys" }, { role: "user", content: "find x" }],
      tools: [{ type: "function", function: { name: "search_docs" } }],
    });
  });

  it("fails preflight without a key or base URL and never echoes keys in errors", async () => {
    await expect(new OpenAiProvider("m", {}).preflight()).rejects.toThrow(/OPENAI_API_KEY/);
    const { fetchImpl } = fakeFetch(401, { error: "bad key" });
    const error = await new OpenAiProvider("m", { OPENAI_API_KEY: "sk-secret" }, fetchImpl).call(request).catch((e: Error) => e);
    expect((error as Error).message).toContain("HTTP 401");
    expect((error as Error).message).not.toContain("sk-secret");
  });
});

describe("Anthropic provider", () => {
  it("sends native tools and parses tool_use blocks", async () => {
    const { fetchImpl, requests } = fakeFetch(200, { content: [{ type: "text", text: "Searching." }, { type: "tool_use", id: "t", name: "search_docs", input: { query: "x" } }] });
    const result = await new AnthropicProvider("claude-test", { ANTHROPIC_API_KEY: "k" }, fetchImpl).call(request);
    expect(result).toEqual({ text: "Searching.", toolCalls: [{ name: "search_docs", arguments: { query: "x" } }], toolMode: "native" });
    expect(requests[0]!.headers["x-api-key"]).toBe("k");
    expect(requests[0]!.body).toMatchObject({ system: "sys", tools: [{ name: "search_docs", input_schema: tools[0]!.parameters }] });
  });

  it("maps tool results into user tool_result blocks", () => {
    const body = toAnthropicRequest({
      model: "m",
      messages: [
        { role: "user", content: "a" },
        { role: "assistant", content: null, toolCalls: [{ name: "search_docs", arguments: { query: "a" } }] },
        { role: "tool", content: "result" },
      ],
      tools: [],
    });
    expect(body.messages).toEqual([
      { role: "user", content: [{ type: "text", text: "a" }] },
      { role: "assistant", content: [{ type: "tool_use", id: "call_0", name: "search_docs", input: { query: "a" } }] },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "call_0", content: "result" }] },
    ]);
  });

  it("fails preflight without ANTHROPIC_API_KEY", async () => {
    await expect(new AnthropicProvider("m", {}).preflight()).rejects.toThrow(/ANTHROPIC_API_KEY/);
  });
});

describe("createProvider", () => {
  it("builds known providers and rejects unknown ones", () => {
    expect(createProvider("claude-cli:haiku").id).toBe("claude-cli:haiku");
    expect(createProvider("openai:gpt-4.1").model).toBe("gpt-4.1");
    expect(() => createProvider("gemini:pro")).toThrow(/unknown provider "gemini"/);
  });
});
