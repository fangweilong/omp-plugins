import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { all } from "@oh-my-pi/pi-coding-agent/config/registry";
import type { AutocompleteProvider, SettingHandleRaw } from "./types.js";
import { loadConfig } from "./config.js";
import { injector } from "./injector.js";
import { loadLocaleBundle } from "./locales/index.js";
import { registerLangCommand } from "./commands/lang.js";
import { hookHotkeysUi } from "./hotkeys.js";
import { installUiPatches } from "./ui/patches.js";

const ACTIVATED_KEY = Symbol.for("omp.i18n.activated");

export default function activate(pi: ExtensionAPI): void {
  // omp can load one plugin through both `extensions:` and a linked plugin
  // directory; the second load would register duplicate handlers and wrap the
  // same host prototypes twice.
  const host = globalThis as unknown as Record<symbol, boolean | undefined>;
  if (host[ACTIVATED_KEY]) return;
  host[ACTIVATED_KEY] = true;

  const config = loadConfig();
  // Install render-time UI translations before any component paints.
  installUiPatches(config.locale);
  const allSettings = (all ? all() : []) as unknown as SettingHandleRaw[];
  const piPkg = (pi as unknown as { pi?: Record<string, unknown> }).pi;

  // Initialize snapshots and apply configured locale (Settings + Keybindings + Agents)
  if (allSettings.length > 0) {
    injector.init(allSettings);
    if (config.locale !== "en") {
      injector.applyLocale(config.locale, allSettings, piPkg);
    }
  }

  // Hook interactive hotkeys UI (/hotkeys dialog)
  hookHotkeysUi(pi);

  // Register slash command /lang
  registerLangCommand(pi);

  // Hook session_start to notify, localize working message, and stack autocomplete translation provider
  pi.on("session_start", async (_event, ctx) => {
    const cur = injector.getCurrentLocale();
    if (cur === "zh-CN") {
      ctx.ui.notify(
        `[i18n] 多语言设置插件已就绪 (当前: 简体中文，输入 /lang 可切换)`,
        "info"
      );

      // Localize the working spinner message
      const uiWithWorking = ctx.ui as unknown as {
        setWorkingMessage?: (msg?: string) => void;
      };
      if (typeof uiWithWorking?.setWorkingMessage === "function") {
        uiWithWorking.setWorkingMessage("思考中...");
      }
    }

    // Wrap the autocomplete provider to localize slash command descriptions
    const ui = ctx.ui as unknown as {
      addAutocompleteProvider?: (
        factory: (baseProvider: AutocompleteProvider) => AutocompleteProvider
      ) => void;
    };

    if (typeof ui?.addAutocompleteProvider === "function") {
      ui.addAutocompleteProvider((baseProvider: AutocompleteProvider): AutocompleteProvider => {
        return {
          async getSuggestions(lines, cursorLine, cursorCol, options) {
            const result = await baseProvider.getSuggestions(lines, cursorLine, cursorCol, options);
            if (!result || !Array.isArray(result.items)) {
              return result;
            }

            const currentLocale = injector.getCurrentLocale();
            if (currentLocale === "en") {
              return result;
            }

            const bundle = loadLocaleBundle("zh-CN");
            for (const item of result.items) {
              const rawName = item.name || item.value || item.label;
              if (typeof rawName === "string") {
                const cleanName = rawName.replace(/^\//, "").trim();
                let zhDesc = bundle.commands[cleanName];

                // If not matched, try sub-identifier after colon (e.g. "mcp:add" -> "add")
                if (!zhDesc && cleanName.includes(":")) {
                  const sub = cleanName.split(":").pop();
                  if (sub) zhDesc = bundle.commands[sub];
                }

                // If not matched, try sub-command after space (e.g. "todo done" -> "done")
                if (!zhDesc && cleanName.includes(" ")) {
                  const sub = cleanName.split(/\s+/).pop();
                  if (sub) zhDesc = bundle.commands[sub];
                }

                if (zhDesc) {
                  // Only translate the command description, do NOT translate the command name itself
                  const hasBundled =
                    typeof item.description === "string" &&
                    item.description.includes("(bundled)");
                  item.description = hasBundled ? `${zhDesc} (内置)` : zhDesc;
                }
              }
            }

            return result;
          },
          applyCompletion(lines, cursorLine, cursorCol, item, prefix) {
            return baseProvider.applyCompletion(lines, cursorLine, cursorCol, item, prefix);
          },
        };
      });
    }
  });
}
