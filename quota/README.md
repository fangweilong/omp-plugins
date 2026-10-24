# omp-plugin-quota

把已登录订阅（Codex、Google Antigravity 等）的额度常驻到 omp 状态栏，当前模型所属订阅优先，并跟随宿主缓存自动刷新。

```text
 π · ⟳ deepseek-v4.1-flash · 📁 D:\proj · ⑂ main · ◫ 12%/1M ⟲
      OpenCode Go  5h [░░░░░░░░]   0% ↻ 4h42m · 7d [█▉░░░░░░]  23% ↻ 2d · mo [▉░░░░░░░]  11% ↻ 29d  │ Google Antigravity G 7d 100% ↻ 1d
```

- **当前模型所属订阅固定排第一**（粗体青色，显示 `maxWindowsPerProvider` 个窗口）。模型 provider 取自会话历史里最近一次 `model_change`：宿主启动瞬间的 `ctx.model` 可能仍是默认模型，直接读它会把默认 provider 当成当前订阅。切换模型后在下一个 30 秒刷新周期换位。
- 其余订阅压缩为「渠道名 + 最紧窗口 + 已用% + 重置」，不带消耗条与抓取时间；按压力降序补齐，最多 `maxProviders` 个。
- 每个窗口是「窗口 + 8 格消耗条 + 已用% + 重置倒计时」。条越满表示用得越多；空条是剩余空间。
- 缓存新鲜时**不显示**抓取时间；只有超过 `staleAfterMinutes` 才出现黄色 `~5m`，表示这行来自宿主的 last-good 快照。
- 颜色按已用比例：<70% 绿、70–89% 黄、≥90% 红；窗口标签与倒计时为暗色。
- 同一 provider 多账号时取最紧的额度；窗口固定按 5h → 7d → 月 排序，不会因刷新跳列。
- 默认只显示百分比额度（5h / 1d / 7d / 月），纯 credits 余额需开启 `showCredits`。

## 安装

```bash
omp plugin link ./quota
# 或单次挂载
omp --extension ./quota/src/index.ts
```

也可在 `~/.omp/agent/config.yml` 中加入：

```yaml
extensions:
  - D:/Codes/other/omp-plugins/quota
```

## 数据来源与刷新

插件不直接请求 provider 接口，也不常驻子进程：

1. omp 内置状态栏每 5 分钟调用 `AuthStorage.usage.reports()`，结果写入 `~/.omp/agent/agent.db` 的 `usage_cache:report:*`。
2. 插件每 `refreshSeconds` 秒只读该缓存，格式化后通过 `ctx.ui.setStatus("quota", …)` 输出。
3. 每次 `setStatus` 会触发状态栏重绘，从而让宿主的 5 分钟额度刷新在终端空闲时也继续运行。

因此展示的额度与 `omp usage` / `/usage` 同源，不会产生额外的上游请求。上游抓取失败时宿主会回退到 24h 内的 last-good 快照，插件用 `~` 标注其年龄。

## 配置

可选文件：`~/.omp/agent/statusline-quota.json`（不存在则用默认值）。

```json
{
  "providers": "auto",
  "refreshSeconds": 30,
  "staleAfterMinutes": 15,
  "showResets": true,
  "showCredits": false,
  "gauge": true,
  "providerName": "full",
  "refreshTime": "relative",
  "indent": 6,
  "maxProviders": 3,
  "maxWindowsPerProvider": 3,
  "color": true
}
```

| 字段 | 默认 | 说明 |
|---|---|---|
| `providers` | `"auto"` | `"auto"` 显示所有具备百分比额度的 provider；或填写 id 数组，如 `["google-antigravity", "openai-codex"]` |
| `refreshSeconds` | `30` | 读取缓存的间隔（秒），5–3600 |
| `staleAfterMinutes` | `15` | 快照超过该时长时追加黄色 `~5m` 标记；新鲜数据不显示时间 |
| `showResets` | `true` | 显示 `↻` 重置倒计时 |
| `showCredits` | `false` | 显示 credits/USD 余额（如 Command Code） |
| `gauge` | `true` | 显示 8 格消耗条；不兼容块字符的终端可设为 `false` |
| `providerName` | `"full"` | `"full"` 显示 `OpenCode Go`；`"short"` 显示 `OG`（压缩位较窄时更省宽） |
| `refreshTime` | `"relative"` | 陈旧标记的格式：`"relative"` → `~5m`；`"clock"` → `~18:03`；`"off"` 关闭 |
| `indent` | `6` | 行首缩进列数，默认与状态栏 `π · ⟳ <模型名>` 的模型名对齐；0–16 |
| `maxProviders` | `3` | 最多显示几个 provider；当前模型的订阅始终第一，其余按压力排序 |
| `maxWindowsPerProvider` | `3` | 第一个（当前模型所属）provider 最多显示几个窗口 |
| `color` | `true` | 按已用比例着色（≥70% 黄，≥90% 红） |

## 命令

| 命令 | 行为 |
|---|---|
| `/quota` | 逐账号列出缓存中的额度、进度与重置时间 |
| `/quota refresh` | 运行 `omp usage --json` 刷新（5 分钟内可能直接复用宿主缓存） |
| `/quota refresh force` | 先 `omp usage invalidate` 再抓取；上游失败会清空 last-good，界面暂留旧值 |

## OpenCode Go / Zen

- `opencode-go` 有内置 usage provider：读取 `GET https://opencode.ai/zen/go/v1/usage`，返回 5h / 7d / 月三个百分比窗口，本插件会自动识别并显示为 `OpenCode Go`（`providerName: "short"` 时为 `OG`）。
- **凭据必须对 usage 子系统可见**：通过 `/login opencode-go` 保存 API key，或设置环境变量 `OPENCODE_API_KEY`。
- 只写在 `~/.omp/agent/models.yml` 的 `providers.opencode-go.apiKey` 仅用于推理；`AuthStorage` 的 usage 采集不会读取该配置键，因此 `omp usage` 不会返回报告，本插件也不会显示。
- `opencode-zen`（Zen 非 Go）目前没有内置 usage provider，只有 token 用量统计，不参与额度显示。

## 与内置 `usage` 段的区别

omp 自带 `usage` 段，但它只显示**当前模型所属 provider**的额度；当前模型走自定义网关时不会显示订阅额度。本插件汇总缓存中的全部订阅 provider，并把当前模型所属的订阅排在第一位；模型走的 provider 在缓存中没有对应报告（例如自定义网关）时，按最紧额度排序。

如果只需要当前 provider 的额度，可以不装插件，直接改 `~/.omp/agent/settings.json`：

```json
{
  "statusLine": {
    "preset": "custom",
    "leftSegments": ["vim", "model", "mode", "usage"],
    "rightSegments": ["session_name", "cost", "context_pct"]
  }
}
```

若希望额度与状态栏同一行，使用自定义 `status` 段并关闭独立 hook 行：

```json
{
  "statusLine": {
    "preset": "custom",
    "leftSegments": ["model", "mode", "status"],
    "rightSegments": ["context_pct"],
    "showHookStatus": false
  }
}
```

## 兼容性

- 缓存键 `usage_cache:report:<cacheVersion>:<provider>:<baseUrl>:<identity>` 是宿主内部格式；解析失败会静默跳过，不会影响会话。
- 只在 `tui` 模式、主会话中挂载；子代理与 print/RPC 模式直接返回。
- 渲染定时器只在 `session_start` / `session_switch` 启动；修改插件源码后请重启 omp，`/reload-plugins` 不保证重建状态行定时器。
- 使用 `ctx.setInterval`，异常不会击穿会话，`session_shutdown` 自动清理。
