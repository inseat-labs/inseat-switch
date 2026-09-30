import { describe, expect, it } from "vitest";
import { looksLikeClarification, looksLikeRefusal, toBehavior, validateToolCalls } from "../src/compare/behavior.js";
import { call, out } from "./helpers.js";

describe("behavior heuristics", () => {
  it.each([
    ["Which date works for the meeting?", true],
    ["Sure. Who should I send it to? 🙂", true],
    ["Could you please provide the recipient's email address.", true],
    ["I need to know the date before I can schedule this.", true],
    ["Here are the results. Let me know if you need anything else.", false],
    ["Done.", false],
  ])("clarification: %s", (text, expected) => {
    expect(looksLikeClarification(text)).toBe(expected);
  });

  it.each([
    ["I can't help with that request.", true],
    ["I'm unable to assist with this.", true],
    ["I can't schedule it without a date.", false],
    ["Sent the email.", false],
  ])("refusal: %s", (text, expected) => {
    expect(looksLikeRefusal(text)).toBe(expected);
  });

  it("does not treat a reply with a tool call as asking or refusing", () => {
    const b = toBehavior(out([call("send_email", { to: "a" })], "Anything else?"), []);
    expect(b.asksClarification).toBe(false);
    expect(b.refused).toBe(false);
  });

  it("validates arguments against the tool schema and flags unknown tools", () => {
    const tools = [{ name: "search", parameters: { type: "object", properties: { limit: { type: "integer" } }, required: ["query"] } }];
    expect(validateToolCalls([call("search", { query: "a", limit: 2 })], tools)).toEqual([]);
    expect(validateToolCalls([call("search", { limit: "2" })], tools).join(" ")).toMatch(/query.*limit must be integer|limit must be integer.*query/);
    expect(validateToolCalls([call("nope")], tools)).toEqual(['"nope" is not a defined tool']);
  });
});
