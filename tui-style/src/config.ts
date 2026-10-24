import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { TuiStyleConfig, UserMessageStyle } from "./types.js";

const CONFIG_FILE_NAME = "tui-style.json";

export const DEFAULT_CONFIG: TuiStyleConfig = {
  enabled: true,
  userMessage: {
    frame: true,
    align: "right",
    title: "YOU",
    color: "accent",
    background: "#1e2836",
    foreground: null,
  },
};

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_COLOR.test(value);
}

function readColor(value: unknown, fallback: string | null): string | null {
  if (value === null) return null;
  if (isHexColor(value)) return value;
  return fallback;
}

function readUserMessage(raw: unknown, fallback: UserMessageStyle): UserMessageStyle {
  if (!raw || typeof raw !== "object") return { ...fallback };
  const value = raw as Record<string, unknown>;
  return {
    frame: typeof value.frame === "boolean" ? value.frame : fallback.frame,
    align: value.align === "left" || value.align === "right" ? value.align : fallback.align,
    title:
      typeof value.title === "string" && !value.title.includes("\n") ? value.title : fallback.title,
    color: typeof value.color === "string" && value.color.length > 0 ? value.color : fallback.color,
    background: readColor(value.background, fallback.background),
    foreground: readColor(value.foreground, fallback.foreground),
  };
}

/** Read and validate the config file; malformed fields fall back to defaults instead of failing load. */
export function loadConfig(): TuiStyleConfig {
  const filePath = path.join(os.homedir(), ".omp", CONFIG_FILE_NAME);
  try {
    if (!fs.existsSync(filePath)) return structuredClone(DEFAULT_CONFIG);
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8")) as unknown;
    if (!parsed || typeof parsed !== "object") return structuredClone(DEFAULT_CONFIG);
    const value = parsed as Record<string, unknown>;
    return {
      enabled: typeof value.enabled === "boolean" ? value.enabled : DEFAULT_CONFIG.enabled,
      userMessage: readUserMessage(value.userMessage, DEFAULT_CONFIG.userMessage),
    };
  } catch {
    return structuredClone(DEFAULT_CONFIG);
  }
}

/** Persist the config; returns false when the file cannot be written. */
export function saveConfig(config: TuiStyleConfig): boolean {
  try {
    const filePath = path.join(os.homedir(), ".omp", CONFIG_FILE_NAME);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
    return true;
  } catch {
    return false;
  }
}
