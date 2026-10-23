/** Subset of the host's `UsageReport` that the status line needs. */
export interface UsageAmount {
  unit?: string;
  usedFraction?: number;
  remainingFraction?: number;
  used?: number;
  limit?: number;
  remaining?: number;
}

export interface UsageWindow {
  id?: string;
  label?: string;
  durationMs?: number;
  resetsAt?: number;
}

export interface UsageScope {
  provider?: string;
  windowId?: string;
  modelId?: string;
  tier?: string;
  sharedGroup?: string;
}

export interface UsageLimit {
  id?: string;
  label?: string;
  scope?: UsageScope;
  window?: UsageWindow;
  amount?: UsageAmount;
  status?: string;
}

export interface UsageReport {
  provider: string;
  fetchedAt?: number;
  limits: UsageLimit[];
  metadata?: Record<string, unknown>;
}

/** One row of the host's `usage_cache:report:*` entries in `agent.db`. */
export interface CachedUsageReport {
  report: UsageReport;
  /** Logical freshness deadline of the cache row (epoch ms). */
  expiresAt?: number;
  /** Credential identity suffix from the cache key; used only for diagnostics. */
  identity?: string;
}
