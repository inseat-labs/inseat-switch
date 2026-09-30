import type { ProviderOutput, ProviderRequest, ToolCall } from "../src/compare/types.js";
import type { Behavior } from "../src/compare/behavior.js";
import type { Provider } from "../src/providers/types.js";

export function out(toolCalls: ToolCall[] = [], text: string | null = null): ProviderOutput {
  return { text, toolCalls, toolMode: "native" };
}

export function call(name: string, args: Record<string, unknown> = {}): ToolCall {
  return { name, arguments: args };
}

export function behavior(partial: Partial<Behavior> = {}): Behavior {
  return {
    toolCalls: [],
    text: null,
    asksClarification: false,
    refused: false,
    argsValid: true,
    argErrors: [],
    unparseable: false,
    ...partial,
  };
}

export function acts(...calls: ToolCall[]): Behavior {
  return behavior({ toolCalls: calls });
}

export function times<T>(n: number, value: T): T[] {
  return Array.from({ length: n }, () => value);
}

/**
 * A fake provider whose replies are scripted per prompt: `script[prompt][n]` is the reply
 * to the n-th call with that prompt (the last entry repeats).
 */
export class ScriptedProvider implements Provider {
  readonly cacheSalt = "test";
  readonly calls: ProviderRequest[] = [];
  private readonly counters = new Map<string, number>();

  constructor(
    readonly id: string,
    private readonly script: Record<string, ProviderOutput[]>,
    private readonly failPreflight?: string,
  ) {}

  get model(): string {
    return this.id.slice(this.id.indexOf(":") + 1);
  }

  async preflight(): Promise<void> {
    if (this.failPreflight) {
      const { ProviderError } = await import("../src/providers/types.js");
      throw new ProviderError(this.failPreflight);
    }
  }

  async call(request: ProviderRequest): Promise<ProviderOutput> {
    this.calls.push(request);
    const prompt = request.messages.at(-1)?.content ?? "";
    const replies = this.script[prompt];
    if (!replies) throw new Error(`no scripted reply for ${prompt}`);
    const n = this.counters.get(prompt) ?? 0;
    this.counters.set(prompt, n + 1);
    return replies[Math.min(n, replies.length - 1)]!;
  }
}
