import { UserMessageComponent } from "@oh-my-pi/pi-tui/chat/user-message";
import { ensureThemeSync, theme } from "@oh-my-pi/pi-tui/theme";
import { bgAnsi, fgAnsi } from "@oh-my-pi/pi-tui/theme/color";
import type { ThemeColor } from "@oh-my-pi/pi-tui/theme/schema";
import { stripTerminalSequences, visibleWidth } from "@oh-my-pi/pi-tui/utils";
import { isHexColor } from "./config.js";
import type { TuiStyleState } from "./state.js";

/** Prompt-zone marks the component wraps around its first and last rows. */
const OSC133_ZONE_START = "\x1b]133;A\x07";
const OSC133_ZONE_CLOSE = "\x1b]133;B\x07\x1b]133;C\x07\x1b]133;D;0\x07";

/** Narrowest bubble that still reads as a card, in columns. */
const MIN_BUBBLE_WIDTH = 16;

/** Rec. 601 luma (0..1) of a validated `#rrggbb` color. */
function luma(hex: string): number {
  const r = Number.parseInt(hex.slice(1, 3), 16) / 255;
  const g = Number.parseInt(hex.slice(3, 5), 16) / 255;
  const b = Number.parseInt(hex.slice(5, 7), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Visible width of a rendered row without its trailing background fill. */
function contentWidth(line: string): number {
  return visibleWidth(stripTerminalSequences(line).replace(/\s+$/, ""));
}

/**
 * Restyle the user bubble as an IM-style turn: a card that hugs its content and
 * sits on the right, so it never shares the left-hand card vocabulary of tool
 * calls. `align: "left"` keeps the previous full-width look.
 *
 * Recoloring happens on this component's rendered rows, never on the global
 * `userMessageBg` / `userMessageText` tokens: the composer and status line also
 * paint with those tokens, and overriding them would change the input box too.
 *
 * The component already pads the bubble with one blank row above and below, so
 * the frame reuses those rows instead of adding height: the blank top row
 * becomes the top rule, the blank bottom row the bottom rule, and every other
 * row gets a side rail. OSC 133 prompt-zone marks stay put.
 *
 * Tern-native terminals (`describe()` cards) have their own card chrome and are
 * left to the host.
 */
export function installUserMessageStyle(state: TuiStyleState): void {
  if (state.userMessagePatched) return;
  const prototype = UserMessageComponent.prototype as unknown as Record<string, unknown>;
  if (typeof prototype.render !== "function") return;
  state.userMessagePatched = true;

  const resolveFrameColor = (color: string): string => {
    ensureThemeSync();
    if (isHexColor(color)) return fgAnsi(color, theme.getColorMode());
    try {
      return theme.getFgAnsi(color as ThemeColor);
    } catch {
      return theme.getFgAnsi("accent");
    }
  };

  const originalRender = prototype.render as (this: UserMessageComponent, width: number) => readonly string[];
  // The component memoizes its own rows; keep the restyled copy keyed on that
  // array so a repaint with unchanged content allocates nothing.
  const styledRows = new WeakMap<readonly string[], { key: string; rows: readonly string[] }>();
  // Content-fit sizing needs a probe render; the message text of an instance
  // never changes, so one probe per (width, frame, align) is enough.
  const fittedWidth = new WeakMap<object, { key: string; bubble: number; probeInner: number }>();

  prototype.render = function (this: UserMessageComponent, width: number): readonly string[] {
    const style = state.config.userMessage;
    const alignRight = style.align === "right" && width >= 24;
    const frame = state.config.enabled && style.frame && width - 2 >= 4;
    const recolor = state.config.enabled && (style.background !== null || style.foreground !== null);
    if (!frame && !recolor && !alignRight) return originalRender.call(this, width);

    const deco = frame ? 2 : 0;
    const fitKey = `${width}\0${frame}\0${alignRight}`;
    let bubbleWidth = width;
    let probeInner = width - deco;
    let lines: readonly string[] | undefined;
    if (alignRight) {
      const cached = fittedWidth.get(this);
      if (cached?.key === fitKey) {
        bubbleWidth = cached.bubble;
        probeInner = cached.probeInner;
      } else {
        const maxBubble = Math.max(MIN_BUBBLE_WIDTH, width - Math.max(4, Math.floor(width * 0.3)));
        probeInner = Math.max(4, maxBubble - deco);
        const probe = originalRender.call(this, probeInner);
        const widest = probe.reduce((max, line) => Math.max(max, contentWidth(line)), 0);
        bubbleWidth = Math.min(maxBubble, Math.max(MIN_BUBBLE_WIDTH, widest + 1 + deco));
        fittedWidth.set(this, { key: fitKey, bubble: bubbleWidth, probeInner });
      }
    }

    const inner = bubbleWidth - deco;
    if (inner !== probeInner || lines === undefined) {
      lines = originalRender.call(this, inner);
    }
    if (!Array.isArray(lines) || lines.length === 0) return lines;

    ensureThemeSync();
    const sourceBg = theme.getBgAnsi("userMessageBg");
    const sourceFg = theme.getFgOnBgAnsi("userMessageText", "userMessageBg");
    const targetBg = style.background ? bgAnsi(style.background, theme.getColorMode()) : sourceBg;
    const targetFg = style.foreground
      ? fgAnsi(style.foreground, theme.getColorMode())
      : style.background && isHexColor(style.background)
        ? fgAnsi(luma(style.background) > 0.5 ? "#000000" : "#e5e5e7", theme.getColorMode())
        : sourceFg;
    const frameColor = frame ? resolveFrameColor(style.color) : "";
    const indent = " ".repeat(Math.max(0, width - bubbleWidth));

    const box = theme.boxRound;
    const key = [
      width,
      frame ? "frame" : "plain",
      sourceBg,
      sourceFg,
      targetBg,
      targetFg,
      frameColor,
      box.topLeft,
      box.horizontal,
      box.vertical,
      style.title,
    ].join("\0");
    const cachedRows = styledRows.get(lines);
    if (cachedRows?.key === key) return cachedRows.rows;

    // `\x1b[39m` means "terminal default foreground"; replacing it would leak a
    // fixed color into resets that are meant to fall back.
    const retint = (text: string): string => {
      let out = targetBg === sourceBg ? text : text.split(sourceBg).join(targetBg);
      if (targetFg !== sourceFg && sourceFg !== "\x1b[39m") out = out.split(sourceFg).join(targetFg);
      return out;
    };

    const reset = "\x1b[39m\x1b[49m";
    const paint = (text: string) => `${targetBg}${frameColor}${text}`;
    const title = style.title.length > 0 ? ` ${style.title} ` : "";
    const titleWidth = visibleWidth(title);
    const ruleFill = bubbleWidth - 3 - titleWidth;
    const rule = (left: string, right: string, fill: number) =>
      `${paint(left + box.horizontal)}\x1b[1m${title}\x1b[22m${paint(box.horizontal.repeat(fill) + right)}${reset}`;
    const topRule =
      frame && ruleFill >= 0
        ? indent + rule(box.topLeft, box.topRight, ruleFill)
        : frame
          ? `${indent}${paint(box.topLeft + box.horizontal.repeat(bubbleWidth - 2) + box.topRight)}${reset}`
          : undefined;
    const bottomRule = frame
      ? `${indent}${paint(box.bottomLeft + box.horizontal.repeat(bubbleWidth - 2) + box.bottomRight)}${reset}`
      : undefined;

    const rows = lines.map((line, index) => {
      const zone = index === 0 && line.startsWith(OSC133_ZONE_START) ? OSC133_ZONE_START : "";
      const body = zone.length > 0 ? line.slice(OSC133_ZONE_START.length) : line;
      const closeAt = body.indexOf(OSC133_ZONE_CLOSE);
      const suffix = closeAt >= 0 ? body.slice(closeAt) : "";
      const content = closeAt >= 0 ? body.slice(0, closeAt) : body;
      const blank = stripTerminalSequences(content).trim().length === 0;

      if (topRule !== undefined && blank && index === 0 && lines.length > 1) return zone + topRule;
      if (bottomRule !== undefined && blank && index === lines.length - 1 && lines.length > 1) {
        return bottomRule + suffix;
      }
      if (!frame) return zone + indent + retint(content) + suffix;
      return `${zone}${indent}${paint(box.vertical)}${retint(content)}${paint(box.vertical)}${reset}${suffix}`;
    });

    styledRows.set(lines, { key, rows });
    return rows;
  };

  // The overflow transcript draws a one-row emergency representation straight
  // from `super.render`, bypassing the wrapper above; recolor it, but keep the
  // single-row contract.
  const originalEmergencyRow = prototype.renderTranscriptBlockEmergencyRow as
    | ((this: UserMessageComponent, width: number) => string | undefined)
    | undefined;
  if (typeof originalEmergencyRow === "function") {
    prototype.renderTranscriptBlockEmergencyRow = function (
      this: UserMessageComponent,
      width: number,
    ): string | undefined {
      const style = state.config.userMessage;
      const row = originalEmergencyRow.call(this, width);
      if (row === undefined || !state.config.enabled || (style.background === null && style.foreground === null)) {
        return row;
      }
      ensureThemeSync();
      let out = row;
      if (style.background) {
        const source = theme.getBgAnsi("userMessageBg");
        const target = bgAnsi(style.background, theme.getColorMode());
        if (source !== target) out = out.split(source).join(target);
      }
      return out;
    };
  }
}
