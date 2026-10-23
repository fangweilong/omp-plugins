import path from "node:path";
import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "@oh-my-pi/pi-coding-agent";
import { UsageCacheReader } from "./cache.js";
import { configPath, loadConfig } from "./config.js";
import { formatDetails, formatStatus } from "./format.js";

const STATUS_KEY = "quota";
const REFRESH_TIMEOUT_MS = 45_000;

export default function activate(pi: ExtensionAPI): void {
  const agentDir = pi.pi.getAgentDir();
  const config = loadConfig(agentDir);
  const reader = new UsageCacheReader(path.join(agentDir, "agent.db"));
  let timer: Timer | undefined;
  let timerCtx: ExtensionContext | undefined;
  let lastText: string | undefined;
  let loggedFailure = false;

  const eligible = (ctx: ExtensionContext): boolean =>
    ctx.hasUI && ctx.mode === "tui" && ctx.agent.kind === "main";

  const render = (ctx: ExtensionContext): string | undefined => {
    if (!eligible(ctx)) return undefined;
    let text: string | undefined;
    try {
      text = formatStatus(reader.read(), config);
      loggedFailure = false;
    } catch (error) {
      // A locked or migrating agent.db must never take the session down; retry on
      // the next tick instead of surfacing a status line error.
      if (!loggedFailure) {
        loggedFailure = true;
        pi.logger.debug("statusline-quota: cannot read usage cache", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return lastText;
    }
    if (text !== undefined) lastText = text;
    ctx.ui.setStatus(STATUS_KEY, text);
    return text;
  };

  const stop = (): void => {
    if (timer && timerCtx) timerCtx.clearTimer(timer);
    timer = undefined;
    timerCtx = undefined;
  };

  const start = (ctx: ExtensionContext): void => {
    // Subagents share the loaded factory; a subagent session_start/shutdown must
    // not tear down the main session's timer or cache handle.
    if (!eligible(ctx)) return;
    stop();
    render(ctx);
    timerCtx = ctx;
    // Re-setting the status each tick also repaints the status line, which is what
    // makes the host's own 5-minute usage refresh run while the terminal is idle.
    timer = ctx.setInterval(() => render(ctx), config.refreshSeconds * 1000);
  };

  pi.on("session_start", (_event, ctx) => start(ctx));
  pi.on("session_switch", (_event, ctx) => start(ctx));
  pi.on("session_shutdown", (_event, ctx) => {
    if (!eligible(ctx)) return;
    stop();
    reader.close();
  });

  pi.registerCommand("quota", {
    description: "Show subscription quota; `/quota refresh [force]` refreshes usage",
    getArgumentCompletions: (prefix) =>
      ["refresh", "refresh force", "status"]
        .filter((value) => value.startsWith(prefix.trim()))
        .map((value) => ({
          value,
          label: value,
          description: value.startsWith("refresh")
            ? value.endsWith("force")
              ? "Bypass the 5-minute usage cache and refetch"
              : "Refetch usage (uses the host cache when fresh)"
            : "Show cached quota details",
        })),
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const action = args.trim().toLowerCase();
      if (action === "refresh" || action === "refresh force" || action === "force") {
        await refreshNow(pi, ctx, reader, render, () => lastText, action.endsWith("force"));
        return;
      }
      let reports;
      try {
        reports = reader.read();
      } catch (error) {
        ctx.ui.notify(
          `Usage cache unavailable: ${error instanceof Error ? error.message : String(error)}. Config: ${configPath(agentDir)}`,
          "error",
        );
        return;
      }
      ctx.ui.notify(formatDetails(reports), "info");
    },
  });
}

async function refreshNow(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  reader: UsageCacheReader,
  render: (ctx: ExtensionContext) => string | undefined,
  previousText: () => string | undefined,
  force: boolean,
): Promise<void> {
  const previous = previousText();
  ctx.ui.notify(force ? "Forcing a subscription usage refresh…" : "Refreshing subscription usage…", "info");
  if (force) {
    // `invalidate` drops the last-good fallback, so a failed refetch would leave
    // the cache empty until a later success. The in-memory line is restored below.
    const invalidated = await runOmp(pi, ["usage", "invalidate"], ctx.cwd);
    if (invalidated !== undefined && invalidated.code !== 0) {
      ctx.ui.notify(`Usage refresh failed: ${tail(invalidated.stderr) || `exit ${invalidated.code}`}`, "error");
      return;
    }
  }
  const fetched = await runOmp(pi, ["usage", "--json"], ctx.cwd);
  if (fetched === undefined) {
    ctx.ui.notify("Usage refresh timed out; the host's background refresh will retry.", "warning");
    return;
  }
  const text = render(ctx);
  if (text === undefined && previous) ctx.ui.setStatus(STATUS_KEY, previous);
  if (fetched.code !== 0) {
    ctx.ui.notify(`Usage refresh failed: ${tail(fetched.stderr) || `exit ${fetched.code}`}`, "error");
    return;
  }
  let count = 0;
  try {
    count = reader.read().length;
  } catch {
    // The fetch already completed; the next tick re-reads the cache.
  }
  ctx.ui.notify(
    count > 0
      ? `Subscription usage refreshed (${count} cached account report${count === 1 ? "" : "s"}).`
      : "Usage refresh returned no reports; the providers may be offline.",
    count > 0 ? "info" : "warning",
  );
}

async function runOmp(pi: ExtensionAPI, args: string[], cwd: string) {
  try {
    return await pi.exec(process.execPath, args, { cwd, timeout: REFRESH_TIMEOUT_MS });
  } catch {
    return undefined;
  }
}

function tail(text: string): string {
  return text.trim().split(/\r?\n/).slice(-1)[0]?.slice(0, 240) ?? "";
}
