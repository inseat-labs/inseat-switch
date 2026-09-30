import { parseToolArguments } from "../compare/import.js";
import type { ProviderOutput, ProviderRequest, ToolCall } from "../compare/types.js";
import { withToolCallIds } from "./messages.js";
import { ProviderError, truncate, type FetchLike, type Provider } from "./types.js";

export function toOpenAiRequest(request: ProviderRequest): Record<string, unknown> {
  const messages: Record<string, unknown>[] = [];
  if (request.system) messages.push({ role: "system", content: request.system });
  for (const m of withToolCallIds(request.messages)) {
    if (m.role === "tool") {
      messages.push({ role: "tool", tool_call_id: m.toolCallId, content: m.content ?? "" });
    } else if (m.role === "assistant" && m.toolCalls?.length) {
      messages.push({
        role: "assistant",
        content: m.content,
        tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: JSON.stringify(c.arguments) } })),
      });
    } else {
      messages.push({ role: m.role, content: m.content ?? "" });
    }
  }
  const body: Record<string, unknown> = { model: request.model, messages };
  if (request.tools.length > 0) {
    body.tools = request.tools.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description ?? "", parameters: t.parameters ?? { type: "object", properties: {} } },
    }));
  }
  return body;
}

export function parseOpenAiResponse(json: unknown): ProviderOutput {
  const message = (json as { choices?: { message?: unknown }[] })?.choices?.[0]?.message as
    | { content?: unknown; tool_calls?: { function?: { name?: unknown; arguments?: unknown } }[] }
    | undefined;
  if (!message || typeof message !== "object") throw new ProviderError("OpenAI-compatible response has no choices[0].message");
  const text = typeof message.content === "string" && message.content.trim() !== "" ? message.content : null;
  const toolCalls: ToolCall[] = [];
  for (const call of message.tool_calls ?? []) {
    const name = call.function?.name;
    if (typeof name !== "string") continue;
    const args = parseToolArguments(call.function?.arguments);
    if (!args.ok) {
      return { text, toolCalls, toolMode: "native", unparseable: { reason: `tool call "${name}": ${args.reason}`, raw: String(call.function?.arguments) } };
    }
    toolCalls.push({ name, arguments: args.value });
  }
  return { text, toolCalls, toolMode: "native" };
}

/** OpenAI Chat Completions, or any compatible server via OPENAI_BASE_URL (OpenRouter, Ollama, vLLM, ...). */
export class OpenAiProvider implements Provider {
  readonly id: string;
  readonly cacheSalt: string;

  constructor(
    readonly model: string,
    private readonly env: NodeJS.ProcessEnv = process.env,
    private readonly fetchImpl: FetchLike = fetch as unknown as FetchLike,
  ) {
    this.id = `openai:${model}`;
    this.cacheSalt = `openai-chat-v1:${this.baseUrl}`;
  }

  private get baseUrl(): string {
    return (this.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/+$/, "");
  }

  async preflight(): Promise<void> {
    if (!this.env.OPENAI_API_KEY && !this.env.OPENAI_BASE_URL) {
      throw new ProviderError(`${this.id} needs OPENAI_API_KEY (or OPENAI_BASE_URL for a local compatible server)`);
    }
  }

  async call(request: ProviderRequest): Promise<ProviderOutput> {
    await this.preflight();
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (this.env.OPENAI_API_KEY) headers.authorization = `Bearer ${this.env.OPENAI_API_KEY}`;
    const res = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(toOpenAiRequest(request)),
      signal: AbortSignal.timeout(180_000),
    });
    const body = await res.text();
    if (!res.ok) throw new ProviderError(`OpenAI-compatible API HTTP ${res.status}: ${truncate(body, 300)}`);
    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      throw new ProviderError("OpenAI-compatible API returned non-JSON");
    }
    return parseOpenAiResponse(json);
  }
}
