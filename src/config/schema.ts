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

export const ExpectationsSchema = z.object({
  requiredTool: z.string().optional(),
  outputSchema: JsonSchemaObject.optional(),
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
