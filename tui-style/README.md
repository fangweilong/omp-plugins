# omp-plugin-tui-style

自定义 omp TUI 中**用户消息气泡**的视觉样式，解决深色主题下气泡近似黑框、且与工具调用卡片难以区分的问题。

默认效果：用户消息渲染成 IM 风格的右侧卡片——宽度贴合内容、右对齐、带轮次标题，与左侧的工具调用卡片形成明确分区：

```text
                                            ╭─ YOU ────────╮
                                            │ hi           │
                                            ╰──────────────╯
                  ╭─ YOU ──────────────────────────────────╮
                  │ 检查一下这个函数的边界条件，然后给我一 │
                  │ 个最小修复。                           │
                  ╰────────────────────────────────────────╯
```

- **IM 风格右对齐**：气泡宽度按内容自适应（最短 16 列、最宽约 70% 终端宽度），右侧贴边，左侧留白；工具调用卡片保持左侧，滚动时一眼区分"我说的话"和"工具输出"。
- **完整卡片边框**：复用气泡自带的上下空白 padding 行绘制顶/底横线，内容行加左右竖线，**不增加行高**；边框字符取自当前主题的 `boxRound` symbol preset（ASCII 预设下自动退化为 `+-|`）。
- **轮次标题**：顶框内嵌 `YOU`（可配置、可关闭）。
- **气泡配色覆盖**：只作用于用户气泡自身的渲染行，不改全局 `userMessageBg` / `userMessageText` token——输入框与状态栏保持原样；前景色按背景亮度自动取黑/白。
- **`/tui-style` 命令**：查看、开关、即时调整并写入配置。

## 安装

```bash
omp plugin link ./tui-style
```

或在 `~/.omp/agent/config.yml` 中声明：

```yaml
extensions:
  - D:/Codes/other/omp-plugins/tui-style
```

单次挂载：

```bash
omp -e ./tui-style/src/index.ts
```

## 配置

首次运行后可直接用 `/tui-style` 命令修改，配置持久化到 `~/.omp/tui-style.json`：

```json
{
  "enabled": true,
  "userMessage": {
    "frame": true,
    "align": "right",
    "title": "YOU",
    "color": "accent",
    "background": "#1e2836",
    "foreground": null
  }
}
```

| 字段 | 说明 |
|---|---|
| `enabled` | 总开关；关闭时完全回退到宿主原生渲染。 |
| `userMessage.frame` | 是否绘制完整卡片边框（顶/底横线 + 左右竖线）。 |
| `userMessage.align` | `right`（默认，IM 风格右对齐、宽度贴合内容）或 `left`（占满宽度）。 |
| `userMessage.title` | 顶框内嵌标题；空字符串关闭。窄气泡放不下时退化为无标题顶框。 |
| `userMessage.color` | 边框颜色：主题色 token（`accent`、`warning`、`success`…）或 `#rrggbb`。无效 token 回退 `accent`。 |
| `userMessage.background` | 气泡背景，`#rrggbb`；`null` 沿用当前主题的 `userMessageBg`。 |
| `userMessage.foreground` | 气泡前景，`#rrggbb`；`null` 沿用当前主题并按背景亮度自动对比。 |

只接受 6 位十六进制色值；非法字段静默回退默认值，不会阻止插件加载。

### 常见调整

```bash
/tui-style align left         # 回到占满左侧宽度的卡片
/tui-style title 你           # 中文标题
/tui-style title off          # 顶框留空
/tui-style frame off          # 去掉边框，只保留右侧色块
/tui-style color warning      # 边框换琥珀色
/tui-style bg #2a3242         # 更亮的蓝灰底
/tui-style bg off             # 恢复主题底色
```

浅色主题可试 `bg #e8e8e8` + `fg #202020`。

## 命令

```text
/tui-style                          查看当前状态
/tui-style on | off                 启用 / 关闭
/tui-style frame on | off           开启 / 关闭卡片边框
/tui-style align left | right       左对齐 / IM 风格右对齐
/tui-style title <label|off>        设置顶框标题
/tui-style color <token|#hex>       设置边框颜色
/tui-style bg <#hex|off>            设置气泡背景
/tui-style fg <#hex|off>            设置气泡前景
/tui-style reload                   重新读取配置文件
```

修改对**之后渲染**的消息立即生效；已在终端 scrollback 中固化的历史行不会被重绘。

## 实现与限制

- 通过宿主内置的 `@oh-my-pi/pi-tui` 组件打补丁：
  - `UserMessageComponent.prototype.render`：先用最大允许宽度探测一次内容自然宽度，再按该宽度重排并整体右缩进；首/末空白 padding 行替换为顶/底横线，其余行加左右竖线；OSC 133 prompt-zone 标记保持在原位置。
  - 配色只替换**该组件渲染行内**的背景/前景 SGR，不修改全局 `userMessageBg` / `userMessageText` token——输入框（composer）与状态栏同样引用这两个 token，全局覆盖会连带改变输入框外观。
- 边框字符来自 `theme.boxRound`，随 symbol preset / 主题变化，无需硬编码。
- 内容宽度探测按组件实例缓存，滚动重绘不会重复测量。
- 首行被 reaction / live-steer 徽标占用时不绘制顶框（保留左右竖线），避免覆盖徽标。
- 终端宽度小于 24 列时退化为左对齐，避免气泡被压扁。
- 只影响 ANSI 渲染路径。Tern Surface Protocol 原生终端（`describe()` 卡片）使用宿主自己的卡片边框，本插件不改动其结构。
- 依赖 omp 18.12.x 的宿主内部导出；宿主升级若重命名这些成员，对应补丁会被跳过而不会导致插件加载失败。
- 只依赖 `@oh-my-pi/pi-tui` 与 `@oh-my-pi/pi-coding-agent`，不引用宿主未暴露的 `pi-utils`。

## License

MIT
