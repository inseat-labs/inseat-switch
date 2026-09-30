import { AnthropicProvider } from "./anthropic.js";
import { ClaudeCliProvider } from "./claude-cli.js";
import { OpenAiProvider } from "./openai.js";
import { ProviderError, splitProviderId, type Provider } from "./types.js";

export * from "./types.js";
export { ClaudeCliProvider, buildClaudePrompt, parseClaudeEnvelope, parsePromptedReply, toolInstructions } from "./claude-cli.js";
export { AnthropicProvider, toAnthropicRequest, parseAnthropicResponse } from "./anthropic.js";
export { OpenAiProvider, toOpenAiRequest, parseOpenAiResponse } from "./openai.js";

export const PROVIDER_TYPES = ["claude-cli", "anthropic", "openai"] as const;

export type ProviderFactory = (id: string) => Provider;

export const createProvider: ProviderFactory = (id) => {
  const { type, model } = splitProviderId(id);
  switch (type) {
    case "claude-cli":
      return new ClaudeCliProvider(model);
    case "anthropic":
      return new AnthropicProvider(model);
    case "openai":
      return new OpenAiProvider(model);
    default:
      throw new ProviderError(`unknown provider "${type}" in "${id}"; supported: ${PROVIDER_TYPES.join(", ")}`);
  }
};
