#!/usr/bin/env node
import { readFile, realpath } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { FixtureLoadError, loadFixture } from "../fixtures/load.js";
import { buildJsonReport } from "../report/json.js";
import { renderTextReport } from "../report/text.js";
import { runFixture, type CaseResult } from "../runner/run.js";

const USAGE = `inseat-switch — offline model-migration compatibility checker

Usage:
  inseat-switch check <fixture.json>... [--json] [--allow-fail]
  inseat-switch --help

Options:
  --json         Emit the machine-readable report instead of text.
  --allow-fail   Exit 0 even when a check fails (fixture load errors still exit 2).

Exit codes:
  0  no failing checks
  1  at least one check failed
  2  usage error or a fixture could not be loaded
`;

async function packageVersion(): Promise<string> {
  try {
    const url = new URL("../../package.json", import.meta.url);
    const pkg = JSON.parse(await readFile(fileURLToPath(url), "utf8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

export async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  if (!command || command === "--help" || command === "-h") {
    process.stdout.write(USAGE);
    return command ? 0 : 2;
  }
  if (command !== "check") {
    process.stderr.write(`unknown command: ${command}\n\n${USAGE}`);
    return 2;
  }

  const json = rest.includes("--json");
  const allowFail = rest.includes("--allow-fail");
  const paths = rest.filter((a) => !a.startsWith("--"));
  if (paths.length === 0) {
    process.stderr.write(`check requires at least one fixture path\n\n${USAGE}`);
    return 2;
  }

  const cases: CaseResult[] = [];
  for (const path of paths) {
    try {
      cases.push(runFixture(await loadFixture(path)));
    } catch (error) {
      if (error instanceof FixtureLoadError) {
        process.stderr.write(`${error.message}\n`);
        return 2;
      }
      throw error;
    }
  }

  const report = buildJsonReport(cases, await packageVersion());
  process.stdout.write(json ? JSON.stringify(report, null, 2) + "\n" : renderTextReport(report) + "\n");

  if (report.totals.fail > 0 && !allowFail) return 1;
  return 0;
}

const entry = process.argv[1] ? await realpath(process.argv[1]).catch(() => null) : null;
if (entry && entry === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error) => {
      process.stderr.write(`${(error as Error).stack ?? error}\n`);
      process.exit(2);
    },
  );
}
