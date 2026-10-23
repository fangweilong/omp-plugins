import { Database } from "bun:sqlite";
import type { CachedUsageReport, UsageReport } from "./types.js";

/**
 * Read-only view of the host's usage cache.
 *
 * The TUI status line calls `AuthStorage.usage.reports()` every five minutes while
 * it renders and writes the result to `agent.db`, so reading that cache keeps the
 * plugin free of extra network requests and CLI subprocesses. The cache key
 * format is host-internal; every parse failure is skipped instead of surfacing.
 */
export class UsageCacheReader {
  #db: Database | undefined;
  #path: string;

  constructor(path: string) {
    this.#path = path;
  }

  read(): CachedUsageReport[] {
    try {
      const db = this.#db ?? (this.#db = new Database(this.#path, { readonly: true }));
      const rows = db.query("SELECT key, value FROM cache WHERE key LIKE 'usage_cache:report:%'").all() as Array<{
        key: string;
        value: string;
      }>;
      const reports: CachedUsageReport[] = [];
      for (const row of rows) {
        const parsed = parseRow(row.key, row.value);
        if (parsed) reports.push(parsed);
      }
      return reports;
    } catch (error) {
      this.close();
      throw error;
    }
  }

  close(): void {
    try {
      this.#db?.close();
    } catch {
      // The handle may already be closed by a failed open.
    }
    this.#db = undefined;
  }
}

function parseRow(key: string, raw: string): CachedUsageReport | undefined {
  let wrapper: unknown;
  try {
    wrapper = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (!wrapper || typeof wrapper !== "object") return undefined;
  const { value, expiresAt } = wrapper as { value?: unknown; expiresAt?: unknown };
  if (!isUsageReport(value)) return undefined;
  // `usage_cache:report:<cacheVersion>:<provider>:<baseUrl>:<identity>`
  const identity = key.split(":").slice(5).join(":") || undefined;
  return {
    report: value,
    expiresAt: typeof expiresAt === "number" && Number.isFinite(expiresAt) ? expiresAt : undefined,
    identity,
  };
}

function isUsageReport(value: unknown): value is UsageReport {
  if (!value || typeof value !== "object") return false;
  const report = value as Partial<UsageReport>;
  return typeof report.provider === "string" && Array.isArray(report.limits);
}
