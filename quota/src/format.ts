import type { QuotaConfig } from "./config.js";
import type { CachedUsageReport, UsageLimit, UsageReport } from "./types.js";

type WindowClass = "5h" | "1d" | "7d" | "mo";

interface WindowQuota {
  label: string;
  window: WindowClass;
  used: number;
  resetsAt?: number;
  status?: string;
}

interface ProviderQuota {
  provider: string;
  fetchedAt?: number;
  windows: WindowQuota[];
  credits?: number;
}

const WINDOW_ORDER: Record<WindowClass, number> = { "5h": 0, "1d": 1, "7d": 2, mo: 3 };
const WINDOW_LABEL: Record<WindowClass, string> = { "5h": "5h", "1d": "1d", "7d": "7d", mo: "mo" };

const PROVIDER_SHORT: Record<string, string> = {
  "google-antigravity": "AG",
  "openai-codex": "CX",
  "opencode-go": "OG",
  "opencode-zen": "OZ",
  anthropic: "CL",
  openai: "OA",
  cursor: "CU",
  zai: "Z",
  qwen: "QW",
  commandcode: "CC",
  deepseek: "DS",
};

const PROVIDER_NAME: Record<string, string> = {
  "google-antigravity": "Google Antigravity",
  "openai-codex": "OpenAI Codex",
  "opencode-go": "OpenCode Go",
  "opencode-zen": "OpenCode Zen",
  commandcode: "Command Code",
};

const LIMIT_SHORT: Record<string, string> = {
  "Claude & GPT (shared)": "3P",
  Gemini: "G",
  Claude: "CL",
  ChatGPT: "GPT",
  Codex: "CX",
};

const ANSI = {
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  boldCyan: "\x1b[1;36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  reset: "\x1b[0m",
};

const GAUGE_WIDTH = 8;
/** 1/8 .. 8/8 block glyphs, so a gauge row keeps a fixed display width. */
const PARTIAL_BLOCKS = "\u258f\u258e\u258d\u258c\u258b\u258a\u2589\u2588";
/** The host collapses ASCII space runs in hook statuses; NBSP preserves layout padding. */
const SP = "\u00a0";

/** Compact one-line status, or `undefined` when no provider has a percentage quota. */
export function formatStatus(
  reports: readonly CachedUsageReport[],
  config: QuotaConfig,
  now: number = Date.now(),
  activeProvider?: string,
): string | undefined {
  const quotas = collectQuotas(filterRecentReports(reports, config.staleAfterMinutes))
    .filter((quota) => quota.windows.length > 0 || (config.showCredits && quota.credits !== undefined))
    .filter((quota) => config.providers === "auto" || config.providers.includes(quota.provider))
    // The subscription behind the selected model always leads; remaining providers
    // follow by pressure so a nearly exhausted one still stays visible.
    .sort(
      (left, right) =>
        Number(right.provider === activeProvider) - Number(left.provider === activeProvider) ||
        maxUsed(right) - maxUsed(left),
    )
    .slice(0, config.maxProviders);

  if (quotas.length === 0) return undefined;
  const row = quotas
    .map((quota, index) => formatProvider(quota, config, now, index === 0 ? "primary" : "compact"))
    .join(`${SP}${style("\u2502", ANSI.dim, config.color)}${SP}`);
  // Leading whitespace is stripped by the hook-status sanitizer, so a zero-width
  // space anchors the first visible cell and lets the NBSP indent survive.
  return `\u200b${SP.repeat(config.indent)}${row}`;
}

/** Multi-line account/limit breakdown used by `/quota`. */
export function formatDetails(reports: readonly CachedUsageReport[], now: number = Date.now()): string {
  if (reports.length === 0) return "No cached subscription usage yet. Run `/quota refresh` or use the provider once.";
  const lines: string[] = [];
  for (const { report, expiresAt } of [...reports].sort((a, b) => a.report.provider.localeCompare(b.report.provider))) {
    const quota = collectQuotas([{ report }])[0];
    const email = typeof report.metadata?.email === "string" ? ` · ${report.metadata.email}` : "";
    const age = ageText(report.fetchedAt, now);
    const freshness = age ? ` · fetched ${age} ago` : "";
    const state = expiresAt !== undefined && expiresAt <= now ? " · cache stale" : "";
    lines.push(`${providerName(report.provider)} (${report.provider})${email}${freshness}${state}`);
    if (quota?.credits !== undefined) lines.push(`  Credits · ${formatNumber(quota.credits)} remaining`);
    for (const entry of quota?.windows ?? []) {
      const reset = resetText(entry.resetsAt, now);
      const status = entry.status && entry.status !== "ok" ? ` · ${entry.status}` : "";
      lines.push(
        `  ${entry.label} · ${WINDOW_LABEL[entry.window]} ${formatPercent(entry.used)} used${status}${reset ? ` ${reset}` : ""}`,
      );
    }
    if (!quota || (quota.windows.length === 0 && quota.credits === undefined)) lines.push("  No percentage quota in the cache");
  }
  return lines.join("\n");
}

function collectQuotas(reports: readonly CachedUsageReport[]): ProviderQuota[] {
  const byProvider = new Map<string, ProviderQuota>();
  for (const { report } of reports) {
    const provider = report.provider;
    const quota: ProviderQuota = byProvider.get(provider) ?? { provider, windows: [] };
    byProvider.set(provider, quota);
    if (typeof report.fetchedAt === "number" && Number.isFinite(report.fetchedAt)) {
      // `filterRecentReports` already dropped duplicate/stale rows; the newest
      // fetch is the best description of when this provider was refreshed.
      quota.fetchedAt =
        quota.fetchedAt === undefined ? report.fetchedAt : Math.max(quota.fetchedAt, report.fetchedAt);
    }
    // Multiple credentials for one provider merge worst-case per window, so the
    // status line never reports more headroom than the most constrained account.
    mergeLimits(quota, report);
  }
  return [...byProvider.values()];
}

function mergeLimits(quota: ProviderQuota, report: UsageReport): void {
  for (const limit of report.limits) {
    const amount = limit.amount;
    if (!amount) continue;
    if (amount.unit === "credits" || amount.unit === "usd") {
      if (typeof amount.remaining === "number" && Number.isFinite(amount.remaining)) {
        quota.credits = Math.min(quota.credits ?? Number.POSITIVE_INFINITY, amount.remaining);
      }
      continue;
    }
    const used = usedFraction(limit);
    const window = windowClass(limit);
    if (used === undefined || window === undefined) continue;
    const label = shortLimitLabel(limit.label ?? limit.scope?.modelId ?? providerName(quota.provider));
    const previous = quota.windows.find((entry) => entry.label === label && entry.window === window);
    if (!previous) {
      quota.windows.push({ label, window, used, resetsAt: limit.window?.resetsAt, status: limit.status });
    } else if (used > previous.used) {
      previous.used = used;
      previous.resetsAt = limit.window?.resetsAt;
      previous.status = limit.status;
    }
  }
}

type Emphasis = "primary" | "compact";

function formatProvider(
  quota: ProviderQuota,
  config: QuotaConfig,
  now: number,
  emphasis: Emphasis,
): string {
  const { windows, multipleLabels } = selectWindows(quota, config);
  const name = config.providerName === "short" ? shortProviderLabel(quota.provider) : providerName(quota.provider);
  // The active subscription is the reference reading, so it keeps full detail;
  // every other provider collapses to its tightest window to keep the row scannable.
  const label = style(name, emphasis === "primary" ? ANSI.boldCyan : ANSI.cyan, config.color);
  if (emphasis === "compact") return `${label}${SP}${formatCompactWindows(quota, windows, multipleLabels, config, now)}`;

  const labelWidth = multipleLabels ? Math.min(3, Math.max(...windows.map((entry) => entry.label.length))) : 0;
  const parts = windows.map((entry) => {
    const head = multipleLabels
      ? `${entry.label.slice(0, labelWidth).padEnd(labelWidth)} ${WINDOW_LABEL[entry.window]}`
      : WINDOW_LABEL[entry.window];
    const gauge = config.gauge ? `${formatGauge(entry.used, config.color)}${SP}` : "";
    const percent = style(formatPercent(entry.used).padStart(config.gauge ? 5 : 4, SP), healthColor(entry.used), config.color);
    const reset = config.showResets ? resetText(entry.resetsAt, now) : "";
    const tail = reset ? `${SP}${style(reset.padEnd(8, SP), ANSI.dim, config.color)}` : "";
    return `${style(head, ANSI.dim, config.color)}${SP}${gauge}${percent}${tail}`;
  });
  if (config.showCredits && quota.credits !== undefined) {
    parts.push(style(`${formatNumber(quota.credits)} cr`, ANSI.dim, config.color));
  }
  const stamp = staleStamp(quota.fetchedAt, config, now);
  const stampText = stamp ? `${style("\u00b7", ANSI.dim, config.color)}${SP}${style(stamp, ANSI.yellow, config.color)}` : "";
  return `${label}${stampText ? `${SP}${stampText}` : ""}${SP.repeat(2)}${parts.join(`${SP}${style("\u00b7", ANSI.dim, config.color)}${SP}`)}`;
}

function formatCompactWindows(
  quota: ProviderQuota,
  windows: readonly WindowQuota[],
  multipleLabels: boolean,
  config: QuotaConfig,
  now: number,
): string {
  const tightest = [...windows].sort(
    (left, right) => right.used - left.used || WINDOW_ORDER[left.window] - WINDOW_ORDER[right.window],
  )[0];
  const parts: string[] = [];
  if (tightest) {
    const head = multipleLabels
      ? `${tightest.label} ${WINDOW_LABEL[tightest.window]}`
      : WINDOW_LABEL[tightest.window];
    parts.push(
      `${style(head, ANSI.dim, config.color)}${SP}${style(formatPercent(tightest.used), healthColor(tightest.used), config.color)}`,
    );
    const reset = config.showResets ? resetText(tightest.resetsAt, now) : "";
    if (reset) parts.push(style(reset, ANSI.dim, config.color));
  }
  if (config.showCredits && quota.credits !== undefined) {
    parts.push(style(`${formatNumber(quota.credits)} cr`, ANSI.dim, config.color));
  }
  return parts.join(SP);
}

/** Keep the top-N riskiest windows, rendered in chronological order so redraws keep columns stable. */
function selectWindows(
  quota: ProviderQuota,
  config: QuotaConfig,
): { windows: WindowQuota[]; multipleLabels: boolean } {
  const windows = [...quota.windows]
    .sort((left, right) => right.used - left.used || WINDOW_ORDER[left.window] - WINDOW_ORDER[right.window])
    .slice(0, config.maxWindowsPerProvider)
    .sort((left, right) => WINDOW_ORDER[left.window] - WINDOW_ORDER[right.window] || right.used - left.used);
  // Only disambiguate when one window carries several labels (e.g. Antigravity's
  // Gemini vs 3P weekly); providers with one label per window read better bare.
  const labelsByWindow = new Map<WindowClass, Set<string>>();
  for (const entry of windows) {
    const labels = labelsByWindow.get(entry.window) ?? new Set<string>();
    labels.add(entry.label);
    labelsByWindow.set(entry.window, labels);
  }
  const multipleLabels = [...labelsByWindow.values()].some((labels) => labels.size > 1);
  return { windows, multipleLabels };
}

/** Fresh snapshots show no age at all; only a cache-served snapshot gets a yellow `~` stamp. */
function staleStamp(fetchedAt: number | undefined, config: QuotaConfig, now: number): string | undefined {
  if (config.refreshTime === "off" || typeof fetchedAt !== "number" || !Number.isFinite(fetchedAt)) {
    return undefined;
  }
  if (now - fetchedAt <= config.staleAfterMinutes * 60_000) return undefined;
  if (config.refreshTime === "clock") {
    const date = new Date(fetchedAt);
    const time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    return `~${now - fetchedAt > 24 * 3_600_000 ? `${date.getMonth() + 1}/${date.getDate()} ${time}` : time}`;
  }
  return `~${ageText(fetchedAt, now) ?? "?"}`;
}

function usedFraction(limit: UsageLimit): number | undefined {
  const amount = limit.amount;
  if (!amount) return undefined;
  if (typeof amount.usedFraction === "number" && Number.isFinite(amount.usedFraction)) {
    return Math.min(1, Math.max(0, amount.usedFraction));
  }
  if (typeof amount.used === "number" && typeof amount.limit === "number" && amount.limit > 0) {
    return Math.min(1, Math.max(0, amount.used / amount.limit));
  }
  return undefined;
}

function windowClass(limit: UsageLimit): WindowClass | undefined {
  const id = limit.scope?.windowId ?? limit.window?.id;
  if (id === "5h") return "5h";
  if (id === "daily" || id === "1d" || id === "24h") return "1d";
  if (id === "weekly" || id === "7d") return "7d";
  if (id === "monthly" || id === "30d") return "mo";
  const duration = limit.window?.durationMs;
  if (typeof duration === "number" && Number.isFinite(duration)) {
    const hour = 3_600_000;
    if (Math.abs(duration - 5 * hour) <= 60_000) return "5h";
    if (Math.abs(duration - 24 * hour) <= 60_000) return "1d";
    if (Math.abs(duration - 7 * 24 * hour) <= 60_000) return "7d";
    if (Math.abs(duration - 30 * 24 * hour) <= 60_000) return "mo";
  }
  return undefined;
}

function formatPercent(used: number): string {
  const percent = Math.round(used * 1000) / 10;
  return `${Number.isInteger(percent) ? percent.toFixed(0) : percent.toFixed(1)}%`;
}

function resetText(resetsAt: number | undefined, now: number): string {
  if (typeof resetsAt !== "number" || !Number.isFinite(resetsAt)) return "";
  const minutes = Math.round((resetsAt - now) / 60_000);
  if (minutes <= 0) return "\u21bb now";
  if (minutes < 60) return `\u21bb ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  if (hours < 24) return `\u21bb ${hours}h${restMinutes > 0 ? `${restMinutes}m` : ""}`;
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return `\u21bb ${days}d${restHours > 0 ? `${restHours}h` : ""}`;
}

/** Drop duplicate cache rows (same provider fetched through another base URL) once a newer row exists. */
function filterRecentReports(
  reports: readonly CachedUsageReport[],
  staleAfterMinutes: number,
): CachedUsageReport[] {
  const newest = new Map<string, number>();
  for (const { report } of reports) {
    if (typeof report.fetchedAt !== "number" || !Number.isFinite(report.fetchedAt)) continue;
    newest.set(report.provider, Math.max(newest.get(report.provider) ?? 0, report.fetchedAt));
  }
  const windowMs = Math.max(5, staleAfterMinutes) * 60_000;
  return reports.filter(({ report }) => {
    const latest = newest.get(report.provider);
    if (latest === undefined || typeof report.fetchedAt !== "number") return true;
    return latest - report.fetchedAt <= windowMs;
  });
}

function ageText(fetchedAt: number | undefined, now: number): string | undefined {
  if (typeof fetchedAt !== "number" || !Number.isFinite(fetchedAt)) return undefined;
  const minutes = Math.max(0, Math.round((now - fetchedAt) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? value.toFixed(0) : (Math.round(value * 10) / 10).toFixed(1);
}

function shortProviderLabel(provider: string): string {
  const known = PROVIDER_SHORT[provider];
  if (known) return known;
  const initials = provider
    .split(/[-_.\s]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 3);
  return initials || provider.slice(0, 3).toUpperCase();
}

function shortLimitLabel(label: string): string {
  const clean = sanitize(label);
  const known = LIMIT_SHORT[clean];
  if (known) return known;
  if (clean.length <= 16) return clean;
  const initials = clean
    .split(/[\s&/()_-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 4);
  return initials || clean.slice(0, 8);
}

function providerName(provider: string): string {
  return (
    PROVIDER_NAME[provider] ??
    provider
      .split(/[-_]/)
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase() + part.slice(1))
      .join(" ")
  );
}

function sanitize(text: string): string {
  return text.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 32);
}

function style(text: string, codes: string, enabled: boolean): string {
  return enabled ? `${codes}${text}${ANSI.reset}` : text;
}

function healthColor(used: number): string {
  return used >= 0.9 ? ANSI.red : used >= 0.7 ? ANSI.yellow : ANSI.green;
}

/** Fixed-width consumption gauge: filled cells follow `used`, so empty space is headroom. */
function formatGauge(used: number, color: boolean): string {
  const exact = Math.min(1, Math.max(0, used)) * GAUGE_WIDTH;
  const full = Math.floor(exact);
  const partialIndex = Math.round((exact - full) * 8);
  const partial = partialIndex === 0 ? "" : PARTIAL_BLOCKS[partialIndex - 1];
  const filled = "\u2588".repeat(full) + partial;
  const empty = "\u2591".repeat(GAUGE_WIDTH - full - (partial ? 1 : 0));
  const open = style("[", ANSI.dim, color);
  const close = style("]", ANSI.dim, color);
  return `${open}${filled ? style(filled, healthColor(used), color) : ""}${empty ? style(empty, ANSI.dim, color) : ""}${close}`;
}

function maxUsed(quota: ProviderQuota): number {
  return quota.windows.reduce((max, entry) => Math.max(max, entry.used), 0);
}
