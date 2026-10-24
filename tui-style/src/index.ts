import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { registerTuiStyleCommand } from "./command.js";
import { getStyleState, reloadStyleConfig } from "./state.js";
import { installUserMessageStyle } from "./user-message.js";

/**
 * Install TUI style overrides before the first transcript paint.
 *
 * Only host-bundled `@oh-my-pi/pi-tui` internals are touched, and every patch
 * checks the export it needs; a renamed host export disables that part instead
 * of failing plugin load.
 */
export default function activate(pi: ExtensionAPI): void {
  const state = getStyleState();
  if (state.activated) return;
  state.activated = true;

  reloadStyleConfig(state);
  installUserMessageStyle(state);
  registerTuiStyleCommand(pi, state);
}
