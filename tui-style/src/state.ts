import { DEFAULT_CONFIG, loadConfig } from "./config.js";
import type { TuiStyleConfig } from "./types.js";

/**
 * Process-wide plugin state.
 *
 * omp may load the same plugin twice (extension list + linked plugin dir), so
 * state and prototype patches are keyed on `globalThis` instead of module
 * exports: a second load must not wrap the host renderers again.
 */
export interface TuiStyleState {
  config: TuiStyleConfig;
  activated: boolean;
  userMessagePatched: boolean;
}

const STATE_KEY = Symbol.for("omp.tui-style.state");

export function getStyleState(): TuiStyleState {
  const host = globalThis as unknown as Record<symbol, TuiStyleState | undefined>;
  let state = host[STATE_KEY];
  if (!state) {
    state = {
      config: structuredClone(DEFAULT_CONFIG),
      activated: false,
      userMessagePatched: false,
    };
    host[STATE_KEY] = state;
  }
  return state;
}

/** Re-read the config file into the shared state. */
export function reloadStyleConfig(state: TuiStyleState): TuiStyleConfig {
  state.config = loadConfig();
  return state.config;
}
