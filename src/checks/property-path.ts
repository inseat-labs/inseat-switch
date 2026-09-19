import { PROPERTY_PATH_PATTERN } from "../config/schema.js";

export type PathLookup = { found: true; value: unknown } | { found: false; missingAt: string };

export function resolvePath(root: unknown, path: string): PathLookup {
  if (!PROPERTY_PATH_PATTERN.test(path)) return { found: false, missingAt: path };
  const segments = path.match(/[^.[\]]+/g) ?? [];
  let current: unknown = root;
  let walked = "";
  for (const segment of segments) {
    walked = walked === "" ? segment : /^\d+$/.test(segment) ? `${walked}[${segment}]` : `${walked}.${segment}`;
    if (Array.isArray(current) && /^\d+$/.test(segment)) {
      const index = Number(segment);
      if (index >= current.length) return { found: false, missingAt: walked };
      current = current[index];
      continue;
    }
    if (typeof current === "object" && current !== null && !Array.isArray(current) && Object.prototype.hasOwnProperty.call(current, segment)) {
      current = (current as Record<string, unknown>)[segment];
      continue;
    }
    return { found: false, missingAt: walked };
  }
  return { found: true, value: current };
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
  }
  const ka = Object.keys(a as object).sort();
  const kb = Object.keys(b as object).sort();
  if (ka.length !== kb.length || ka.some((k, i) => k !== kb[i])) return false;
  return ka.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}
