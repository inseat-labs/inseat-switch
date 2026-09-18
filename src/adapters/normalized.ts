export interface NormalizedToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface AvailableResponse {
  available: true;
  format: string;
  text: string | null;
  toolCalls: NormalizedToolCall[];
}

export interface UnavailableResponse {
  available: false;
  format: string;
  reason: string;
}

export type NormalizedResponse = AvailableResponse | UnavailableResponse;
