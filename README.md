# omp-plugins

Oh My Pi（`omp`，`@oh-my-pi/pi-coding-agent`）扩展插件集合，每个子目录是一个可独立加载的插件。

## 插件列表

| 插件 | 说明 | 文档 |
|---|---|---|
| [`i18n`](./i18n) | 多语言注入：settings / tabs / groups / 枚举 / 斜杠命令 / `/hotkeys` / agents / tools，以及设置面板、审批弹窗、工具卡片等运行时界面文案；支持 `zh-CN` 与 `en` 热切换（`/lang`） | [README](./i18n/README.md) |
| [`quota`](./quota) | 订阅额度状态栏：读取宿主 usage 缓存，常驻显示 Codex / Antigravity 等 provider 的 5h / 7d 用量与重置倒计时，`/quota` 查看明细、`/quota refresh` 手动刷新 | [README](./quota/README.md) |

## 安装

```bash
# 方式一：链接到 omp 插件目录
omp plugin link ./i18n

# 方式二：单次挂载
omp --extension ./i18n/src/index.ts
```

或在 `~/.omp/agent/config.yml` 中声明：

```yaml
extensions:
  - D:/Codes/other/omp-plugins/i18n
```

## 开发

- TypeScript + ESM，无编译步骤，由 omp 运行时（Bun）直接加载。
- 每个插件以 `package.json` 的 `omp.extensions` 声明入口，默认导出 `activate(pi: ExtensionAPI)`。
- 约定与目录结构见 [AGENTS.md](./AGENTS.md)。

## License

MIT
