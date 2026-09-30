import type { ChatMessage, MessageToolCall, ProviderOutput, ToolCall, ToolSpec } from "./types.js";

export class ImportError extends Error {
  override name = "ImportError";
}

export interface ImportedRecord {
  line: number;
  messages: ChatMessage[];
  tools: ToolSpec[] | null;
  recorded: ProviderOutput | null;
}

type Obj = Record<string, unknown>;

function isObj(value: unknown): value is Obj {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function contentToText(content: unknown): string | null {
  if (content === null || content === undefined) return null;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const parts = content
      .map((part) => (isObj(part) && typeof part.text === "string" ? part.text : null))
      .filter((t): t is string => t !== null);
    return parts.length > 0 ? parts.join("\n") : null;
  }
  throw new ImportError("message content must be a string, null, or an array of text parts");
}

/** Arguments arrive as a JSON string (OpenAI wire format) or an object (hand-written configs). */
export function parseToolArguments(raw: unknown): { ok: true; value: Record<string, unknown> } | { ok: false; reason: string } {
  let value: unknown = raw ?? {};
  if (typeof raw === "string") {
    if (raw.trim() === "") return { ok: true, value: {} };
    try {
      value = JSON.parse(raw);
    } catch {
      return { ok: false, reason: "arguments are not valid JSON" };
    }
  }
  if (!isObj(value)) return { ok: false, reason: "arguments must be a JSON object" };
  return { ok: true, value };
}

function toMessageToolCall(raw: unknown): MessageToolCall {
  if (!isObj(raw)) throw new ImportError("tool_calls entries must be objects");
  const fn = isObj(raw.function) ? raw.function : raw;
  if (typeof fn.name !== "string" || fn.name === "") throw new ImportError("tool call is missing a function name");
  const args = parseToolArguments(fn.arguments);
  if (!args.ok) throw new ImportError(`tool call "${fn.name}": ${args.reason}`);
  const call: MessageToolCall = { name: fn.name, arguments: args.value };
  if (typeof raw.id === "string") call.id = raw.id;
  return call;
}

const ROLES = new Set(["system", "developer", "user", "assistant", "tool"]);

/** Accepts OpenAI chat-completions messages (`tool_calls`, `tool_call_id`, text-part arrays). */
export function normalizeMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new ImportError("messages must be a non-empty array");
  return raw.map((m, i) => {
    if (!isObj(m) || typeof m.role !== "string" || !ROLES.has(m.role)) {
      throw new ImportError(`messages[${i}] must have role system, user, assistant, or tool`);
    }
    const role = m.role === "developer" ? "system" : (m.role as ChatMessage["role"]);
    const msg: ChatMessage = { role, content: contentToText(m.content) };
    const calls = m.tool_calls ?? m.toolCalls;
    if (Array.isArray(calls) && calls.length > 0) msg.toolCalls = calls.map(toMessageToolCall);
    const callId = m.tool_call_id ?? m.toolCallId;
    if (typeof callId === "string") msg.toolCallId = callId;
    if (typeof m.name === "string") msg.name = m.name;
    return msg;
  });
}

/** Accepts `{name, description, parameters}` or OpenAI `{type: "function", function: {...}}`. */
export function normalizeTools(raw: unknown): ToolSpec[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new ImportError("tools must be an array");
  return raw.map((t, i) => {
    const fn = isObj(t) && isObj(t.function) ? t.function : t;
    if (!isObj(fn) || typeof fn.name !== "string" || fn.name === "") {
      throw new ImportError(`tools[${i}] must have a name`);
    }
    const tool: ToolSpec = { name: fn.name };
    if (typeof fn.description === "string") tool.description = fn.description;
    if (fn.parameters !== undefined) {
      if (!isObj(fn.parameters)) throw new ImportError(`tools[${i}].parameters must be a JSON Schema object`);
      tool.parameters = fn.parameters;
    }
    return tool;
  });
}

function recordedOutput(response: unknown): ProviderOutput | null {
  if (response === undefined || response === null) return null;
  if (!isObj(response)) throw new ImportError("response must be an object");
  const choices = response.choices;
  const message = Array.isArray(choices) && isObj(choices[0]) ? choices[0].message : response.message;
  if (!isObj(message)) throw new ImportError("response must contain choices[0].message");
  const toolCalls: ToolCall[] = [];
  const rawCalls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
  for (const raw of rawCalls) {
    const fn = isObj(raw) && isObj(raw.function) ? raw.function : null;
    if (!fn || typeof fn.name !== "string") throw new ImportError("response tool call is missing a function name");
    const args = parseToolArguments(fn.arguments);
    if (!args.ok) {
      return {
        text: contentToText(message.content),
        toolCalls: [],
        toolMode: "recorded",
        unparseable: { reason: `tool call "${fn.name}": ${args.reason}`, raw: String(fn.arguments) },
      };
    }
    toolCalls.push({ name: fn.name, arguments: args.value });
  }
  return { text: contentToText(message.content), toolCalls, toolMode: "recorded" };
}

/**
 * Parses OpenAI chat-completions traffic as JSONL. Each line is
 * `{request: {model, messages, tools}, response: {choices: [{message}]}}` or the bare
 * `{messages, tools, response}` form. Blank lines are ignored.
 */
export function parseImportJsonl(source: string, label = "import"): ImportedRecord[] {
  const records: ImportedRecord[] = [];
  const lines = source.split(/\r?\n/);
  for (const [index, text] of lines.entries()) {
    if (text.trim() === "") continue;
    const line = index + 1;
    try {
      let entry: unknown;
      try {
        entry = JSON.parse(text);
      } catch {
        throw new ImportError("line is not valid JSON");
      }
      if (!isObj(entry)) throw new ImportError("line must be a JSON object");
      const request = isObj(entry.request) ? entry.request : entry;
      records.push({
        line,
        messages: normalizeMessages(request.messages),
        tools: request.tools === undefined ? null : normalizeTools(request.tools),
        recorded: recordedOutput(entry.response),
      });
    } catch (error) {
      if (error instanceof ImportError) throw new ImportError(`${label}:${line}: ${error.message}`);
      throw error;
    }
  }
  if (records.length === 0) throw new ImportError(`${label}: no records found`);
  return records;
}
