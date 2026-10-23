/**
 * Canonical structural guards for reading host TUI descriptions.
 *
 * These values arrive as `unknown` (component `describe()` return types are
 * generic in the host), so every read is narrowed here once instead of at
 * each call site.
 */

export function isRecordObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** A host native node: `k` is its kind, `p` its props, `c` its children. */
export interface NativeNodeLike {
  readonly k: string;
  readonly p?: Readonly<Record<string, unknown>>;
  readonly c?: readonly unknown[];
}

export function asNativeNode(value: unknown): NativeNodeLike | undefined {
  if (!isRecordObject(value)) return undefined;
  if (typeof value.k !== "string") return undefined;
  const props = isRecordObject(value.p) ? value.p : undefined;
  const children = Array.isArray(value.c) ? value.c : undefined;
  return { k: value.k, ...(props ? { p: props } : {}), ...(children ? { c: children } : {}) };
}
