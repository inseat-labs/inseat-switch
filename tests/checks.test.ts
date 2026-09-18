import { describe, expect, it } from "vitest";
import type { NormalizedResponse } from "../src/adapters/normalized.js";
import { checkStructuredOutput } from "../src/checks/structured-output.js";
import { checkToolArguments } from "../src/checks/tool-arguments.js";
import { checkToolName } from "../src/checks/tool-name.js";

const lookup = {
  name: "lookup_order",
  parameters: {
    type: "object",
    properties: { orderId: { type: "string" } },
    required: ["orderId"],
    additionalProperties: false,
  },
};

const available = (toolCalls: { name: string; arguments: Record<string, unknown> }[], text: string | null = null): NormalizedResponse => ({
  available: true,
  format: "generic-v1",
  text,
  toolCalls,
});
const unavailable: NormalizedResponse = { available: false, format: "unavailable", reason: "nope" };

describe("tool-name", () => {
  it("passes when the required tool is called", () => {
    const r = checkToolName({
      tools: [lookup],
      expectations: { requiredTool: "lookup_order" },
      baseline: available([]),
      candidate: available([{ name: "lookup_order", arguments: { orderId: "1" } }]),
    });
    expect(r.status).toBe("pass");
  });

  it("falls back to the baseline's first tool when no requiredTool is set", () => {
    const r = checkToolName({
      tools: [lookup],
      expectations: {},
      baseline: available([{ name: "lookup_order", arguments: {} }]),
      candidate: available([{ name: "cancel_order", arguments: {} }]),
    });
    expect(r.status).toBe("fail");
    expect(r.reasonCode).toBe("wrong-tool");
  });

  it("is not-tested when candidate evidence is unavailable", () => {
    const r = checkToolName({ tools: [lookup], expectations: { requiredTool: "lookup_order" }, baseline: available([]), candidate: unavailable });
    expect(r.status).toBe("not-tested");
    expect(r.reasonCode).toBe("candidate-unavailable");
  });

  it("is not-tested when nothing defines an expected tool", () => {
    const r = checkToolName({ tools: [lookup], expectations: {}, baseline: available([]), candidate: available([]) });
    expect(r.status).toBe("not-tested");
    expect(r.reasonCode).toBe("no-expected-tool");
  });
});

describe("tool-arguments", () => {
  it("fails on a missing required argument", () => {
    const r = checkToolArguments({ tools: [lookup], expectations: {}, baseline: available([]), candidate: available([{ name: "lookup_order", arguments: {} }]) });
    expect(r.status).toBe("fail");
    expect(r.message).toMatch(/orderId/);
  });

  it("fails when the called tool is not defined", () => {
    const r = checkToolArguments({ tools: [lookup], expectations: {}, baseline: available([]), candidate: available([{ name: "ghost", arguments: {} }]) });
    expect(r.status).toBe("fail");
  });

  it("is not-tested when no tool declares a schema", () => {
    const r = checkToolArguments({ tools: [{ name: "free" }], expectations: {}, baseline: available([]), candidate: available([{ name: "free", arguments: { a: 1 } }]) });
    expect(r.status).toBe("not-tested");
    expect(r.reasonCode).toBe("no-parameter-schema");
  });
});

describe("structured-output", () => {
  const schema = { type: "object", properties: { total: { type: "number" } }, required: ["total"] };

  it("is not-tested without an outputSchema", () => {
    const r = checkStructuredOutput({ tools: [], expectations: {}, baseline: available([]), candidate: available([], "{}") });
    expect(r.status).toBe("not-tested");
  });

  it("fails on a type change", () => {
    const r = checkStructuredOutput({ tools: [], expectations: { outputSchema: schema }, baseline: available([]), candidate: available([], '{"total":"1"}') });
    expect(r.status).toBe("fail");
    expect(r.reasonCode).toBe("schema-violation");
  });

  it("fails when the text is not JSON", () => {
    const r = checkStructuredOutput({ tools: [], expectations: { outputSchema: schema }, baseline: available([]), candidate: available([], "Sure! The total is 1.") });
    expect(r.status).toBe("fail");
    expect(r.reasonCode).toBe("not-json");
  });

  it("passes valid JSON", () => {
    const r = checkStructuredOutput({ tools: [], expectations: { outputSchema: schema }, baseline: available([]), candidate: available([], '{"total":1}') });
    expect(r.status).toBe("pass");
  });
});
