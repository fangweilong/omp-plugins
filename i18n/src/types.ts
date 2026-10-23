export type SupportedLocale = "zh-CN" | "en";

export interface SettingOptionI18n {
  value: string;
  label?: string;
  description?: string;
}

export interface SettingTranslation {
  label?: string;
  description?: string;
  options?: SettingOptionI18n[];
}

export interface SettingSnapshot {
  labelDesc?: PropertyDescriptor;
  descriptionDesc?: PropertyDescriptor;
  directDescriptionDesc?: PropertyDescriptor;
  tabDesc?: PropertyDescriptor;
  groupDesc?: PropertyDescriptor;
  options?: SettingOptionI18n[];
}

export interface LocaleBundle {
  settings: Record<string, SettingTranslation>;
  tabs: Record<string, string>;
  groups: Record<string, string>;
  ui: Record<string, string>;
  commands: Record<string, string>;
  keybindings: Record<string, string>;
  agents: Record<string, string>;
  tools: Record<string, string>;
}

export interface I18nPluginConfig {
  locale: SupportedLocale;
}

export interface SettingOptionRaw {
  value: string;
  label?: string;
  description?: string;
  [key: string]: unknown;
}

export interface SettingUiRaw {
  tab?: string;
  group?: string;
  label?: string;
  description?: string;
  options?: SettingOptionRaw[] | string;
  warning?: string;
  [key: string]: unknown;
}

export interface SettingDefRaw {
  id: string;
  type: string;
  default?: unknown;
  description?: string;
  ui?: SettingUiRaw;
  [key: string]: unknown;
}

export interface SettingHandleRaw {
  slot: number;
  id: string;
  segments?: string[];
  definition: SettingDefRaw;
  [key: string]: unknown;
}

export interface AutocompleteItem {
  name?: string;
  label?: string;
  value?: string;
  description?: string;
  [key: string]: unknown;
}

export interface AutocompleteResult {
  items: AutocompleteItem[];
  prefix?: string;
  [key: string]: unknown;
}

export interface AutocompleteProvider {
  getSuggestions: (
    lines: string[],
    cursorLine: number,
    cursorCol: number,
    options?: unknown
  ) => Promise<AutocompleteResult | null> | AutocompleteResult | null;
  applyCompletion: (
    lines: string[],
    cursorLine: number,
    cursorCol: number,
    item: AutocompleteItem,
    prefix?: string
  ) => unknown;
  [key: string]: unknown;
}
