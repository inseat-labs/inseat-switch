import { readFile } from "node:fs/promises";
import { FixtureSchema, type Fixture } from "./schema.js";

export class FixtureLoadError extends Error {
  constructor(
    public readonly path: string,
    message: string,
  ) {
    super(`${path}: ${message}`);
    this.name = "FixtureLoadError";
  }
}

export function parseFixture(raw: unknown, source = "<inline>"): Fixture {
  const result = FixtureSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
      .join("; ");
    throw new FixtureLoadError(source, `invalid fixture: ${issues}`);
  }
  return result.data;
}

export async function loadFixture(path: string): Promise<Fixture> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    throw new FixtureLoadError(path, `cannot read file: ${(error as Error).message}`);
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new FixtureLoadError(path, `invalid JSON: ${(error as Error).message}`);
  }
  return parseFixture(json, path);
}
