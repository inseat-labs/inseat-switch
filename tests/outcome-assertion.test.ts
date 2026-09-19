import { describe, expect, it } from "vitest";
import type { NormalizedResponse } from "../src/adapters/normalized.js";
import { checkOutcomeAssertion } from "../src/checks/outcome-assertion.js";
import { deepEqual, resolvePath } from "../src/checks/property-path.js";
import { parseFixture } from "../src/fixtures/load.js";

const available = (text: string | null = null): NormalizedResponse => ({ available: true, format: "generic-v1", text, toolCalls: [] });
const unavailable: NormalizedResponse = { available: false, format: "unavailable", reason: "no capture" };
const base = { tools: [], baseline: available(), candidate: available() };

describe("resolvePath", () => {
  it("walks objects and arrays", () => {
    expect(resolvePath({ a: { b: [{ c: 1 }] } }, "a.b[0].c")).toEqual({ found: true, value: 1 });
  });
  it("reports where the path went missing", () => {
    expect(resolvePath({ a: {} }, "a.b.c")).toEqual({ found: false, missingAt: "a.b" });
    expect(resolvePath({ a: [1] }, "a[3]")).toEqual({ found: false, missingAt: "a[3]" });
  });
  it("distinguishes present-but-undefined from absent", () => {
    expect(resolvePath({ a: null }, "a")).toEqual({ found: true, value: null });
  });
});

describe("deepEqual", () => {
  it("compares structurally and ignores key order", () => {
    expect(deepEqual({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1 })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: "1" })).toBe(false);
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
  });
});

describe("outcome-assertion", () => {
  it("is not-tested without an assertion", () => {
    const r = checkOutcomeAssertion({ ...base, expectations: {} });
    expect(r.status).toBe("not-tested");
    expect(r.reasonCode).toBe("no-outcome-assertion");
  });

  it("is not-tested when the record is missing", () => {
    const r = checkOutcomeAssertion({ ...base, expectations: { outcome: { source: "outcome-record", exact: 1 } } });
    expect(r.status).toBe("not-tested");
    expect(r.reasonCode).toBe("no-outcome-evidence");
  });

  it("passes on exact match and fails on mismatch", () => {
    const ok = checkOutcomeAssertion({ ...base, expectations: { outcome: { source: "outcome-record", exact: { s: "x" } } }, candidateOutcome: { record: { s: "x" } } });
    expect(ok.status).toBe("pass");
    const bad = checkOutcomeAssertion({ ...base, expectations: { outcome: { source: "outcome-record", exact: { s: "x" } } }, candidateOutcome: { record: { s: "y" } } });
    expect(bad.status).toBe("fail");
    expect(bad.reasonCode).toBe("exact-mismatch");
  });

  it("uses candidate text as the record when source is candidate-text", () => {
    const r = checkOutcomeAssertion({ ...base, candidate: available('{"total":3}'), expectations: { outcome: { source: "candidate-text", paths: [{ path: "total", equals: 3 }] } } });
    expect(r.status).toBe("pass");
    const notJson = checkOutcomeAssertion({ ...base, candidate: available("three"), expectations: { outcome: { source: "candidate-text", paths: [{ path: "total", equals: 3 }] } } });
    expect(notJson.status).toBe("fail");
    expect(notJson.reasonCode).toBe("not-json");
    const noText = checkOutcomeAssertion({ ...base, candidate: unavailable, expectations: { outcome: { source: "candidate-text", exact: 1 } } });
    expect(noText.status).toBe("not-tested");
    expect(noText.reasonCode).toBe("candidate-unavailable");
  });

  it("a failing predicate outranks a missing one, and a missing one outranks passes", () => {
    const ctx = {
      ...base,
      candidateOutcome: { record: { a: 1 } },
    };
    const mixedFail = checkOutcomeAssertion({ ...ctx, expectations: { outcome: { source: "outcome-record", paths: [{ path: "a", equals: 1 }, { path: "b", equals: 1 }, { path: "a", equals: 2 }] } } });
    expect(mixedFail.status).toBe("fail");
    expect(mixedFail.reasonCode).toBe("path-mismatch");
    const mixedMissing = checkOutcomeAssertion({ ...ctx, expectations: { outcome: { source: "outcome-record", paths: [{ path: "a", equals: 1 }, { path: "b", equals: 1 }] } } });
    expect(mixedMissing.status).toBe("not-tested");
    expect(mixedMissing.reasonCode).toBe("path-not-found");
  });

  it("verifier results: missing, unavailable, fail, pass", () => {
    const want = { outcome: { source: "outcome-record" as const, verifiers: [{ kind: "test-suite" as const, name: "e2e", expect: "pass" as const }] } };
    expect(checkOutcomeAssertion({ ...base, expectations: want }).reasonCode).toBe("verifier-missing");
    expect(checkOutcomeAssertion({ ...base, expectations: want, candidateOutcome: { verifiers: [{ kind: "test-suite", name: "e2e", status: "unavailable" }] } }).reasonCode).toBe("verifier-unavailable");
    const failed = checkOutcomeAssertion({ ...base, expectations: want, candidateOutcome: { verifiers: [{ kind: "test-suite", name: "e2e", status: "fail" }] } });
    expect(failed.status).toBe("fail");
    expect(failed.reasonCode).toBe("verifier-failed");
    const passed = checkOutcomeAssertion({ ...base, expectations: want, candidateOutcome: { verifiers: [{ kind: "test-suite", name: "e2e", status: "pass" }] } });
    expect(passed.status).toBe("pass");
    expect(passed.reasonCode).toBe("outcome-satisfied");
  });

  it("never passes when only verifiers are declared and none are saved", () => {
    const r = checkOutcomeAssertion({ ...base, expectations: { outcome: { source: "outcome-record", verifiers: [{ kind: "http-status", name: "get-order", expect: "pass" }] } }, candidateOutcome: { record: { anything: true } } });
    expect(r.status).toBe("not-tested");
  });
});

describe("fixture validation of outcome assertions", () => {
  const minimal = {
    version: 1,
    name: "m",
    baseline: { provider: "p", model: "a" },
    candidate: { provider: "p", model: "b" },
    messages: [{ role: "user", content: "hi" }],
    checks: ["outcome-assertion"],
    responses: { baseline: { format: "generic-v1" }, candidate: { format: "generic-v1" } },
  };

  it("rejects an assertion with no predicate", () => {
    expect(() => parseFixture({ ...minimal, expectations: { outcome: {} } })).toThrow(/at least one of/);
  });
  it("rejects an invalid property path", () => {
    expect(() => parseFixture({ ...minimal, expectations: { outcome: { paths: [{ path: "a..b", equals: 1 }] } } })).toThrow(/path must look like/);
  });
  it("rejects a non-allowlisted verifier kind", () => {
    expect(() => parseFixture({ ...minimal, expectations: { outcome: { verifiers: [{ kind: "llm-judge", name: "x", expect: "pass" }] } } })).toThrow(/verifiers/);
  });
  it("rejects verifier results with unknown status", () => {
    expect(() => parseFixture({ ...minimal, expectations: { outcome: { exact: 1 } }, outcomeEvidence: { candidate: { verifiers: [{ kind: "test-suite", name: "x", status: "maybe" }] } } })).toThrow(/status/);
  });
});
