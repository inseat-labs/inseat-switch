import { readFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { ImportError, normalizeMessages, normalizeTools, parseImportJsonl } from "./import.js";
import type { CompareCase, CompareConfig } from "./types.js";

export class ConfigError extends Error {
  override name = "ConfigError";
}

export const PROVIDER_ID_PATTERN = /^[a-z][a-z0-9-]*:\S+$/;
const ProviderId = z.string().regex(PROVIDER_ID_PATTERN, 'must look like "provider:model", e.g. "claude-cli:sonnet"');

const CaseSchema = z.union([
  z.strictObject({
    name: z.string().min(1),
    prompt: z.string().min(1),
    system: z.string().optional(),
  }),
  z.strictObject({
    name: z.string().min(1),
    messages: z.array(z.unknown()).min(1),
    system: z.string().optional(),
  }),
  z.strictObject({ import: z.string().min(1) }),
], { error: "each case must be {name, prompt}, {name, messages}, or {import} (optional: system)" });

export const CompareConfigSchema = z.strictObject({
  description: z.string().optional(),
  baseline: ProviderId,
  candidate: ProviderId,
  repeat: z.number().int().min(1).max(20).default(3),
  system: z.string().optional(),
  tools: z.array(z.unknown()).default([]),
  cases: z.array(CaseSchema).min(1, "at least one case is required"),
});

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "<root>";
      return `  - ${path}: ${issue.message}`;
    })
    .join("\n");
}

export interface ReadFile {
  (path: string): Promise<string>;
}

const defaultReadFile: ReadFile = (path) => readFile(path, "utf8");

/** Validates a parsed config object. `baseDir` resolves `import:` paths. */
export async function resolveCompareConfig(
  raw: unknown,
  baseDir: string,
  read: ReadFile = defaultReadFile,
): Promise<CompareConfig> {
  const parsed = CompareConfigSchema.safeParse(raw);
  if (!parsed.success) throw new ConfigError(`invalid config:\n${formatIssues(parsed.error)}`);
  const config = parsed.data;

  let tools;
  try {
    tools = normalizeTools(config.tools);
  } catch (error) {
    throw new ConfigError(`invalid config: ${(error as Error).message}`);
  }
  const toolNames = new Set<string>();
  for (const tool of tools) {
    if (toolNames.has(tool.name)) throw new ConfigError(`invalid config: duplicate tool "${tool.name}"`);
    toolNames.add(tool.name);
  }

  const cases: CompareCase[] = [];
  for (const [i, entry] of config.cases.entries()) {
    if ("import" in entry) {
      const path = resolve(baseDir, entry.import);
      let source: string;
      try {
        source = await read(path);
      } catch (error) {
        throw new ConfigError(`cases[${i}].import: cannot read ${entry.import}: ${(error as NodeJS.ErrnoException).code ?? (error as Error).message}`);
      }
      let records;
      try {
        records = parseImportJsonl(source, entry.import);
      } catch (error) {
        if (error instanceof ImportError) throw new ConfigError(`cases[${i}].import: ${error.message}`);
        throw error;
      }
      for (const record of records) {
        const item: CompareCase = {
          name: `${basename(entry.import)}#${record.line}`,
          messages: record.messages,
          tools: record.tools ?? tools,
          recorded: record.recorded ? [record.recorded] : [],
        };
        if (config.system !== undefined && !record.messages.some((m) => m.role === "system")) item.system = config.system;
        cases.push(item);
      }
      continue;
    }
    let messages;
    try {
      messages = "prompt" in entry ? [{ role: "user" as const, content: entry.prompt }] : normalizeMessages(entry.messages);
    } catch (error) {
      throw new ConfigError(`cases[${i}] (${entry.name}): ${(error as Error).message}`);
    }
    const item: CompareCase = { name: entry.name, messages, tools, recorded: [] };
    const system = entry.system ?? config.system;
    if (system !== undefined) item.system = system;
    cases.push(item);
  }

  const seen = new Set<string>();
  for (const c of cases) {
    if (seen.has(c.name)) throw new ConfigError(`invalid config: duplicate case name "${c.name}"`);
    seen.add(c.name);
  }

  return { baseline: config.baseline, candidate: config.candidate, repeat: config.repeat, cases };
}

export function parseConfigText(text: string, path: string): unknown {
  try {
    return path.endsWith(".json") ? JSON.parse(text) : parseYaml(text);
  } catch (error) {
    throw new ConfigError(`${path}: cannot parse: ${(error as Error).message.split("\n")[0]}`);
  }
}

export async function loadCompareConfig(path: string, read: ReadFile = defaultReadFile): Promise<CompareConfig> {
  let text: string;
  try {
    text = await read(path);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    throw new ConfigError(code === "ENOENT" ? `${path} not found (run "switch init" to create one)` : `${path}: ${(error as Error).message}`);
  }
  return resolveCompareConfig(parseConfigText(text, path), dirname(resolve(path)), read);
}
