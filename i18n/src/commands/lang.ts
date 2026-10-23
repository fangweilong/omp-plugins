import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { all } from "@oh-my-pi/pi-coding-agent/config/registry";
import type { SettingHandleRaw, SupportedLocale } from "../types.js";
import { injector } from "../injector.js";
import { saveConfig } from "../config.js";

type ExtensionCommandContext = Parameters<
  Parameters<ExtensionAPI["registerCommand"]>[1]["handler"]
>[1];

export function registerLangCommand(pi: ExtensionAPI): void {
  const piPkg = (pi as unknown as { pi?: Record<string, unknown> }).pi;

  pi.registerCommand("lang", {
    description: "Switch or view language for omp settings (e.g. /lang zh-CN or /lang en)",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const target = args.trim().toLowerCase();
      const allSettings = (all ? all() : []) as unknown as SettingHandleRaw[];

      if (!target || target === "status") {
        const cur = injector.getCurrentLocale();
        ctx.ui.notify(
          `[i18n] Current language: ${cur}. Supported: zh-CN, en. Use "/lang zh-CN" or "/lang en" to switch.`,
          "info"
        );
        return;
      }

      if (target === "reload") {
        const cur = injector.getCurrentLocale();
        const res = injector.applyLocale(cur, allSettings, piPkg, true);
        ctx.ui.notify(
          `[i18n] Reloaded translations for ${cur}: ${res.appliedCount}/${res.totalCount} settings localized.`,
          "info"
        );
        return;
      }

      let newLocale: SupportedLocale | null = null;
      if (target === "zh" || target === "zh-cn" || target === "cn" || target === "chinese") {
        newLocale = "zh-CN";
      } else if (target === "en" || target === "en-us" || target === "english") {
        newLocale = "en";
      }

      if (!newLocale) {
        ctx.ui.notify(
          `[i18n] Unknown language: "${args.trim()}". Supported options: zh-CN, en, reload`,
          "warning"
        );
        return;
      }

      const res = injector.applyLocale(newLocale, allSettings, piPkg);
      saveConfig({ locale: newLocale });

      const msg =
        newLocale === "zh-CN"
          ? `[i18n] 已切换语言为简体中文 (已注入设置项、命令、快捷键与智能体)`
          : `[i18n] Switched language to English (restored original settings and definitions)`;

      ctx.ui.notify(msg, "info");
    },
  });
}
