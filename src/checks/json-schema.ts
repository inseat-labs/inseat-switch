import { Ajv2020 } from "ajv/dist/2020.js";
import type { ErrorObject } from "ajv";

const ajv = new Ajv2020({ allErrors: true, strict: false });

export interface SchemaValidation {
  valid: boolean;
  errors: string[];
}

export function validateAgainstSchema(schema: Record<string, unknown>, value: unknown): SchemaValidation {
  const validate = ajv.compile(schema);
  const valid = validate(value);
  if (valid) return { valid: true, errors: [] };
  return { valid: false, errors: (validate.errors ?? []).map(formatError) };
}

function formatError(error: ErrorObject): string {
  const where = error.instancePath || "<root>";
  return `${where} ${error.message ?? "is invalid"}`.trim();
}
