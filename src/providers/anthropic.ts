import type { ProviderOutput, ProviderRequest, ToolCall } from "../compare/types.js";
import { systemText, withToolCallIds } from "./messages.js";
import { ProviderError, truncate, type FetchLike, type Provider } from "./types.js";

type Block = Record<string, unknown>;
interface AnthropicMessage {
  role: "user" | "assistant";
  content: Block[];
}

export function toAnthropicRequest(request: ProviderRequest, maxTokens = 1024): Record<string, unknown> {
  const messages: AnthropicMessage[] = [];
  const push = (role: "user" | "assistant", blocks: Block[]) => {
    if (blocks.length === 0) return;
    const last = messages.at(-1);
    if (last && last.role === role) last.content.push(...blocks);
    else messages.push({ role, content: blocks });
  };
  for (const m of withToolCallIds(request.messages)) {
    if (m.role === "system") continue;
    if (m.role === "user") push("user", [{ type: "text", text: m.content ?? "" }]);
    else if (m.role === "tool") push("user", [{ type: "tool_result", tool_use_id: m.toolCallId, content: m.content ?? "" }]);
    else {
      const blocks: Block[] = m.content ? [{ type: "text", text: m.content }] : [];
      for (const c of m.toolCalls ?? []) blocks.push({ type: "tool_use", id: c.id, name: c.name, input: c.arguments });
      push("assistant", blocks);
    }
  }
  const body: Record<string, unknown> = { model: request.model, max_tokens: maxTokens, messages };
  const system = systemText(request.system, request.messages);
  if (system) body.system = system;
  if (request.tools.length > 0) {
    body.tools = request.tools.map((t) => ({
      name: t.name,
      description: t.description ?? "",
      input_schema: t.parameters ?? { type: "object", properties: {} },
    }));
  }
  return body;
}

export function parseAnthropicResponse(json: unknown): ProviderOutput {
  const content = (json as { content?: unknown })?.content;
  if (!Array.isArray(content)) throw new ProviderError("Anthropic response has no content array");
  const texts: string[] = [];
  const toolCalls: ToolCall[] = [];
  for (const block of content as Block[]) {
    if (block.type === "text" && typeof block.text === "string") texts.push(block.text);
    if (block.type === "tool_use" && typeof block.name === "string") {
      const input = block.input && typeof block.input === "object" && !Array.isArray(block.input) ? (block.input as Record<string, unknown>) : {};
      toolCalls.push({ name: block.name, arguments: input });
    }
  }
  const text = texts.join("\n").trim();
  return { text: text === "" ? null : text, toolCalls, toolMode: "native" };
}

export class AnthropicProvider implements Provider {
  readonly id: string;
  readonly cacheSalt = "anthropic-messages-v1";

  constructor(
    readonly model: string,
    private readonly env: NodeJS.ProcessEnv = process.env,
    private readonly fetchImpl: FetchLike = fetch as unknown as FetchLike,
  ) {
    this.id = `anthropic:${model}`;
  }

  async preflight(): Promise<void> {
    if (!this.env.ANTHROPIC_API_KEY) throw new ProviderError(`${this.id} needs ANTHROPIC_API_KEY in the environment`);
  }

  async call(request: ProviderRequest): Promise<ProviderOutput> {
    await this.preflight();
    const base = (this.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com").replace(/\/+$/, "");
    const res = await this.fetchImpl(`${base}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.env.ANTHROPIC_API_KEY ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(toAnthropicRequest(request)),
      signal: AbortSignal.timeout(180_000),
    });
    const body = await res.text();
    if (!res.ok) throw new ProviderError(`Anthropic API HTTP ${res.status}: ${truncate(body, 300)}`);
    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      throw new ProviderError("Anthropic API returned non-JSON");
    }
    return parseAnthropicResponse(json);
  }
}
