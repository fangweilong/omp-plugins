import { readFileSync } from "node:fs";
import path from "node:path";

export interface QuotaConfig {
  /** Provider ids to display, or `"auto"` for every provider with a percentage quota. */
  providers: string[] | "auto";
  /** How often cached usage reports are re-read (the host refreshes them in the background). */
  refreshSeconds: number;
  /** Age at which the refresh stamp turns yellow (data is being served from cache). */
  staleAfterMinutes: number;
  showResets: boolean;
  showCredits: boolean;
  gauge: boolean;
  providerName: "full" | "short";
  refreshTime: "relative" | "clock" | "off";
  /** Leading columns used to line the quota row up under the model name. */
  indent: number;
  maxProviders: number;
  maxWindowsPerProvider: number;
  color: boolean;
}

const DEFAULTS: QuotaConfig = {
  providers: "auto",
  refreshSeconds: 30,
  staleAfterMinutes: 15,
  showResets: true,
  showCredits: false,
  gauge: true,
  providerName: "full",
  refreshTime: "relative",
  indent: 6,
  maxProviders: 3,
  maxWindowsPerProvider: 3,
  color: true,
};

export const CONFIG_FILE_NAME = "statusline-quota.json";

export function configPath(agentDir: string): string {
  return path.join(agentDir, CONFIG_FILE_NAME);
}

export function loadConfig(agentDir: string): QuotaConfig {
  const file = configPath(agentDir);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return { ...DEFAULTS };
  }
  if (!raw || typeof raw !== "object") return { ...DEFAULTS };
  const value = raw as Record<string, unknown>;
  return {
    providers: parseProviders(value.providers),
    refreshSeconds: positive(value.refreshSeconds, DEFAULTS.refreshSeconds, 5, 3600),
    staleAfterMinutes: positive(value.staleAfterMinutes, DEFAULTS.staleAfterMinutes, 1, 10_080),
    showResets: booleanValue(value.showResets, DEFAULTS.showResets),
    showCredits: booleanValue(value.showCredits, DEFAULTS.showCredits),
    gauge: booleanValue(value.gauge, DEFAULTS.gauge),
    providerName: value.providerName === "short" ? "short" : "full",
    refreshTime:
      value.refreshTime === "off" || value.refreshTime === "clock" ? value.refreshTime : "relative",
    indent: positive(value.indent, DEFAULTS.indent, 0, 16),
    maxProviders: positive(value.maxProviders, DEFAULTS.maxProviders, 1, 8),
    maxWindowsPerProvider: positive(value.maxWindowsPerProvider, DEFAULTS.maxWindowsPerProvider, 1, 6),
    color: booleanValue(value.color, DEFAULTS.color),
  };
}

function parseProviders(value: unknown): string[] | "auto" {
  if (value === undefined || value === "auto") return "auto";
  if (!Array.isArray(value)) return "auto";
  const ids = value.filter((entry): entry is string => typeof entry === "string" && entry.trim() !== "");
  return ids.length > 0 ? ids.map((id) => id.trim()) : "auto";
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function positive(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}
