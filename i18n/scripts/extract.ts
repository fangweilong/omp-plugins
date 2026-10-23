import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { all } from "@oh-my-pi/pi-coding-agent/config/registry";
import type { SettingHandleRaw, SettingOptionRaw } from "../src/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.resolve(__dirname, "../src/locales");
const enDir = path.join(localesDir, "en");
const zhDir = path.join(localesDir, "zh-CN");

export default function extract(pi: ExtensionAPI): void {
  console.log("[i18n-extract] Starting settings extraction from omp runtime...");

  const allSettings = (all ? all() : []) as unknown as SettingHandleRaw[];
  console.log(`[i18n-extract] Total settings discovered: ${allSettings.length}`);

  const enSettings: Record<string, {
    label?: string;
    description?: string;
    options?: Array<{ value: string; label?: string; description?: string }>;
  }> = {};

  const enTabs: Record<string, string> = {};
  const enGroups: Record<string, string> = {};

  for (const s of allSettings) {
    const def = s.definition;
    const ui = def.ui;

    const label = ui?.label;
    const description = ui?.description || def.description;

    let options: Array<{ value: string; label?: string; description?: string }> | undefined;
    if (ui && Array.isArray(ui.options)) {
      options = ui.options.map((opt: SettingOptionRaw) => ({
        value: String(opt.value),
        label: opt.label,
        description: opt.description,
      }));
    }

    if (label || description || options) {
      enSettings[s.id] = {
        label,
        description,
        ...(options ? { options } : {}),
      };
    }

    if (ui?.tab && !enTabs[ui.tab]) {
      enTabs[ui.tab] = ui.tab;
    }
    if (ui?.group && !enGroups[ui.group]) {
      enGroups[ui.group] = ui.group;
    }
  }

  // Ensure directories exist
  for (const dir of [enDir, zhDir]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // Write en files
  fs.writeFileSync(path.join(enDir, "settings.json"), JSON.stringify(enSettings, null, 2), "utf-8");
  fs.writeFileSync(path.join(enDir, "tabs.json"), JSON.stringify(enTabs, null, 2), "utf-8");
  fs.writeFileSync(path.join(enDir, "groups.json"), JSON.stringify(enGroups, null, 2), "utf-8");
  fs.writeFileSync(
    path.join(enDir, "ui.json"),
    JSON.stringify(
      {
        readyNotification: "[i18n] Multi-language settings plugin active",
        switchedZh: "[i18n] Switched language to Simplified Chinese",
        switchedEn: "[i18n] Switched language to English",
      },
      null,
      2
    ),
    "utf-8"
  );

  console.log(`[i18n-extract] Wrote en/settings.json (${Object.keys(enSettings).length} entries)`);
  console.log(`[i18n-extract] Wrote en/tabs.json (${Object.keys(enTabs).length} tabs)`);
  console.log(`[i18n-extract] Wrote en/groups.json (${Object.keys(enGroups).length} groups)`);

  // Read or merge zh-CN files
  const zhSettingsPath = path.join(zhDir, "settings.json");
  let existingZhSettings: typeof enSettings = {};
  if (fs.existsSync(zhSettingsPath)) {
    try {
      existingZhSettings = JSON.parse(fs.readFileSync(zhSettingsPath, "utf-8"));
    } catch {
      existingZhSettings = {};
    }
  }

  const mergedZhSettings: typeof enSettings = { ...existingZhSettings };
  let newKeys = 0;
  for (const [key, val] of Object.entries(enSettings)) {
    if (!mergedZhSettings[key]) {
      mergedZhSettings[key] = {
        label: "",
        description: "",
        ...(val.options
          ? {
              options: val.options.map((o) => ({
                value: o.value,
                label: "",
                description: "",
              })),
            }
          : {}),
      };
      newKeys++;
    }
  }

  fs.writeFileSync(zhSettingsPath, JSON.stringify(mergedZhSettings, null, 2), "utf-8");
  console.log(
    `[i18n-extract] Synced zh-CN/settings.json (retained existing, added ${newKeys} template keys)`
  );

  // zh-CN tabs template
  const zhTabsPath = path.join(zhDir, "tabs.json");
  let existingZhTabs: Record<string, string> = {};
  if (fs.existsSync(zhTabsPath)) {
    try {
      existingZhTabs = JSON.parse(fs.readFileSync(zhTabsPath, "utf-8"));
    } catch {}
  }
  const mergedZhTabs = { ...existingZhTabs };
  for (const tab of Object.keys(enTabs)) {
    if (!mergedZhTabs[tab]) mergedZhTabs[tab] = "";
  }
  fs.writeFileSync(zhTabsPath, JSON.stringify(mergedZhTabs, null, 2), "utf-8");

  // zh-CN groups template
  const zhGroupsPath = path.join(zhDir, "groups.json");
  let existingZhGroups: Record<string, string> = {};
  if (fs.existsSync(zhGroupsPath)) {
    try {
      existingZhGroups = JSON.parse(fs.readFileSync(zhGroupsPath, "utf-8"));
    } catch {}
  }
  const mergedZhGroups = { ...existingZhGroups };
  for (const group of Object.keys(enGroups)) {
    if (!mergedZhGroups[group]) mergedZhGroups[group] = "";
  }
  fs.writeFileSync(zhGroupsPath, JSON.stringify(mergedZhGroups, null, 2), "utf-8");

  // zh-CN ui.json
  const zhUiPath = path.join(zhDir, "ui.json");
  if (!fs.existsSync(zhUiPath)) {
    fs.writeFileSync(
      zhUiPath,
      JSON.stringify(
        {
          readyNotification: "[i18n] 多语言设置插件已就绪 (当前: 简体中文)",
          switchedZh: "[i18n] 已切换语言为简体中文",
          switchedEn: "[i18n] 已切换语言为英文",
        },
        null,
        2
      ),
      "utf-8"
    );
  }

  console.log("[i18n-extract] Extraction completed successfully!");
}
