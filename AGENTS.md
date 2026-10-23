# AGENTS.md

`omp-plugins` —— Oh My Pi (`omp`, `@oh-my-pi/pi-coding-agent`) 扩展插件集合。每个子目录是一个独立可加载的插件包，根目录不包含构建产物。

## 仓库结构

```text
.
├── i18n/            # 配置项多语言注入插件 (omp-plugin-i18n)
│   ├── package.json # 含 "omp.extensions" 入口声明
│   ├── src/         # 插件源码 (index.ts 为 ExtensionAPI 默认导出)
│   ├── scripts/     # 开发期维护脚本 (词条提取 / 覆盖率检查)
│   └── README.md    # 插件自身文档，功能变更须同步
├── jump/            # 会话消息导航插件 (omp-plugin-jump)
│   ├── src/index.ts # /jump 命令与全屏导航器装配
│   ├── src/transcript.ts # 消息条目 → 行数组 + 用户消息锚点
│   └── src/navigator.ts  # 置顶消息带 + 转录视口 + 鼠标/键盘处理
└── .tmp/            # 本地验证脚本与临时目录 (gitignore)，勿提交
```

新增插件时按 `i18n/` 同样形态建目录：`package.json`（`omp.extensions` 指向 `./src/index.ts`）、`tsconfig.json`、`README.md`、`src/`。

## 运行环境

- TypeScript + ESM，源码直接运行，**无编译步骤**；依赖 omp 运行时（Bun）加载。
- `@oh-my-pi/pi-coding-agent`、`@oh-my-pi/pi-tui` 由宿主解析，仅作为 devDependencies 用于类型检查；扩展内可直接 `import`，无需打包。
- 交互式 UI 只能通过 `ctx.ui` 暴露的能力实现：`custom({ overlay: true, overlayOptions: { fullscreen: true } })` 打开备用屏全屏视图，`setWidget` 只能贴在输入框上方/下方，`setHeader` 在交互模式下是空实现。
- 主对话正文写入终端原生 scrollback，无法被程序回滚或在其上叠加常驻可点击层；需要“跳转”一类体验时，采用全屏视图内的转录副本（见 `jump/`）。

## i18n 插件要点

- 入口 `i18n/src/index.ts` 导出 `activate(pi: ExtensionAPI)`：读取语言配置 → 注入 settings/tab/group/option → 挂载 `/hotkeys` UI → 注册 `/lang` → 在 `session_start` 中注入命令补全与工作提示。
- `injector.ts` 负责快照备份与幂等注入，切回 `en` 必须完整还原官方英文基线，不得残留中文。
- 语言包位于 `src/locales/{en,zh-CN}/*.json`；`en/` 为提取脚本生成的基线，禁止手改，只改 `zh-CN/`。
- 宿主升级后同步词条：

```bash
cd i18n && bun run extract   # 重新提取 en/ 基线与新增条目
cd i18n && bun run check     # 检查翻译覆盖率
```

## jump 插件要点

- `/jump` 打开全屏导航器（备用屏），内容为打开瞬间的会话快照，不修改会话；`esc` 关闭后焦点回到编辑器。
- `transcript.ts` 只负责“条目 → 行数组 + 用户消息锚点”，`navigator.ts` 只负责布局、滚动与输入；新增消息类型改前者的渲染分支。
- 全屏覆盖层的渲染行号即屏幕行号（0 基），鼠标命中测试直接按 `render()` 的行索引计算；一次点击会同时收到按下与释放两条 SGR 报告，必须逐条解析同一输入块。
- 内置 UI 行为参考宿主 `packages/tui/src/overlays/rewind-selector.ts`（同样的全屏 `showOverlay` 模式）；本插件自行渲染转录行，未复用 `ChatTranscriptBuilder`。

## 修改约定

- 只读分析可直接执行；修改工作区内文件遵循 Read → Edit → Verify，最小改动，不做无关重构。
- 修改宿主内部接口（`config/registry`、`InteractiveMode`、autocomplete provider 等）时先确认当前 omp 版本仍存在该接口；接口探测失败应静默跳过，不能让插件加载抛错。
- 注释只写业务约束与兼容性风险（例如某个私有字段依赖的 omp 版本），不解释代码本身。
- 功能、命令、配置项变化必须同步更新对应插件的 `README.md`。
- 严禁提交 `node_modules/`、构建产物、`.env`、本地缓存。
