export interface ToolSpec {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

export interface MessageToolCall {
  id?: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  toolCalls?: MessageToolCall[];
  toolCallId?: string;
  name?: string;
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

/** How tool calls were obtained: provider-native tool calling, a JSON reply the model was asked to produce, or recorded traffic. */
export type ToolMode = "native" | "prompted" | "recorded" | "none";

export interface ProviderRequest {
  model: string;
  system?: string;
  messages: ChatMessage[];
  tools: ToolSpec[];
}

export interface ProviderOutput {
  text: string | null;
  toolCalls: ToolCall[];
  toolMode: ToolMode;
  /** Set when the reply could not be parsed into tool calls/text; the sample is kept, not dropped. */
  unparseable?: { reason: string; raw: string };
  /** The reply was usable but did not follow the requested format exactly. */
  formatNote?: string;
}

export interface CompareCase {
  name: string;
  system?: string;
  messages: ChatMessage[];
  tools: ToolSpec[];
  /** Recorded responses (from imported traffic) used as extra baseline samples. */
  recorded: ProviderOutput[];
}

export interface CompareConfig {
  baseline: string;
  candidate: string;
  repeat: number;
  cases: CompareCase[];
}
