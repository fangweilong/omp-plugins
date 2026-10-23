# omp-plugin-i18n

**Oh My Pi (`omp`) 配置项多语言注入扩展插件**

为 `omp` (`@oh-my-pi/pi-coding-agent`) 的全部配置项提供运行时多语言本地化注入。目前完整支持**简体中文 (`zh-CN`)** 与**英文 (`en`)**，支持运行时无缝双向热切换。

---

## 🌟 核心特性

- **无侵入运行时注入**：基于 `omp` 官方扩展体系与 `@oh-my-pi/pi-coding-agent/config/registry`，直接对内存中的 `Setting` 配置句柄进行元数据增强，不修改宿主核心代码。
- **全方位系统级本地化覆盖**：
  - **422 个配置项 (`/settings`)**：标题 (`label`) 与详细解释 (`description`)
  - **10 大顶层面板 Tab**：分类名称本地化 (`appearance` → 外观，`interaction` → 交互等)
  - **59 个功能分组 Group**：组别名称本地化 (`Theme` → 主题配色，`Compaction` → 上下文压缩等)
  - **130+ 枚举选项 (`options`)**：枚举选择项的展示标签与说明文档
  - **181 个斜杠命令说明 (`/` commands)**：自动补全栈式拦截，**仅翻译命令说明/注释，严格保持原始 `/` 命令名称不变** (如 `/model`, `/settings`, `/shake`, `/force` 等)
  - **73 个全局快捷键说明 (`/hotkeys`)**：全量快捷键说明中文本地化 (`KEYBINDINGS`)
  - **6 个内置子智能体描述 (`/agents`)**：子任务 Agent 角色与职责中文定位 (`BUNDLED_AGENTS`)
  - **18 个内置工具参考说明 (`/tools`)**：常用工具的中文功能指南 (`tools.json`)
  - **终端等待加载提示**：动态替换为中文 `思考中...` 状态指示
- **双向 100% 确定性回滚**：切换回英文时完全恢复官方原始英文字符串基线，零污染、无副作用。
- **动态热切换**：提供交互式斜杠命令 `/lang [zh-CN|en|reload]`，即改即生效并自动持久化。
- **自动化维护工具链**：内置提取脚本与校验工具，当 `omp` 版本升级新增配置项时，可一键提取基线并增量同步。

---

## 📦 安装与加载方式

### 方式一：通过插件目录链接 (推荐)

在终端运行以下命令将插件软链接至 `omp` 插件目录：

```bash
omp plugin link ./i18n
```

### 方式二：在全局配置文件中声明

在 `~/.omp/agent/config.yml` 中添加扩展路径：

```yaml
extensions:
  - D:/Codes/other/omp-plugins/i18n
```

### 方式三：单次命令行挂载启动

```bash
omp --extension ./i18n/src/index.ts
```

---

## 🚀 交互命令

在 `omp` 终端中随时可使用 `/lang` 系列斜杠命令：

| 命令 | 说明 |
|---|---|
| `/lang` 或 `/lang status` | 查看当前生效语言及本地化注入状态 |
| `/lang zh-CN` (或 `/lang zh`) | 即时切换为**简体中文**并保存配置 |
| `/lang en` (或 `/lang english`) | 即时恢复为**原始英文**并保存配置 |
| `/lang reload` | 重新读取磁盘上的 JSON 翻译文件并热应用 (适合开发调试词条) |

### 语言判定优先级

1. **用户运行时指定**：通过 `/lang` 命令选定并持久化在 `~/.omp/i18n.json` 中的设置。
2. **环境变量**：`OMP_LANG` > `LC_ALL` > `LANG`。
3. **系统区域**：自动识别操作系统区域（匹配中文区域则默认启用 `zh-CN`）。
4. **回退保底**：`en`。

---

## 🛠️ 项目结构

```text
i18n/
├── package.json              # 插件元信息与扩展入口声明
├── tsconfig.json             # TypeScript 配置
├── README.md                 # 项目文档
├── src/
│   ├── index.ts              # 扩展入口 (ExtensionAPI 工厂函数)
│   ├── types.ts              # 类型定义
│   ├── config.ts             # 语言配置读写与系统语言检测
│   ├── injector.ts           # 核心注入引擎 (快照备份、本地化注入、热重载)
│   ├── commands/
│   │   └── lang.ts           # /lang 交互命令实现
│   └── locales/
│       ├── index.ts          # 语言包动态加载器
│       ├── zh-CN/            # 简体中文语言包
│       │   ├── settings.json # 配置项翻译
│       │   ├── tabs.json     # 10 个面板 Tab 翻译
│       │   ├── groups.json   # 59 个配置分组翻译
│       │   └── ui.json       # 插件自身提示文案
│       └── en/               # 英文基线语言包 (由提取脚本自动生成)
│           ├── settings.json
│           ├── tabs.json
│           ├── groups.json
│           └── ui.json
└── scripts/
    ├── extract.ts            # 从运行中的 omp 提取全量配置与枚举模板
    └── check.ts              # 检查当前各语言包的翻译完成度
```

---

## 🔄 升级与维护指南

当 `omp` 官方版本发布升级，可能引入新的配置项或更新文案。使用项目内置脚本保持词库同步：

```bash
# 1. 从当前 omp 运行时提取最新的配置项到 en/，并自动向 zh-CN 补充缺失模板
bun run extract
# 或
omp -p "extract" --extension ./scripts/extract.ts

# 2. 检查翻译完成度与待翻译列表
bun run check
```

---

## 📄 License

MIT
