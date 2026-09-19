import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FixtureLoadError, loadFixture } from "../src/fixtures/load.js";
import { runFixture } from "../src/runner/run.js";
import { buildJsonReport } from "../src/report/json.js";
import { renderTextReport } from "../src/report/text.js";

const dir = join(import.meta.dirname, "..", "examples", "fixtures");

const expected: Record<string, "pass" | "fail" | "not-tested"> = {
  "same-tool-valid-arguments": "pass",
  "wrong-tool-selected": "fail",
  "missing-required-argument": "fail",
  "candidate-evidence-unavailable": "not-tested",
  "structured-output-type-change": "fail",
  "tool-passes-outcome-fails": "fail",
  "outcome-passes": "pass",
  "outcome-evidence-missing": "not-tested",
  "outcome-path-missing": "not-tested",
  "verifier-unavailable": "not-tested",
};

describe("example fixtures", () => {
  it("every example produces its documented overall result", async () => {
    const files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
    expect(files.length).toBe(Object.keys(expected).length);
    for (const file of files) {
      const result = runFixture(await loadFixture(join(dir, file)));
      expect(result.summary.overall, file).toBe(expected[result.fixture]);
    }
  });

  it("never reports pass when candidate evidence is unavailable", async () => {
    const result = runFixture(await loadFixture(join(dir, "04-candidate-evidence-unavailable.json")));
    expect(result.checks.every((c) => c.status === "not-tested")).toBe(true);
    expect(result.summary.pass).toBe(0);
  });

  it("tool and schema checks can pass while the business outcome fails", async () => {
    const result = runFixture(await loadFixture(join(dir, "06-tool-passes-outcome-fails.json")));
    const byCheck = Object.fromEntries(result.checks.map((c) => [c.check, c.status]));
    expect(byCheck).toEqual({ "tool-name": "pass", "tool-arguments": "pass", "outcome-assertion": "fail" });
    expect(result.summary.overall).toBe("fail");
  });

  it("every invalid example fails fixture validation", async () => {
    const invalidDir = join(import.meta.dirname, "..", "examples", "invalid");
    const files = (await readdir(invalidDir)).filter((f) => f.endsWith(".json"));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      await expect(loadFixture(join(invalidDir, file)), file).rejects.toBeInstanceOf(FixtureLoadError);
    }
  });

  it("renders a text report with totals", async () => {
    const result = runFixture(await loadFixture(join(dir, "02-wrong-tool-selected.json")));
    const text = renderTextReport(buildJsonReport([result], "test", new Date(0)));
    expect(text).toContain("FAIL  wrong-tool-selected");
    expect(text).toContain("wrong-tool");
    expect(text).toContain("1 case(s)");
  });
});
