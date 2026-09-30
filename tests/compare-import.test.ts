import { describe, expect, it } from "vitest";
import { ImportError, parseImportJsonl } from "../src/compare/import.js";

describe("parseImportJsonl", () => {
  it("accepts {request, response} lines", () => {
    const line = JSON.stringify({
      request: {
        model: "gpt-4o",
        messages: [{ role: "system", content: "sys" }, { role: "user", content: [{ type: "text", text: "hi" }] }],
        tools: [{ type: "function", function: { name: "t", parameters: { type: "object" } } }],
      },
      response: { choices: [{ message: { role: "assistant", content: "hello" } }] },
    });
    const [record] = parseImportJsonl(line);
    expect(record).toEqual({
      line: 1,
      messages: [{ role: "system", content: "sys" }, { role: "user", content: "hi" }],
      tools: [{ name: "t", parameters: { type: "object" } }],
      recorded: { text: "hello", toolCalls: [], toolMode: "recorded" },
    });
  });

  it("accepts bare {messages, tools, response} lines without a response", () => {
    const records = parseImportJsonl(`${JSON.stringify({ messages: [{ role: "user", content: "a" }] })}\n`);
    expect(records[0]).toMatchObject({ tools: null, recorded: null });
  });

  it("keeps recorded responses with malformed arguments as unparseable samples", () => {
    const line = JSON.stringify({
      messages: [{ role: "user", content: "a" }],
      response: { choices: [{ message: { content: null, tool_calls: [{ function: { name: "t", arguments: "{oops" } }] } }] },
    });
    expect(parseImportJsonl(line)[0]!.recorded?.unparseable?.reason).toContain("not valid JSON");
  });

  it("reports the file and line for invalid records", () => {
    expect(() => parseImportJsonl(`{"messages":[{"role":"user","content":"a"}]}\nnot json`, "log.jsonl")).toThrow(new ImportError("log.jsonl:2: line is not valid JSON"));
    expect(() => parseImportJsonl(`{"messages":[]}`, "log.jsonl")).toThrow(/log\.jsonl:1: messages must be a non-empty array/);
    expect(() => parseImportJsonl("\n\n", "log.jsonl")).toThrow(/no records/);
  });
});
