import type { ProviderOutput, ProviderRequest } from "../compare/types.js";

export class ProviderError extends Error {
  override name = "ProviderError";
}

export interface Provider {
  /** The `provider:model` id from the config. */
  readonly id: string;
  readonly model: string;
  /** Changes whenever the way requests are rendered changes, so stale cache entries are not reused. */
  readonly cacheSalt: string;
  /** Fails fast with a clear message when credentials or the CLI are missing. */
  preflight(): Promise<void>;
  call(request: ProviderRequest): Promise<ProviderOutput>;
}

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
}>;

export function splitProviderId(id: string): { type: string; model: string } {
  const at = id.indexOf(":");
  if (at <= 0 || at === id.length - 1) throw new ProviderError(`invalid provider id "${id}"; expected "provider:model"`);
  return { type: id.slice(0, at), model: id.slice(at + 1) };
}

export function truncate(text: string, max = 400): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
