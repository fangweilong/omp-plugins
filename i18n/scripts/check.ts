import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.resolve(__dirname, "../src/locales");
const enDir = path.join(localesDir, "en");
const zhDir = path.join(localesDir, "zh-CN");

interface SettingItem {
  label?: string;
  description?: string;
  options?: Array<{ value: string; label?: string; description?: string }>;
}

function runCheck(): void {
  const enSettingsPath = path.join(enDir, "settings.json");
  const zhSettingsPath = path.join(zhDir, "settings.json");

  if (!fs.existsSync(enSettingsPath) || !fs.existsSync(zhSettingsPath)) {
    console.error("Missing translation files. Run extract script first.");
    process.exit(1);
  }

  const enSettings = JSON.parse(fs.readFileSync(enSettingsPath, "utf-8")) as Record<string, SettingItem>;
  const zhSettings = JSON.parse(fs.readFileSync(zhSettingsPath, "utf-8")) as Record<string, SettingItem>;

  const totalKeys = Object.keys(enSettings).length;
  let translatedLabels = 0;
  let translatedDescs = 0;
  let fullyTranslated = 0;
  const untranslatedKeys: string[] = [];

  for (const [key, enItem] of Object.entries(enSettings)) {
    const zhItem = zhSettings[key];
    const hasLabel = Boolean(zhItem?.label && zhItem.label.trim() !== "");
    const hasDesc = Boolean(zhItem?.description && zhItem.description.trim() !== "");

    if (hasLabel) translatedLabels++;
    if (hasDesc) translatedDescs++;

    const needsLabel = Boolean(enItem.label);
    const needsDesc = Boolean(enItem.description);

    const isDone = (!needsLabel || hasLabel) && (!needsDesc || hasDesc);
    if (isDone) {
      fullyTranslated++;
    } else {
      untranslatedKeys.push(key);
    }
  }

  console.log("==========================================");
  console.log("       omp-plugin-i18n Status Report      ");
  console.log("==========================================");
  console.log(`Total Settings:      ${totalKeys}`);
  console.log(`Translated Labels:   ${translatedLabels} / ${totalKeys} (${((translatedLabels / totalKeys) * 100).toFixed(1)}%)`);
  console.log(`Translated Descs:    ${translatedDescs} / ${totalKeys} (${((translatedDescs / totalKeys) * 100).toFixed(1)}%)`);
  console.log(`Fully Translated:    ${fullyTranslated} / ${totalKeys} (${((fullyTranslated / totalKeys) * 100).toFixed(1)}%)`);
  console.log("==========================================");

  if (untranslatedKeys.length > 0) {
    console.log(`Sample untranslated keys (${Math.min(untranslatedKeys.length, 10)}/${untranslatedKeys.length}):`);
    for (const k of untranslatedKeys.slice(0, 10)) {
      console.log(` - ${k}`);
    }
  }

  reportUiText();
}

interface UiTextFile {
  phrases?: Record<string, string>;
  chromePhrases?: Record<string, string>;
  prefixes?: Record<string, string>;
  patterns?: Array<{ match: string; replace: string }>;
  toolLabels?: Record<string, string>;
}

function reportUiText(): void {
  const enPath = path.join(enDir, "ui-text.json");
  const zhPath = path.join(zhDir, "ui-text.json");
  if (!fs.existsSync(zhPath)) {
    console.log("[ui-text] No zh-CN/ui-text.json found; skipping runtime UI coverage.");
    return;
  }
  const zh = JSON.parse(fs.readFileSync(zhPath, "utf-8")) as UiTextFile;
  const en = fs.existsSync(enPath) ? (JSON.parse(fs.readFileSync(enPath, "utf-8")) as UiTextFile) : {};

  const sections: Array<[string, Record<string, string> | undefined, Record<string, string> | undefined]> = [
    ["Phrases", zh.phrases, en.phrases],
    ["Chrome phrases", zh.chromePhrases, en.chromePhrases],
    ["Prefixes", zh.prefixes, en.prefixes],
    ["Tool labels", zh.toolLabels, en.toolLabels],
  ];
  console.log("==========================================");
  console.log("        Runtime UI text coverage          ");
  console.log("==========================================");
  for (const [name, zhSection, enSection] of sections) {
    const keys = Object.keys(zhSection ?? {});
    const baseline = Object.keys(enSection ?? {});
    const missing = baseline.filter(key => !(key in (zhSection ?? {})));
    const untranslated = keys.filter(key => {
      const value = zhSection?.[key];
      return !value || value.trim() === "" || value === key;
    });
    console.log(
      `${name}: ${keys.length} keys, ${untranslated.length} untranslated, ${missing.length} missing vs en baseline`
    );
    for (const key of [...untranslated, ...missing].slice(0, 10)) console.log(` - ${key}`);
  }

  const patterns = zh.patterns ?? [];
  let invalid = 0;
  for (const pattern of patterns) {
    try {
      new RegExp(pattern.match);
      if (!pattern.replace) invalid++;
    } catch {
      invalid++;
      console.log(` - invalid pattern: ${pattern.match}`);
    }
  }
  console.log(`Patterns: ${patterns.length}, ${invalid} invalid`);
  console.log("==========================================");
}

runCheck();
