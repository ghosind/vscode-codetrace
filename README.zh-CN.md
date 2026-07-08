# CodeTrace

> 轻量级、纯本地、零网络请求的 VS Code Git 代码溯源插件。

[![Test](https://github.com/ghosind/vscode-codetrace/actions/workflows/test.yml/badge.svg)](https://github.com/ghosind/vscode-codetrace/actions/workflows/test.yml)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

CodeTrace 是一款高性能、隐私优先的 Git 溯源插件，完全离线运行。提供行内 Blame 注解、Hover 悬停提交详情以及侧边栏历史面板——所有功能均不向外发送任何数据。

## 功能特性

- **行内 Blame** — 当前行尾部内联显示提交人、相对时间和提交摘要，随光标移动自动刷新。
- **悬停详情** — 悬停任意行查看完整提交元数据：作者、时间戳、提交信息和简短哈希。
- **未提交变更标识** — 存在未提交修改的行会清晰标注为"未提交的更改"。
- **行级历史面板** — 侧边栏面板追踪当前选中行的完整提交链路，基于 `git log -L` 实现。
- **文件历史面板** — 侧边栏面板展示当前打开文件的完整提交时间线。
- **状态栏组件** — 显示当前分支和选中行的提交哈希，点击即可唤起侧边栏。
- **插件冲突检测** — 启动时自动（并支持命令手动触发）检测 GitLens、Git Graph、Git History、Git Blame 等冲突插件，提供一键禁用冲突功能的入口。
- **多语言支持** — 完整英语和简体中文支持，首次启动自动跟随 VS Code 显示语言。
- **主题自适应** — 所有 UI 组件复用 VS Code 原生主题色，无自定义配色。
- **100% 本地运行** — 无网络请求、无遥测、无数据采集。您的代码永远不会离开您的设备。

## 环境要求

- **VS Code** ≥ 1.75.0
- **Git** ≥ 2.20.0

## 安装

### 从 VS Code 插件市场安装

1. 打开 VS Code
2. 进入扩展面板（`Ctrl+Shift+X` / `Cmd+Shift+X`）
3. 搜索 **Git Code Trace**
4. 点击 **安装**

### 从 VSIX 安装

```bash
# 从 GitHub Releases 下载 .vsix 文件
code --install-extension codetrace-1.0.0.vsix
```

## 命令

安装后，只要打开包含 `.git` 目录的工作区，CodeTrace 就会自动激活。

| 命令 | ID | 说明 |
|------|-----|------|
| `CodeTrace: 切换行内溯源` | `codetrace.toggleBlame` | 显示/隐藏行内 Blame 注解 |
| `CodeTrace: 查看文件历史` | `codetrace.showFileHistory` | 打开文件历史侧边栏面板 |
| `CodeTrace: 显示侧边栏` | `codetrace.showSidebar` | 打开 CodeTrace 侧边栏 |
| `CodeTrace: 显示/隐藏状态栏` | `codetrace.toggleStatusBar` | 显示/隐藏状态栏组件 |
| `CodeTrace: 检测插件冲突` | `codetrace.detectConflicts` | 手动触发插件冲突检测 |

## 配置项

所有设置位于 VS Code 设置的 `codetrace.*` 下：

| 设置项 | 默认值 | 说明 |
|--------|--------|------|
| `codetrace.enabled` | `true` | 全局启用/禁用开关 |
| `codetrace.idleSleep.enabled` | `true` | 闲置超时后暂停 Git 查询 |
| `codetrace.idleSleep.timeout` | `300` | 闲置超时秒数 |
| `codetrace.blame.fontSize` | `"0.8em"` | 行内 Blame 文字字号 |
| `codetrace.blame.opacity` | `0.55` | 行内 Blame 文字透明度 (0-1) |
| `codetrace.blame.color` | `"auto"` | 文字颜色（`"auto"` 跟随主题） |
| `codetrace.ignore.patterns` | `[...]` | 排除文件/文件夹的 Glob 模式 |
| `codetrace.ignore.useGitignore` | `true` | 同时遵循 `.gitignore` 规则 |
| `codetrace.fileSizeLimit` | `20000` | 行内 Blame 最大文件行数（0 = 不限制） |
| `codetrace.cache.maxCommits` | `20` | 每工作区最大缓存提交数 |
| `codetrace.logLevel` | `"info"` | 日志级别：`"debug"`、`"info"`、`"warn"` 或 `"error"` |

## 贡献指南

欢迎贡献！请确保：

1. 所有代码通过 ESLint 检查（`npm run lint`）
2. 所有测试通过并满足覆盖率要求（`npm test`）
3. 新功能包含单元测试
4. 函数包含 JSDoc 注释
5. 单文件 ≤ 200 行，函数圈复杂度 ≤ 10

## 许可证

本项目使用MIT协议发布，详见 [LICENSE](LICENSE) 文件。
