import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { injector } from "./injector.js";

const HOTKEY_ACTIONS: Record<string, string> = {
  "Delete char forward (with draft) / exit (empty prompt)": "向后删除字符 (有草稿) / 退出应用 (输入框为空)",
  "Exit": "退出应用程序",
  "Move cursor / browse history": "移动光标 / 浏览提示词历史",
  "Move by word": "按单词移动光标",
  "Start of line": "光标移动至行首",
  "End of line": "光标移动至行尾",
  "Send message": "发送输入提示词",
  "New line": "换行插入新行",
  "Delete word backwards": "向后删除一个单词",
  "Delete to start of line": "删除至当前行行首",
  "Delete to end of line": "删除至当前行行尾",
  "Copy current line": "复制当前所在行",
  "Copy whole prompt": "复制整个提示词内容",
  "Path completion / accept autocomplete": "路径补全 / 采纳自动补全建议",
  "Cancel autocomplete / interrupt active work": "取消自动补全 / 中断当前操作",
  "Clear editor (first) / exit (second)": "清空输入框 (初次) / 退出应用 (再次)",
  "Suspend to background": "挂起应用至后台 (Ctrl+Z)",
  "Reset terminal display": "重置终端显示布局",
  "Cycle thinking level": "循环切换思考推理深度",
  "Cycle role models (slow/default/smol)": "循环切换模型角色 (slow / default / smol)",
  "Cycle role models (backward)": "反向循环切换模型角色",
  "Select model (temporary)": "临时选择当前会话的模型",
  "Select model (set roles)": "选择模型 (并更新角色分配)",
  "Toggle plan mode": "切换规划模式 (/plan)",
  "Search prompt history": "搜索提示词历史记录",
  "Toggle tool output expansion": "展开 / 折叠工具调用输出",
  "Toggle tool activity visibility": "显示 / 隐藏工具执行活动",
  "Hide/show a pending ask question": "隐藏 / 显示等待确认的选项问题",
  "Approve a pending tool call": "批准正在等待的工具调用",
  "Toggle thinking block visibility": "展开 / 折叠思考推理过程",
  "Edit message in external editor": "在外部文本编辑器中编辑消息",
  "Retry last failed assistant turn": "重试上一轮执行失败的回答",
  "Paste image or text from clipboard": "从剪贴板粘贴图片或文本",
  "Speech-to-text (push-to-talk): hold to record, release to transcribe": "语音听写 (按住说话): 按住录音，松开转录",
  "Speech-to-text (push-to-talk) (disabled)": "语音听写 (按住说话) (当前已禁用)",
  "Start/stop live voice mode (/live)": "开启 / 关闭实时语音对话 (/live)",
  "Open the agent hub": "打开智能体中枢 (/agents)",
  "GitHub issue/PR reference": "引用 GitHub Issue 或 PR",
  "Prompt actions (copy / undo / move cursor)": "提示词快捷操作菜单 (复制 / 撤销 / 移动光标)",
  "Slash commands": "斜杠命令自动补全菜单",
  "Run bash command": "在终端中执行 Shell 命令",
  "Run bash command (excluded from context)": "在终端中执行 Shell 命令 (不计入上下文)",
  "Run Python in shared kernel": "在共享内核中执行 Python 代码",
  "Run Python (excluded from context)": "执行 Python 代码 (不计入上下文)",
};

const SECTION_TITLES: Record<string, string> = {
  Navigation: "光标与导航",
  Editing: "输入与编辑",
  Other: "其他与系统控制",
};

export function buildChineseHotkeysMarkdown(): string {
  return [
    "**光标与导航**",
    "",
    "| 按键 | 操作说明 |",
    "|------|----------|",
    "| ↑/↓/←/→ | 移动光标 / 浏览提示词历史 (空行时按 ↑) |",
    "| Alt+←/Alt+→ | 按单词移动光标 |",
    "| Ctrl+A/Home | 光标移动至行首 |",
    "| Ctrl+E/End | 光标移动至行尾 |",
    "",
    "**输入与编辑**",
    "",
    "| 按键 | 操作说明 |",
    "|------|----------|",
    "| ↵ | 发送输入提示词 |",
    "| ⇧+↵/Alt+↵ | 换行插入新行 |",
    "| Ctrl+W/Alt+⌫ | 向后删除一个单词 |",
    "| Ctrl+U | 删除至当前行行首 |",
    "| Ctrl+K | 删除至当前行行尾 |",
    "| Alt+⇧+L | 复制当前所在行 |",
    "| Alt+⇧+C | 复制整个提示词内容 |",
    "",
    "**其他与系统控制**",
    "",
    "| 按键 | 操作说明 |",
    "|------|----------|",
    "| ⇥ | 路径补全 / 采纳自动补全建议 |",
    "| ⎋ | 取消自动补全 / 中断当前操作 |",
    "| Ctrl+C | 清空输入框 (初次) / 退出应用 (再次按下) |",
    "| Ctrl+D | 向后删除字符 (有草稿) / 退出应用 (输入框为空) |",
    "| Ctrl+Z | 挂起应用至后台 (挂起) |",
    "| Alt+L | 重置终端显示布局 |",
    "| ⇧+← | 循环切换思考推理深度 |",
    "| Ctrl+P | 循环切换模型角色 (slow / default / smol) |",
    "| Ctrl+⇧+P | 反向循环切换模型角色 |",
    "| Alt+P | 临时选择当前会话的模型 |",
    "| Alt+M | 选择模型 (并更新角色分配) |",
    "| Alt+⇧+P | 切换规划模式 (/plan) |",
    "| Ctrl+R | 搜索提示词历史记录 |",
    "| Ctrl+⇧+O | 展开 / 折叠工具调用输出 |",
    "| Ctrl+⇧+H | 显示 / 隐藏工具执行活动 |",
    "| Ctrl+K | 隐藏 / 显示等待确认的选项问题 |",
    "| Ctrl+Y | 批准正在等待的工具调用 |",
    "| Ctrl+⇧+T | 展开 / 折叠思考推理过程 |",
    "| Ctrl+G | 在外部文本编辑器中编辑消息 |",
    "| Ctrl+↵ | 重试上一轮执行失败的回答 |",
    "| Ctrl+V / Alt+V | 从剪贴板粘贴图片或文本 |",
    "| Ctrl+Alt+L | 开启 / 关闭实时语音对话 (/live) |",
    "| Ctrl+H | 打开智能体中枢 (/agents) |",
    "| `#<序号>` | 引用 GitHub Issue 或 PR (例如 `#123`) |",
    "| `#` / `#[操作]` | 提示词快捷操作菜单 (复制 / 撤销 / 移动光标) |",
    "| `/` | 斜杠命令自动补全菜单 |",
    "| `!` | 在终端中执行 Shell 命令 |",
    "| `!!` | 执行 Shell 命令 (结果不计入上下文) |",
    "| `$` | 在共享内核中执行 Python 代码 |",
    "| `$$` | 执行 Python 代码 (结果不计入上下文) |",
  ].join("\n");
}

export function translateActionText(text: string): string {
  if (HOTKEY_ACTIONS[text]) {
    return HOTKEY_ACTIONS[text];
  }
  for (const [en, zh] of Object.entries(HOTKEY_ACTIONS)) {
    if (text.includes(en)) {
      return text.replace(en, zh);
    }
  }
  return text;
}

export function translateHotkeysTree(node: unknown): void {
  if (!node || typeof node !== "object") return;

  const obj = node as Record<string, unknown>;

  // Translate props (sections, tables, columns, rows)
  const props = obj.props as Record<string, unknown> | undefined;
  if (props) {
    if (typeof props.head === "string") {
      if (SECTION_TITLES[props.head]) {
        props.head = SECTION_TITLES[props.head];
      } else if (props.head === "Keyboard shortcuts") {
        props.head = "键盘快捷键速查指南";
      }
    }

    if (Array.isArray(props.cols)) {
      for (const col of props.cols as Array<Record<string, unknown>>) {
        if (col.head === "Key") col.head = "按键";
        if (col.head === "Action") col.head = "操作说明";
      }
    }

    if (Array.isArray(props.rows)) {
      for (const row of props.rows as Array<{ cells?: { action?: Array<{ text?: string }> } }>) {
        if (row.cells && Array.isArray(row.cells.action)) {
          for (const token of row.cells.action) {
            if (typeof token.text === "string") {
              token.text = translateActionText(token.text);
            }
          }
        }
      }
    }
  }

  // Translate labels & texts (e.g. Close button)
  if (typeof obj.label === "string" && obj.label === "Close") {
    obj.label = "关闭 (Esc)";
  }
  if (typeof obj.text === "string") {
    obj.text = translateActionText(obj.text);
  }

  // Recurse into children
  if (Array.isArray(obj.children)) {
    for (const child of obj.children) {
      translateHotkeysTree(child);
    }
  }
}

export function hookHotkeysUi(pi: ExtensionAPI): void {
  const host = pi as Record<string, unknown>;
  const piPkg = host.pi as Record<string, unknown> | undefined;
  if (!piPkg) return;

  const IM = piPkg.InteractiveMode as { prototype?: Record<string, unknown> } | undefined;
  if (!IM || !IM.prototype) return;

  const origHandleHotkeys = IM.prototype.handleHotkeysCommand as Function | undefined;
  if (typeof origHandleHotkeys !== "function") return;

  // Avoid double-hooking
  if ((IM.prototype as Record<string, unknown>).__i18n_hotkeys_hooked) return;
  (IM.prototype as Record<string, unknown>).__i18n_hotkeys_hooked = true;

  IM.prototype.handleHotkeysCommand = function (...args: unknown[]) {
    const curLocale = injector.getCurrentLocale();
    if (curLocale === "zh-CN") {
      try {
        const getMarkdownTheme = piPkg.getMarkdownTheme as (() => unknown) | undefined;
        const Markdown = piPkg.Markdown as {
          new (text: string, x: number, y: number, theme?: unknown): unknown;
        };

        if (typeof Markdown === "function") {
          const theme = typeof getMarkdownTheme === "function" ? getMarkdownTheme() : undefined;
          const mdText = buildChineseHotkeysMarkdown();
          const mdComponent = new Markdown(mdText, 0, 0, theme);

          const selfAny = this as {
            showCommandReport?: (report: { title: string; body: unknown }) => void;
          };

          if (typeof selfAny.showCommandReport === "function") {
            selfAny.showCommandReport({
              title: "键盘快捷键速查表",
              body: mdComponent,
            });
            return;
          }
        }
      } catch {
        // Fallback to original implementation if any error
      }
    }

    return origHandleHotkeys.apply(this, args);
  };
}
