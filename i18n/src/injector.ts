import type {
  LocaleBundle,
  SettingHandleRaw,
  SettingOptionI18n,
  SettingOptionRaw,
  SettingSnapshot,
  SupportedLocale,
} from "./types.js";
import { loadLocaleBundle } from "./locales/index.js";
import { applySettingsTabs } from "./ui/patches.js";
import { bumpUiEpoch, setUiLocale } from "./ui/locale-state.js";

function safeSetProperty(target: object, prop: string, value: unknown): boolean {
  try {
    const desc = Object.getOwnPropertyDescriptor(target, prop);
    if (!desc || desc.writable || desc.set) {
      (target as Record<string, unknown>)[prop] = value;
      return true;
    }
    if (desc.configurable) {
      Object.defineProperty(target, prop, {
        value,
        writable: true,
        enumerable: desc.enumerable ?? true,
        configurable: true,
      });
      return true;
    }
  } catch {
    try {
      Object.defineProperty(target, prop, {
        value,
        writable: true,
        enumerable: true,
        configurable: true,
      });
      return true;
    } catch {
      // Silently fail if completely immutable
    }
  }
  return false;
}

export class SettingsInjector {
  private currentLocale: SupportedLocale = "en";
  private initialized = false;
  /** `def.ui.group` as it was before localization, keyed by setting id. */
  private originalGroups = new Map<string, string>();

  public getCurrentLocale(): SupportedLocale {
    return this.currentLocale;
  }

  public getCommandDescription(name: string): string | undefined {
    if (this.currentLocale === "en") return undefined;
    const bundle = loadLocaleBundle(this.currentLocale);
    return bundle.commands[name];
  }

  public applyKeybindingsAndAgents(
    locale: SupportedLocale,
    piPkg?: Record<string, unknown>,
    forceReload = false
  ): void {
    if (!piPkg) return;

    const bundle = loadLocaleBundle(locale, forceReload);
    const kb = piPkg.KEYBINDINGS as Record<string, { defaultKeys: unknown; description: string }> | undefined;
    if (kb) {
      for (const [k, v] of Object.entries(kb)) {
        const desc = bundle.keybindings[k];
        if (desc) v.description = desc;
      }
    }

    // Apply or restore BUNDLED_AGENTS using locale bundle
    const agentsFn = piPkg.BUNDLED_AGENTS as (() => Array<{ name: string; description: string }>) | undefined;
    if (typeof agentsFn === "function") {
      const agents = agentsFn();
      for (const a of agents) {
        const desc = bundle.agents[a.name];
        if (desc) a.description = desc;
      }
    }
  }

  public init(allSettings: SettingHandleRaw[]): void {
    if (this.initialized) return;
    this.initialized = true;
    for (const setting of allSettings) {
      const group = setting.definition.ui?.group;
      if (group) this.originalGroups.set(setting.id, group);
    }
  }

  public restore(allSettings: SettingHandleRaw[]): void {
    const enBundle = loadLocaleBundle("en");

    for (const s of allSettings) {
      const def = s.definition;
      const trans = enBundle.settings[s.id];
      if (trans) {
        if (def.ui) {
          if (trans.label) safeSetProperty(def.ui, "label", trans.label);
          if (trans.description) safeSetProperty(def.ui, "description", trans.description);
          if (trans.options && Array.isArray(def.ui.options)) {
            const map = new Map(trans.options.map((o) => [o.value, o]));
            for (const opt of def.ui.options as SettingOptionRaw[]) {
              const orig = map.get(String(opt.value));
              if (orig) {
                if (orig.label) opt.label = orig.label;
                if (orig.description) opt.description = orig.description;
              }
            }
          }
        }
        if (trans.description && def.description) {
          safeSetProperty(def, "description", trans.description);
        }
      }

      const originalGroup = this.originalGroups.get(s.id);
      if (def.ui && originalGroup !== undefined) {
        safeSetProperty(def.ui, "group", originalGroup);
      }
    }
  }

  public applyLocale(
    locale: SupportedLocale,
    allSettings: SettingHandleRaw[],
    piPkg?: Record<string, unknown>,
    forceReload = false
  ): { appliedCount: number; totalCount: number } {
    this.init(allSettings);
    if (forceReload) bumpUiEpoch();
    setUiLocale(locale);
    applySettingsTabs(locale);

    // Apply Keybindings & Agents
    if (piPkg) {
      this.applyKeybindingsAndAgents(locale, piPkg, forceReload);
    }

    // If switching to en, restore English baseline
    this.restore(allSettings);

    if (locale === "en") {
      this.currentLocale = "en";
      return { appliedCount: 0, totalCount: allSettings.length };
    }

    const bundle = loadLocaleBundle(locale, forceReload);
    let appliedCount = 0;

    for (const s of allSettings) {
      const def = s.definition;
      const trans = bundle.settings[s.id];
      let settingTouched = false;

      if (trans) {
        if (def.ui) {
          if (trans.label) {
            if (safeSetProperty(def.ui, "label", trans.label)) settingTouched = true;
          }
          if (trans.description) {
            if (safeSetProperty(def.ui, "description", trans.description)) settingTouched = true;
          }
          if (trans.options && Array.isArray(def.ui.options)) {
            const transOptMap = new Map(
              trans.options.map((o) => [o.value, o])
            );
            for (const opt of def.ui.options as SettingOptionRaw[]) {
              const optTrans = transOptMap.get(String(opt.value));
              if (optTrans) {
                if (optTrans.label) opt.label = optTrans.label;
                if (optTrans.description) opt.description = optTrans.description;
                settingTouched = true;
              }
            }
          }
        }

        if (trans.description && def.description) {
          if (safeSetProperty(def, "description", trans.description)) settingTouched = true;
        }
      }

      // Group translation
      if (def.ui?.group && bundle.groups[def.ui.group]) {
        if (safeSetProperty(def.ui, "group", bundle.groups[def.ui.group])) settingTouched = true;
      }

      if (settingTouched) {
        appliedCount++;
      }
    }

    this.currentLocale = locale;
    return { appliedCount, totalCount: allSettings.length };
  }
}

export const injector = new SettingsInjector();
