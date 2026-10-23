import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { LocaleBundle, SupportedLocale } from "../types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const bundleCache = new Map<SupportedLocale, LocaleBundle>();

function safeReadJson<T>(filePath: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(raw) as T;
    }
  } catch (err) {
    console.error(`[i18n] Failed to load JSON from ${filePath}:`, err);
  }
  return fallback;
}

export function loadLocaleBundle(locale: SupportedLocale, forceReload = false): LocaleBundle {
  if (!forceReload) {
    const cached = bundleCache.get(locale);
    if (cached) {
      return cached;
    }
  }

  const localeDir = path.join(__dirname, locale);

  const settings = safeReadJson<LocaleBundle["settings"]>(
    path.join(localeDir, "settings.json"),
    {}
  );
  const tabs = safeReadJson<LocaleBundle["tabs"]>(
    path.join(localeDir, "tabs.json"),
    {}
  );
  const groups = safeReadJson<LocaleBundle["groups"]>(
    path.join(localeDir, "groups.json"),
    {}
  );
  const ui = safeReadJson<LocaleBundle["ui"]>(
    path.join(localeDir, "ui.json"),
    {}
  );
  const commands = safeReadJson<LocaleBundle["commands"]>(
    path.join(localeDir, "commands.json"),
    {}
  );
  const keybindings = safeReadJson<LocaleBundle["keybindings"]>(
    path.join(localeDir, "keybindings.json"),
    {}
  );
  const agents = safeReadJson<LocaleBundle["agents"]>(
    path.join(localeDir, "agents.json"),
    {}
  );
  const tools = safeReadJson<LocaleBundle["tools"]>(
    path.join(localeDir, "tools.json"),
    {}
  );
  const uiText = safeReadJson<LocaleBundle["uiText"]>(
    path.join(localeDir, "ui-text.json"),
    {}
  );

  const bundle: LocaleBundle = { settings, tabs, groups, ui, commands, keybindings, agents, tools, uiText };
  bundleCache.set(locale, bundle);
  return bundle;
}
