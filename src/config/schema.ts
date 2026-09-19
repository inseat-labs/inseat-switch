import { z } from "zod";
import { ALL_CHECK_IDS } from "../checks/types.js";

export const ModelRefSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  label: z.string().optional(),
});
export type ModelRef = z.infer<typeof ModelRefSchema>;

export const JsonSchemaObject = z.record(z.string(), z.unknown());

export const ToolDefinitionSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  parameters: JsonSchemaObject.optional(),
});
export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;

export const CheckIdSchema = z.enum(ALL_CHECK_IDS as [string, ...string[]]);

export const ALLOWED_VERIFIER_KINDS = ["command-exit-code", "test-suite", "http-status", "boolean-predicate"] as const;
export const VerifierKindSchema = z.enum(ALLOWED_VERIFIER_KINDS);
export type VerifierKind = z.infer<typeof VerifierKindSchema>;

export const PROPERTY_PATH_PATTERN = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*|\[\d+\])*$/;
export const PropertyPathSchema = z.string().regex(PROPERTY_PATH_PATTERN, "path must look like a.b[0].c");

export const PathPredicateSchema = z.object({
  path: PropertyPathSchema,
  equals: z.unknown(),
});

export const VerifierExpectationSchema = z.object({
  kind: VerifierKindSchema,
  name: z.string().min(1),
  expect: z.literal("pass"),
});

export const OutcomeAssertionSchema = z
  .object({
    source: z.enum(["outcome-record", "candidate-text"]).default("outcome-record"),
    exact: z.unknown().optional(),
    schema: JsonSchemaObject.optional(),
    paths: z.array(PathPredicateSchema).min(1).optional(),
    verifiers: z.array(VerifierExpectationSchema).min(1).optional(),
  })
  .refine(
    (a) => a.exact !== undefined || a.schema !== undefined || a.paths !== undefined || a.verifiers !== undefined,
    { message: "outcome assertion must declare at least one of exact, schema, paths, verifiers" },
  );
export type OutcomeAssertion = z.infer<typeof OutcomeAssertionSchema>;

export const ExpectationsSchema = z.object({
  requiredTool: z.string().optional(),
  outputSchema: JsonSchemaObject.optional(),
  outcome: OutcomeAssertionSchema.optional(),
});
export type Expectations = z.infer<typeof ExpectationsSchema>;

export const ProjectConfigSchema = z.object({
  version: z.literal(1),
  name: z.string().min(1),
  baseline: ModelRefSchema,
  candidate: ModelRefSchema,
  tools: z.array(ToolDefinitionSchema).default([]),
  checks: z.array(CheckIdSchema).min(1).default([...ALL_CHECK_IDS]),
});
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;
