import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

export default function testExt(pi: ExtensionAPI) {
  const host = pi as Record<string, unknown>;
  const piPkg = host.pi as Record<string, unknown> | undefined;
  if (!piPkg) return;

  const IM = piPkg.InteractiveMode as { prototype?: Record<string, unknown> } | undefined;
  if (IM && IM.prototype && typeof IM.prototype.handleHotkeysCommand === "function") {
    console.error("[FUNCTION SOURCE]:", IM.prototype.handleHotkeysCommand.toString());
  }
}
