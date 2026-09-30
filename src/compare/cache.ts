import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ProviderOutput, ProviderRequest } from "./types.js";

export const CACHE_VERSION = 1;

export function cacheKey(providerId: string, request: ProviderRequest, sampleIndex: number, salt = ""): string {
  const payload = JSON.stringify({
    v: CACHE_VERSION,
    providerId,
    model: request.model,
    system: request.system ?? null,
    messages: request.messages,
    tools: request.tools,
    sampleIndex,
    salt,
  });
  return createHash("sha256").update(payload).digest("hex");
}

export interface ResponseCache {
  get(key: string): Promise<ProviderOutput | null>;
  set(key: string, value: ProviderOutput): Promise<void>;
}

export class DiskCache implements ResponseCache {
  constructor(readonly dir: string) {}

  private path(key: string): string {
    return join(this.dir, `${key}.json`);
  }

  async get(key: string): Promise<ProviderOutput | null> {
    try {
      const entry = JSON.parse(await readFile(this.path(key), "utf8")) as { v?: number; output?: ProviderOutput };
      return entry.v === CACHE_VERSION && entry.output ? entry.output : null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: ProviderOutput): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const tmp = `${this.path(key)}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify({ v: CACHE_VERSION, output: value }));
    await rename(tmp, this.path(key));
  }
}
