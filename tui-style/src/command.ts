import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { getCurrentThemeName } from "@oh-my-pi/pi-tui/theme";
import { isHexColor, saveConfig } from "./config.js";
import { reloadStyleConfig, type TuiStyleState } from "./state.js";

type CommandContext = Parameters<Parameters<ExtensionAPI["registerCommand"]>[1]["handler"]>[1];

function summarize(state: TuiStyleState): string {
  const style = state.config.userMessage;
  return [
    `enabled: ${state.config.enabled ? "on" : "off"}`,
    `theme: ${getCurrentThemeName() ?? "unknown"}`,
    `frame: ${style.frame ? "on" : "off"}`,
    `align: ${style.align}`,
    `title: ${style.title.length > 0 ? JSON.stringify(style.title) : "off"}`,
    `color: ${style.color}`,
    `background: ${style.background ?? "theme"}`,
    `foreground: ${style.foreground ?? "theme"}`,
    "usage: /tui-style on|off | frame on|off | align left|right | title <label|off> | color <token|#hex> | bg <#hex|off> | fg <#hex|off> | reload",
  ].join("\n");
}

export function registerTuiStyleCommand(pi: ExtensionAPI, state: TuiStyleState): void {
  pi.registerCommand("tui-style", {
    description: "Customize transcript styling: user-message frame, title, and bubble colors",
    handler: async (args: string, ctx: CommandContext) => {
      const trimmed = args.trim();
      const [head = "", ...rest] = trimmed.split(/\s+/);
      const command = head.toLowerCase();
      const value = rest.join(" ").trim();
      const style = state.config.userMessage;

      switch (command) {
        case "":
        case "status":
          ctx.ui.notify(`[tui-style]\n${summarize(state)}`, "info");
          return;
        case "on":
        case "off":
          state.config.enabled = command === "on";
          break;
        case "frame":
          if (value !== "on" && value !== "off") {
            ctx.ui.notify(`[tui-style] frame expects on or off`, "warning");
            return;
          }
          style.frame = value === "on";
          break;
        case "align":
          if (value !== "left" && value !== "right") {
            ctx.ui.notify(`[tui-style] align expects left or right`, "warning");
            return;
          }
          style.align = value;
          break;
        case "title":
          style.title = value === "" || value.toLowerCase() === "off" ? "" : value;
          break;
        case "color":
          if (value === "") {
            ctx.ui.notify(`[tui-style] color needs a theme token or #rrggbb`, "warning");
            return;
          }
          style.color = value;
          break;
        case "bg":
        case "fg": {
          const target = command === "bg" ? "background" : "foreground";
          if (value === "off" || value === "") {
            style[target] = null;
          } else if (isHexColor(value)) {
            style[target] = value;
          } else {
            ctx.ui.notify(`[tui-style] ${command} expects #rrggbb or off`, "warning");
            return;
          }
          break;
        }
        case "reload": {
          reloadStyleConfig(state);
          ctx.ui.notify(`[tui-style] Config reloaded\n${summarize(state)}`, "info");
          return;
        }
        default:
          ctx.ui.notify(`[tui-style] Unknown option: ${command}`, "warning");
          return;
      }

      const saved = saveConfig(state.config);
      const suffix = saved ? "" : " (not saved: config file is not writable)";
      ctx.ui.notify(`[tui-style] Updated; new messages use the new style${suffix}\n${summarize(state)}`, "info");
    },
  });
}
