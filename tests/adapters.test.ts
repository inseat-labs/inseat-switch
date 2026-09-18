import { describe, expect, it } from "vitest";
import { normalizeSavedResponse } from "../src/adapters/saved-response.js";

describe("normalizeSavedResponse", () => {
  it("passes generic-v1 through", () => {
    const n = normalizeSavedResponse({
      format: "generic-v1",
      text: "ok",
      toolCalls: [{ name: "a", arguments: { x: 1 } }],
    });
    expect(n).toEqual({ available: true, format: "generic-v1", text: "ok", toolCalls: [{ name: "a", arguments: { x: 1 } }] });
  });

  it("decodes openai-chat-v1 stringified arguments", () => {
    const n = normalizeSavedResponse({
      format: "openai-chat-v1",
      message: { content: null, tool_calls: [{ type: "function", function: { name: "a", arguments: '{"x":1}' } }] },
    });
    expect(n.available).toBe(true);
    if (n.available) expect(n.toolCalls[0]?.arguments).toEqual({ x: 1 });
  });

  it("marks openai-chat-v1 with malformed argument JSON as unavailable", () => {
    const n = normalizeSavedResponse({
      format: "openai-chat-v1",
      message: { tool_calls: [{ type: "function", function: { name: "a", arguments: "{oops" } }] },
    });
    expect(n.available).toBe(false);
  });

  it("marks unavailable responses as unavailable with the reason", () => {
    const n = normalizeSavedResponse({ format: "unavailable", reason: "no capture" });
    expect(n).toEqual({ available: false, format: "unavailable", reason: "no capture" });
  });
});
