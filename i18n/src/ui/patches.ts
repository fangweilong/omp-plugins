import { Loader } from "@oh-my-pi/pi-tui/components/loader";
import { AssistantMessageComponent } from "@oh-my-pi/pi-tui/chat/assistant-message";
import { BashExecutionComponent } from "@oh-my-pi/pi-tui/chat/bash-execution";
import { EvalExecutionComponent } from "@oh-my-pi/pi-tui/chat/eval-execution";
import { ReadToolGroupComponent } from "@oh-my-pi/pi-tui/chat/read-tool-group";
import { ToolExecutionComponent } from "@oh-my-pi/pi-tui/chat/tool-execution";
import { ApprovalDialogComponent } from "@oh-my-pi/pi-tui/overlays/approval-dialog";
import { PlanReviewOverlay } from "@oh-my-pi/pi-tui/overlays/plan-review-overlay";
import { SettingsSelectorComponent } from "@oh-my-pi/pi-tui/overlays/settings-selector";
import { TAB_LEADS, TAB_METADATA } from "@oh-my-pi/pi-tui/overlays/settings-defs";
import { loadLocaleBundle } from "../locales/index.js";
import type { SupportedLocale } from "../types.js";
import { setUiLocale } from "./locale-state.js";
import { translateLines, translateNativeNode, translateText, type LineTier } from "./translate.js";

/**
 * Installs locale-aware translations on host TUI components.
 *
 * Components are patched once per process. Every wrapper consults the shared
 * locale on each call, so `/lang` switches take effect on the next repaint and
 * English needs no restore step.
 *
 * These imports are host-bundled internals, verified against omp 18.12.x.
 * A renamed export leaves `undefined` here and the corresponding patch is
 * skipped rather than failing plugin load.
 */

type PatchTarget = { prototype?: Record<string, unknown> } | undefined;

interface PatchState {
  /** Prototypes already wrapped; shared because a plugin can load twice. */
  prototypes: Set<object>;
  /** English tab labels/leads captured before the first localization. */
  tabLabels: Map<string, string>;
  tabLeads: Map<string, string>;
  installed: boolean;
}

const STATE_KEY = Symbol.for("omp.i18n.uiPatchState");

function patchState(): PatchState {
  const host = globalThis as unknown as Record<symbol, PatchState | undefined>;
  let state = host[STATE_KEY];
  if (!state) {
    state = { prototypes: new Set(), tabLabels: new Map(), tabLeads: new Map(), installed: false };
    host[STATE_KEY] = state;
  }
  return state;
}

function patchMethods(
  component: PatchTarget,
  options: { describe: boolean; render: boolean; tier?: LineTier },
): void {
  const prototype = component?.prototype;
  const state = patchState();
  if (!prototype || state.prototypes.has(prototype)) return;
  state.prototypes.add(prototype);

  if (options.describe && typeof prototype.describe === "function") {
    const original = prototype.describe as (...args: unknown[]) => unknown;
    prototype.describe = function (this: unknown, ...args: unknown[]) {
      return translateNativeNode(original.apply(this, args));
    };
  }

  if (options.render && typeof prototype.render === "function") {
    const original = prototype.render as (...args: unknown[]) => unknown;
    prototype.render = function (this: unknown, ...args: unknown[]) {
      const result = original.apply(this, args);
      return Array.isArray(result) ? translateLines(result as string[], options.tier ?? "chrome") : result;
    };
  }
}

/**
 * Localize the settings tab bar and its per-tab lead sentence.
 *
 * Unlike component patches this mutates host objects, so it records the
 * original English values and restores them for `en`.
 */
export function applySettingsTabs(locale: SupportedLocale): void {
  const state = patchState();
  const bundle = loadLocaleBundle(locale);
  for (const [id, meta] of Object.entries(TAB_METADATA)) {
    const original = state.tabLabels.get(id);
    if (original === undefined) continue;
    meta.label = locale === "en" ? original : (bundle.tabs[id] ?? original);
  }
  for (const [id, lead] of Object.entries(TAB_LEADS)) {
    const original = state.tabLeads.get(id);
    if (original === undefined) continue;
    TAB_LEADS[id] = locale === "en" ? original : translateText(original);
  }
}

export function installUiPatches(locale: SupportedLocale): void {
  const state = patchState();
  if (!state.installed) {
    state.installed = true;
    if (state.tabLabels.size === 0) {
      for (const [id, meta] of Object.entries(TAB_METADATA)) state.tabLabels.set(id, meta.label);
      for (const [id, lead] of Object.entries(TAB_LEADS)) state.tabLeads.set(id, lead);
    }
  }
  setUiLocale(locale);
  if (patchState().prototypes.size > 0) return;

  // Chrome-only surfaces: safe to translate both description and rendered rows.
  patchMethods(ApprovalDialogComponent, { describe: true, render: true });
  patchMethods(Loader, { describe: true, render: true });
  patchMethods(SettingsSelectorComponent, { describe: true, render: true });

  // Tool frames: the description is structured, while rendered rows may include
  // command output, so only exact UI phrases from the dictionary are replaced.
  patchMethods(ToolExecutionComponent, { describe: true, render: true, tier: "frames" });
  patchMethods(BashExecutionComponent, { describe: true, render: true, tier: "frames" });
  patchMethods(EvalExecutionComponent, { describe: true, render: true, tier: "frames" });
  patchMethods(ReadToolGroupComponent, { describe: true, render: true });

  // Assistant prose and the plan body are model output in the rendered path, so
  // only their structured descriptions (which skip markdown nodes) are patched.
  patchMethods(AssistantMessageComponent, { describe: true, render: false });
  patchMethods(PlanReviewOverlay, { describe: true, render: false });
}
