import { validateAgainstSchema } from "../checks/json-schema.js";
import type { ProviderOutput, ToolCall, ToolSpec } from "./types.js";

export interface Behavior {
  toolCalls: ToolCall[];
  text: string | null;
  asksClarification: boolean;
  refused: boolean;
  argsValid: boolean;
  argErrors: string[];
  unparseable: boolean;
}

const CLARIFYING =
  /\b(could you|can you|would you|please (provide|confirm|clarify|specify|share|let me know|tell me)|which (one|of|date|day|time|email|address|recipient)|what (date|day|time|email|address|subject|should)|who (should|would|do you)|do you want|would you like|did you mean|I need (to know|a few|more|the|a )|to confirm)\b/i;
const STRONG_CLARIFYING =
  /\b(could you (please )?(provide|confirm|clarify|specify|tell me|share)|please (provide|confirm|clarify|specify)|I need (to know|more (info|information|details))|can you clarify)\b/i;
const REFUSAL =
  /\b(?:I(?: am|'m|’m) (?:unable|not able) to|I (?:cannot|can't|can’t|won't|won’t|will not)) (?:help|assist|do that|comply|fulfil|fulfill)\b|\bagainst (?:my|our|the) (?:policy|policies|guidelines)\b|\bI must decline\b/i;

/** Heuristic: no tool call and the reply asks the user something back. */
export function looksLikeClarification(text: string | null): boolean {
  if (!text) return false;
  const trimmed = text.trim().replace(/[\s\p{Extended_Pictographic}*_)"'`]+$/u, "");
  if (trimmed.endsWith("?")) return true;
  if (STRONG_CLARIFYING.test(trimmed)) return true;
  return trimmed.includes("?") && CLARIFYING.test(trimmed);
}

/** Heuristic: no tool call and the reply declines the request. */
export function looksLikeRefusal(text: string | null): boolean {
  return !!text && REFUSAL.test(text);
}

export function validateToolCalls(calls: ToolCall[], tools: ToolSpec[]): string[] {
  const errors: string[] = [];
  for (const call of calls) {
    const tool = tools.find((t) => t.name === call.name);
    if (!tool) {
      errors.push(`"${call.name}" is not a defined tool`);
      continue;
    }
    if (!tool.parameters) continue;
    const result = validateAgainstSchema(tool.parameters, call.arguments);
    if (!result.valid) errors.push(...result.errors.map((e) => `"${call.name}": ${e}`));
  }
  return errors;
}

export function toBehavior(output: ProviderOutput, tools: ToolSpec[]): Behavior {
  const acted = output.toolCalls.length > 0;
  const asks = !acted && !output.unparseable && looksLikeClarification(output.text);
  const argErrors = validateToolCalls(output.toolCalls, tools);
  return {
    toolCalls: output.toolCalls,
    text: output.text,
    asksClarification: asks,
    refused: !acted && !asks && !output.unparseable && looksLikeRefusal(output.text),
    argsValid: argErrors.length === 0,
    argErrors,
    unparseable: output.unparseable !== undefined,
  };
}
