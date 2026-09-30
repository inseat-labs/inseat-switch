import { describe, expect, it } from "vitest";
import { toBehavior } from "../src/compare/behavior.js";
import { diffBehaviors, direction } from "../src/compare/diff.js";
import { acts, behavior, call, out, times } from "./helpers.js";

const categories = (d: ReturnType<typeof diffBehaviors>) => d.findings.map((f) => f.category);

describe("direction", () => {
  it("requires a strict majority on one side and a strict minority on the other", () => {
    expect(direction({ count: 0, total: 3 }, { count: 2, total: 3 })).toBe("added");
    expect(direction({ count: 3, total: 3 }, { count: 1, total: 3 })).toBe("dropped");
    expect(direction({ count: 1, total: 3 }, { count: 0, total: 3 })).toBe("flaky");
    expect(direction({ count: 1, total: 2 }, { count: 2, total: 2 })).toBe("flaky");
    expect(direction({ count: 2, total: 3 }, { count: 2, total: 3 })).toBe("same");
    expect(direction({ count: 2, total: 4 }, { count: 1, total: 2 })).toBe("same");
  });
});

describe("diffBehaviors", () => {
  it("reports same for identical behavior", () => {
    const d = diffBehaviors(times(3, acts(call("lookup", { id: "1" }))), times(3, acts(call("lookup", { id: "1" }))));
    expect(d).toEqual({ status: "same", findings: [], flaky: [] });
  });

  it("classifies a consistently dropped tool as a regression", () => {
    const d = diffBehaviors(times(3, acts(call("cancel_order", { id: "1" }))), times(3, behavior({ text: "Done, your order is cancelled." })));
    expect(d.status).toBe("regression");
    expect(d.findings).toEqual([{ category: "tool-dropped", severity: "regression", detail: "cancel_order", evidence: "3/3 -> 0/3" }]);
  });

  it("marks a difference seen in a minority of samples as flaky, not a regression", () => {
    const base = times(3, acts(call("cancel_order")));
    const cand = [acts(call("cancel_order")), acts(call("cancel_order")), behavior({ text: "ok" })];
    const d = diffBehaviors(base, cand);
    expect(d.status).toBe("flaky");
    expect(d.findings).toEqual([]);
    expect(d.flaky).toContainEqual({ feature: "tool cancel_order", evidence: "3/3 -> 2/3" });
  });

  it("treats exactly half of the samples as undecided", () => {
    const d = diffBehaviors([acts(call("a")), behavior({ text: "x" })], times(2, acts(call("a"))));
    expect(d.status).toBe("flaky");
  });

  it("pairs a dropped and an added tool into tool-switched", () => {
    const d = diffBehaviors(times(3, acts(call("search_docs", { query: "q" }))), times(3, acts(call("send_email", { to: "a" }))));
    expect(categories(d)).toEqual(["tool-switched"]);
    expect(d.findings[0]!.detail).toBe("search_docs -> send_email");
    expect(d.status).toBe("regression");
  });

  it("reports an added tool as a change", () => {
    const d = diffBehaviors(times(2, acts(call("a"))), times(2, acts(call("a"), call("b"))));
    expect(d.findings).toEqual([{ category: "tool-added", severity: "change", detail: "b", evidence: "0/2 -> 2/2" }]);
    expect(d.status).toBe("change");
  });

  it("reports an invented optional argument with its value", () => {
    const d = diffBehaviors(times(3, acts(call("lookup", { id: "1" }))), times(3, acts(call("lookup", { id: "1", includeItems: true }))));
    expect(d.findings).toEqual([{ category: "arg-added", severity: "change", detail: "lookup.includeItems=true", evidence: "0/3 -> 3/3" }]);
  });

  it("reports a removed argument", () => {
    const d = diffBehaviors(times(3, acts(call("lookup", { id: "1", limit: 5 }))), times(3, acts(call("lookup", { id: "1" }))));
    expect(d.findings.map((f) => [f.category, f.detail])).toEqual([["arg-removed", "lookup.limit"]]);
  });

  it("reports a stable argument value that changed consistently", () => {
    const d = diffBehaviors(times(3, acts(call("event", { duration: 30 }))), times(3, acts(call("event", { duration: 60 }))));
    expect(d.findings).toEqual([{ category: "arg-value-changed", severity: "change", detail: "event.duration: 30 -> 60", evidence: "3/3 -> 3/3" }]);
  });

  it("ignores case and whitespace differences in values", () => {
    const d = diffBehaviors(times(2, acts(call("email", { to: "Ann@x.com" }))), times(2, acts(call("email", { to: " ann@x.com" }))));
    expect(d.status).toBe("same");
  });

  it("does not compare free-text values that already vary on the baseline", () => {
    const base = [acts(call("email", { body: "Hi Ann" })), acts(call("email", { body: "Hello Ann" })), acts(call("email", { body: "Dear Ann" }))];
    const cand = [acts(call("email", { body: "Hey" })), acts(call("email", { body: "Hey" })), acts(call("email", { body: "Hey" }))];
    expect(diffBehaviors(base, cand).status).toBe("same");
  });

  it("does not compare stable free-text values containing spaces", () => {
    const d = diffBehaviors(times(2, acts(call("search", { query: "rate limit orders" }))), times(2, acts(call("search", { query: "orders rate limit" }))));
    expect(d.status).toBe("same");
    const ids = diffBehaviors(times(2, acts(call("event", { attendees: ["a@x.io"] }))), times(2, acts(call("event", { attendees: ["b@x.io"] }))));
    expect(ids.findings.map((f) => f.category)).toEqual(["arg-value-changed"]);
  });

  it("marks a stable baseline value that varies on the candidate as flaky", () => {
    const base = times(3, acts(call("event", { duration: 30 })));
    const cand = [acts(call("event", { duration: 30 })), acts(call("event", { duration: 45 })), acts(call("event", { duration: 60 }))];
    const d = diffBehaviors(base, cand);
    expect(d.status).toBe("flaky");
    expect(d.flaky).toEqual([{ feature: "value event.duration=30", evidence: "3/3 -> 1/3" }]);
  });

  it("flags acting when the baseline asked for missing details", () => {
    const d = diffBehaviors(
      times(2, behavior({ text: "What date should I use?", asksClarification: true })),
      times(2, acts(call("create_event", { title: "Sync" }))),
    );
    expect(categories(d)).toEqual(["acted-instead-of-asking"]);
    expect(d.findings[0]!.severity).toBe("regression");
    expect(d.findings[0]!.detail).toContain("create_event");
  });

  it("flags asking when the baseline acted", () => {
    const d = diffBehaviors(times(3, acts(call("send_email"))), times(3, behavior({ text: "Who should I send it to?", asksClarification: true })));
    expect(categories(d)).toEqual(["asked-instead-of-acting"]);
    expect(d.status).toBe("change");
  });

  it("flags consistently invalid arguments", () => {
    const tools = [{ name: "lookup", parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } }];
    const d = diffBehaviors(times(2, toBehavior(out([call("lookup", { id: "1" })]), tools)), times(2, toBehavior(out([call("lookup", { id: 1 })]), tools)));
    expect(categories(d)).toContain("args-invalid");
    expect(d.findings.find((f) => f.category === "args-invalid")!.detail).toContain("/id must be string");
    expect(d.status).toBe("regression");
  });

  it("flags a new refusal", () => {
    const d = diffBehaviors(times(2, behavior({ text: "Here is the summary." })), times(2, behavior({ text: "I can't help with that.", refused: true })));
    expect(categories(d)).toEqual(["refused"]);
    expect(d.status).toBe("regression");
  });

  it("flags consistently unparseable candidate output", () => {
    const d = diffBehaviors(times(2, acts(call("a"))), times(2, behavior({ unparseable: true, text: "sure!" })));
    expect(categories(d)).toContain("output-unparseable");
    expect(d.status).toBe("regression");
  });

  it("does not report a lost clarification that is only a parsing failure", () => {
    const d = diffBehaviors(times(2, behavior({ text: "Which date?", asksClarification: true })), times(2, behavior({ unparseable: true, text: "{oops" })));
    expect(categories(d)).toEqual(["output-unparseable"]);
  });

  it("reports a much shorter reply as info only", () => {
    const long = "x".repeat(400);
    const d = diffBehaviors(times(2, behavior({ text: long })), times(2, behavior({ text: "x".repeat(100) })));
    expect(d.findings.map((f) => [f.category, f.severity])).toEqual([["text-only-change", "info"]]);
    expect(d.status).toBe("info");
  });

  it("returns error when a side has no usable samples", () => {
    expect(diffBehaviors([], times(2, acts(call("a")))).status).toBe("error");
  });
});
