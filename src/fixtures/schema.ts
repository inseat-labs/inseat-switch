import { z } from "zod";
import {
  CheckIdSchema,
  ExpectationsSchema,
  ModelRefSchema,
  ToolDefinitionSchema,
  VerifierKindSchema,
} from "../config/schema.js";

export const MessageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z.string(),
});

const GenericToolCallSchema = z.object({
  name: z.string().min(1),
  arguments: z.record(z.string(), z.unknown()),
});

export const GenericSavedResponseSchema = z.object({
  format: z.literal("generic-v1"),
  text: z.string().optional(),
  toolCalls: z.array(GenericToolCallSchema).optional(),
});

export const OpenAiChatSavedResponseSchema = z.object({
  format: z.literal("openai-chat-v1"),
  message: z.object({
    content: z.string().nullable().optional(),
    tool_calls: z
      .array(
        z.object({
          type: z.literal("function"),
          function: z.object({
            name: z.string(),
            arguments: z.string(),
          }),
        }),
      )
      .optional(),
  }),
});

export const UnavailableSavedResponseSchema = z.object({
  format: z.literal("unavailable"),
  reason: z.string().min(1),
});

export const SavedResponseSchema = z.discriminatedUnion("format", [
  GenericSavedResponseSchema,
  OpenAiChatSavedResponseSchema,
  UnavailableSavedResponseSchema,
]);
export type SavedResponse = z.infer<typeof SavedResponseSchema>;

export const VerifierResultSchema = z.object({
  kind: VerifierKindSchema,
  name: z.string().min(1),
  status: z.enum(["pass", "fail", "unavailable"]),
  detail: z.string().optional(),
});
export type VerifierResult = z.infer<typeof VerifierResultSchema>;

export const OutcomeEvidenceSchema = z.object({
  record: z.unknown().optional(),
  verifiers: z.array(VerifierResultSchema).optional(),
});
export type OutcomeEvidence = z.infer<typeof OutcomeEvidenceSchema>;

export const FixtureSchema = z.object({
  version: z.literal(1),
  name: z.string().min(1),
  description: z.string().optional(),
  baseline: ModelRefSchema,
  candidate: ModelRefSchema,
  messages: z.array(MessageSchema).min(1),
  tools: z.array(ToolDefinitionSchema).default([]),
  expectations: ExpectationsSchema.default({}),
  checks: z.array(CheckIdSchema).min(1),
  responses: z.object({
    baseline: SavedResponseSchema,
    candidate: SavedResponseSchema,
  }),
  outcomeEvidence: z
    .object({
      candidate: OutcomeEvidenceSchema.optional(),
    })
    .optional(),
});
export type Fixture = z.infer<typeof FixtureSchema>;
