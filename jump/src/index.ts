import type { ExtensionAPI, ExtensionCommandContext } from "@oh-my-pi/pi-coding-agent";
import { NavigatorComponent } from "./navigator.js";
import type { EntryLike } from "./transcript.js";

async function openNavigator(ctx: ExtensionCommandContext): Promise<void> {
	if (ctx.mode !== "tui" || !ctx.hasUI) {
		ctx.ui.notify("消息导航仅在交互式终端中可用", "warning");
		return;
	}
	const entries: EntryLike[] = ctx.sessionManager.getBranch().filter(entry => entry.type === "message");
	const userTurns = entries.filter(entry => entry.message?.role === "user").length;
	if (userTurns === 0) {
		ctx.ui.notify("本会话还没有消息", "info");
		return;
	}
	await ctx.ui.custom<void>(
		(tui, theme, _keybindings, done) => new NavigatorComponent({ entries, theme, tui, done }),
		{
			overlay: true,
			overlayOptions: () => ({
				fullscreen: true,
				anchor: "top-left",
				width: "100%",
				maxHeight: "100%",
				margin: 0,
			}),
		},
	);
}

export default function activate(pi: ExtensionAPI): void {
	pi.registerCommand("jump", {
		description: "打开消息导航：置顶列出本会话用户消息，点击跳转到对应位置",
		handler: (_args, ctx) => openNavigator(ctx),
	});
}
