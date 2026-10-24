/** Persistent style configuration for the TUI plugin. */
export interface UserMessageStyle {
  /** Draw a full card frame (top/bottom rules plus side rails) around each user bubble. */
  frame: boolean;
  /** Bubble alignment: `right` hugs its content on the right (IM style); `left` spans the width. */
  align: "left" | "right";
  /** Label embedded in the top rule; an empty string leaves it blank. */
  title: string;
  /** Frame color: a theme color token (`accent`, `warning`, …) or `#rrggbb`. */
  color: string;
  /** Bubble background as `#rrggbb`; `null` keeps the active theme's `userMessageBg`. */
  background: string | null;
  /** Bubble foreground as `#rrggbb`; `null` keeps the active theme's `userMessageText`. */
  foreground: string | null;
}

export interface TuiStyleConfig {
  enabled: boolean;
  userMessage: UserMessageStyle;
}
