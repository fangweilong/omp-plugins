import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type { I18nPluginConfig, SupportedLocale } from "./types.js";

const CONFIG_FILE_NAME = "i18n.json";

function getConfigFilePath(): string {
  const homeDir = os.homedir();
  const ompDir = path.join(homeDir, ".omp");
  return path.join(ompDir, CONFIG_FILE_NAME);
}

export function detectSystemLocale(): SupportedLocale {
  const envLang = process.env.OMP_LANG || process.env.LC_ALL || process.env.LANG || "";
  if (envLang.toLowerCase().startsWith("zh")) {
    return "zh-CN";
  }

  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions().locale;
    if (resolved.toLowerCase().startsWith("zh")) {
      return "zh-CN";
    }
  } catch {
    // Ignore error in non-standard runtimes
  }

  return "en";
}

export function loadConfig(): I18nPluginConfig {
  const filePath = getConfigFilePath();
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(content) as unknown;
      if (
        parsed &&
        typeof parsed === "object" &&
        "locale" in parsed &&
        (parsed.locale === "zh-CN" || parsed.locale === "en")
      ) {
        return { locale: parsed.locale };
      }
    }
  } catch (err) {
    console.error("[i18n] Failed to read config file:", err);
  }

  return { locale: detectSystemLocale() };
}

export function saveConfig(config: I18nPluginConfig): void {
  const filePath = getConfigFilePath();
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2), "utf-8");
  } catch (err) {
    console.error("[i18n] Failed to save config file:", err);
  }
}
