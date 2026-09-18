import { describe, expect, it } from "vitest";
import { parseFixture, FixtureLoadError } from "../src/fixtures/load.js";

const minimal = {
  version: 1,
  name: "m",
  baseline: { provider: "p", model: "a" },
  candidate: { provider: "p", model: "b" },
  messages: [{ role: "user", content: "hi" }],
  checks: ["tool-name"],
  responses: {
    baseline: { format: "generic-v1" },
    candidate: { format: "generic-v1" },
  },
};

describe("parseFixture", () => {
  it("accepts a minimal valid fixture and applies defaults", () => {
    const fixture = parseFixture(minimal);
    expect(fixture.tools).toEqual([]);
    expect(fixture.expectations).toEqual({});
  });

  it("rejects an unknown fixture version", () => {
    expect(() => parseFixture({ ...minimal, version: 2 })).toThrow(FixtureLoadError);
  });

  it("rejects an unknown check id", () => {
    expect(() => parseFixture({ ...minimal, checks: ["vibes"] })).toThrow(/checks/);
  });

  it("rejects an unknown saved response format", () => {
    const bad = { ...minimal, responses: { ...minimal.responses, candidate: { format: "mystery" } } };
    expect(() => parseFixture(bad)).toThrow(FixtureLoadError);
  });

  it("requires a reason for unavailable responses", () => {
    const bad = { ...minimal, responses: { ...minimal.responses, candidate: { format: "unavailable" } } };
    expect(() => parseFixture(bad)).toThrow(/reason/);
  });
});
