import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

export default function testExt(pi: ExtensionAPI) {
  const host = pi as Record<string, unknown>;
  const piPkg = host.pi as Record<string, unknown> | undefined;
  if (!piPkg) return;

  const IM = piPkg.InteractiveMode as { prototype?: Record<string, unknown> } | undefined;
  if (!IM || !IM.prototype) return;

  IM.prototype.handleHotkeysCommand = function(...args: unknown[]) {
    console.error("[REPLACED handleHotkeysCommand CALLED!]");
    console.error("this keys:", Object.keys(this));
    console.error("this.showCommandReport:", typeof (this as any).showCommandReport);
    console.error("this.keybindings:", typeof (this as any).keybindings);
    console.error("this.ui:", typeof (this as any).ui);
  };

  // How can we find the IM instance?
  // Let's hook constructor of InteractiveMode!
  const OrigIM = piPkg.InteractiveMode as any;
  // Or in prototype init?
  const origInit = IM.prototype.init as Function | undefined;
  if (typeof origInit === "function") {
    IM.prototype.init = function(...args: unknown[]) {
      console.error("[IM.prototype.init CALLED!]");
      // Call handleHotkeysCommand to test!
      (this as any).handleHotkeysCommand();
      return origInit.apply(this, args);
    };
  }
}
