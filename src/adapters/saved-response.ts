import type { SavedResponse } from "../fixtures/schema.js";
import type { NormalizedResponse, NormalizedToolCall } from "./normalized.js";

export function normalizeSavedResponse(saved: SavedResponse): NormalizedResponse {
  switch (saved.format) {
    case "generic-v1":
      return {
        available: true,
        format: saved.format,
        text: saved.text ?? null,
        toolCalls: saved.toolCalls ?? [],
      };
    case "openai-chat-v1":
      return normalizeOpenAiChat(saved);
    case "unavailable":
      return { available: false, format: saved.format, reason: saved.reason };
  }
}

function normalizeOpenAiChat(
  saved: Extract<SavedResponse, { format: "openai-chat-v1" }>,
): NormalizedResponse {
  const toolCalls: NormalizedToolCall[] = [];
  for (const call of saved.message.tool_calls ?? []) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(call.function.arguments);
    } catch {
      return {
        available: false,
        format: saved.format,
        reason: `tool call "${call.function.name}" has arguments that are not valid JSON`,
      };
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {
        available: false,
        format: saved.format,
        reason: `tool call "${call.function.name}" arguments must decode to a JSON object`,
      };
    }
    toolCalls.push({ name: call.function.name, arguments: parsed as Record<string, unknown> });
  }
  return {
    available: true,
    format: saved.format,
    text: saved.message.content ?? null,
    toolCalls,
  };
}
