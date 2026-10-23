# omp-plugins

Oh My Pi（`omp`，`@oh-my-pi/pi-coding-agent`）扩展插件集合，每个子目录是一个可独立加载的插件。

## 插件列表

| 插件 | 说明 | 文档 |
|---|---|---|
| [`i18n`](./i18n) | 配置项多语言注入：settings / tabs / groups / 枚举 / 斜杠命令 / `/hotkeys` / agents / tools，支持 `zh-CN` 与 `en` 运行时热切换（`/lang`） | [README](./i18n/README.md) |
| [`jump`](./jump) | 会话消息导航：全屏置顶用户消息索引 + 转录副本，点击消息跳转到对应位置（`/jump`） | [README](./jump/README.md) |

## 安装

```bash
# 方式一：链接到 omp 插件目录
omp plugin link ./i18n
omp plugin link ./jump

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
