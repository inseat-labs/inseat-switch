import type { ChatMessage } from "../compare/types.js";

/** Fills missing tool-call ids and links tool results to the preceding calls in order. */
export function withToolCallIds(messages: ChatMessage[]): ChatMessage[] {
  let next = 0;
  const pending: string[] = [];
  return messages.map((m) => {
    if (m.role === "assistant" && m.toolCalls) {
      const toolCalls = m.toolCalls.map((c) => {
        const id = c.id ?? `call_${next++}`;
        pending.push(id);
        return { ...c, id };
      });
      return { ...m, toolCalls };
    }
    if (m.role === "tool") {
      const id = m.toolCallId ?? pending.shift() ?? `call_${next++}`;
      if (m.toolCallId) {
        const at = pending.indexOf(m.toolCallId);
        if (at >= 0) pending.splice(at, 1);
      }
      return { ...m, toolCallId: id };
    }
    return m;
  });
}

/** Combines the configured system prompt with any system messages embedded in the conversation. */
export function systemText(system: string | undefined, messages: ChatMessage[]): string | undefined {
  const parts = [system, ...messages.filter((m) => m.role === "system").map((m) => m.content)].filter(
    (p): p is string => typeof p === "string" && p.trim() !== "",
  );
  return parts.length > 0 ? parts.join("\n\n") : undefined;
}
