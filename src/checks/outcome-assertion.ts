import { ALLOWED_VERIFIER_KINDS, type OutcomeAssertion } from "../config/schema.js";
import type { VerifierResult } from "../fixtures/schema.js";
import type { CheckContext } from "./context.js";
import { validateAgainstSchema } from "./json-schema.js";
import { deepEqual, resolvePath } from "./property-path.js";
import { fail, notTested, pass, type CheckResult, type CheckStatus } from "./types.js";

const CHECK = "outcome-assertion";

interface Finding {
  status: CheckStatus;
  reasonCode: string;
  message: string;
}

export function checkOutcomeAssertion(ctx: CheckContext): CheckResult {
  const assertion = ctx.expectations.outcome;
  if (!assertion) {
    return notTested(CHECK, "no-outcome-assertion", "no expectations.outcome configured");
  }

  const findings: Finding[] = [];
  const needsRecord = assertion.exact !== undefined || assertion.schema !== undefined || assertion.paths !== undefined;

  let record: unknown;
  if (needsRecord) {
    const loaded = loadRecord(ctx, assertion);
    if (loaded.kind === "finding") {
      findings.push(loaded.finding);
    } else {
      record = loaded.value;
      findings.push(...evaluateRecord(record, assertion));
    }
  }

  if (assertion.verifiers) {
    findings.push(...evaluateVerifiers(assertion.verifiers, ctx.candidateOutcome?.verifiers));
  }

  const worst = findings.find((f) => f.status === "fail") ?? findings.find((f) => f.status === "not-tested");
  if (worst) {
    const same = findings.filter((f) => f.status === worst.status);
    const make = worst.status === "fail" ? fail : notTested;
    return make(CHECK, worst.reasonCode, same.map((f) => f.message).join("; "), record !== undefined ? { observed: record } : {});
  }
  return pass(CHECK, "outcome-satisfied", findings.map((f) => f.message).join("; "), record !== undefined ? { observed: record } : {});
}

type Loaded = { kind: "value"; value: unknown } | { kind: "finding"; finding: Finding };

function loadRecord(ctx: CheckContext, assertion: OutcomeAssertion): Loaded {
  if (assertion.source === "candidate-text") {
    if (!ctx.candidate.available) {
      return finding("not-tested", "candidate-unavailable", ctx.candidate.reason);
    }
    if (ctx.candidate.text === null || ctx.candidate.text.trim() === "") {
      return finding("not-tested", "no-outcome-evidence", "candidate produced no text to use as outcome evidence");
    }
    try {
      return { kind: "value", value: JSON.parse(ctx.candidate.text) };
    } catch (error) {
      return finding("fail", "not-json", `candidate text is not valid JSON: ${(error as Error).message}`);
    }
  }
  const record = ctx.candidateOutcome?.record;
  if (record === undefined) {
    return finding("not-tested", "no-outcome-evidence", "outcomeEvidence.candidate.record is absent");
  }
  return { kind: "value", value: record };
}

function evaluateRecord(record: unknown, assertion: OutcomeAssertion): Finding[] {
  const out: Finding[] = [];
  if (assertion.exact !== undefined) {
    out.push(
      deepEqual(record, assertion.exact)
        ? { status: "pass", reasonCode: "exact-matched", message: "outcome equals expected value" }
        : { status: "fail", reasonCode: "exact-mismatch", message: `outcome ${JSON.stringify(record)} does not equal expected ${JSON.stringify(assertion.exact)}` },
    );
  }
  if (assertion.schema !== undefined) {
    const result = validateAgainstSchema(assertion.schema, record);
    out.push(
      result.valid
        ? { status: "pass", reasonCode: "schema-valid", message: "outcome matched schema" }
        : { status: "fail", reasonCode: "schema-violation", message: result.errors.join("; ") },
    );
  }
  for (const predicate of assertion.paths ?? []) {
    const lookup = resolvePath(record, predicate.path);
    if (!lookup.found) {
      out.push({ status: "not-tested", reasonCode: "path-not-found", message: `path "${predicate.path}" is absent (missing at "${lookup.missingAt}")` });
      continue;
    }
    out.push(
      deepEqual(lookup.value, predicate.equals)
        ? { status: "pass", reasonCode: "path-matched", message: `"${predicate.path}" equals ${JSON.stringify(predicate.equals)}` }
        : { status: "fail", reasonCode: "path-mismatch", message: `"${predicate.path}" is ${JSON.stringify(lookup.value)}, expected ${JSON.stringify(predicate.equals)}` },
    );
  }
  return out;
}

function evaluateVerifiers(expected: NonNullable<OutcomeAssertion["verifiers"]>, saved: VerifierResult[] | undefined): Finding[] {
  return expected.map((want) => {
    if (!(ALLOWED_VERIFIER_KINDS as readonly string[]).includes(want.kind)) {
      return { status: "not-tested", reasonCode: "verifier-not-allowlisted", message: `verifier kind "${want.kind}" is not allowlisted` };
    }
    const got = saved?.find((v) => v.kind === want.kind && v.name === want.name);
    if (!got) {
      return { status: "not-tested", reasonCode: "verifier-missing", message: `no saved result for verifier ${want.kind}/${want.name}` };
    }
    if (got.status === "unavailable") {
      return { status: "not-tested", reasonCode: "verifier-unavailable", message: `verifier ${want.kind}/${want.name} reported unavailable${got.detail ? `: ${got.detail}` : ""}` };
    }
    if (got.status === "fail") {
      return { status: "fail", reasonCode: "verifier-failed", message: `verifier ${want.kind}/${want.name} failed${got.detail ? `: ${got.detail}` : ""}` };
    }
    return { status: "pass", reasonCode: "verifier-passed", message: `verifier ${want.kind}/${want.name} passed` };
  });
}

function finding(status: CheckStatus, reasonCode: string, message: string): Loaded {
  return { kind: "finding", finding: { status, reasonCode, message } };
}
