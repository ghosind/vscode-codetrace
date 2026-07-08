# CodeTrace

> Lightweight, zero-network local Git code trace extension for VS Code.

[![Test](https://github.com/ghosind/vscode-codetrace/actions/workflows/test.yml/badge.svg)](https://github.com/ghosind/vscode-codetrace/actions/workflows/test.yml)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

CodeTrace is a performant, privacy-first Git blame extension that works entirely offline. It provides inline blame annotations, hover commit details, and sidebar history panels — all without sending any data externally.

## Features

- **Inline Blame** — Author, relative time, and commit summary displayed inline at the end of the current line. Automatically refreshes as you move the cursor.
- **Hover Details** — Hover over any line to see the full commit metadata: author, timestamp, commit message, and short hash.
- **Uncommitted Changes** — Lines with uncommitted modifications are clearly labeled as "Uncommitted Changes".
- **Line History Panel** — Sidebar panel tracking the full commit chain that modified the currently selected line, using `git log -L`.
- **File History Panel** — Sidebar panel showing the complete commit timeline for the currently open file.
- **Status Bar** — Displays current branch and commit hash of the selected line. Click to open the sidebar.
- **Plugin Conflict Detection** — Automatically on startup (and on-demand via command) detects GitLens, Git Graph, Git History, and Git Blame extensions, offering one-click disable of their conflicting features.
- **Multi-language** — Full English and Chinese (简体中文) support. Auto-detects VS Code display language.
- **Theme Adaptive** — All UI elements follow VS Code's native theme colors. No custom color schemes.
- **100% Local** — No network requests. No telemetry. No data collection. Your code never leaves your machine.

## Requirements

- **VS Code** ≥ 1.75.0
- **Git** ≥ 2.20.0

## Installation

### From VS Code Marketplace

1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X` / `Cmd+Shift+X`)
3. Search for **Git Code Trace**
4. Click **Install**

### From VSIX

```bash
code --install-extension codetrace-1.0.0.vsix
```

## Commands

Once installed, CodeTrace activates automatically when you open a workspace containing a `.git` directory.

| Command | ID | Description |
|---------|-----|-------------|
| `CodeTrace: Toggle Inline Blame` | `codetrace.toggleBlame` | Show/hide inline blame annotations |
| `CodeTrace: Show File History` | `codetrace.showFileHistory` | Open the file history sidebar panel |
| `CodeTrace: Show Sidebar` | `codetrace.showSidebar` | Open the CodeTrace sidebar |
| `CodeTrace: Toggle Status Bar` | `codetrace.toggleStatusBar` | Show/hide the status bar item |
| `CodeTrace: Detect Plugin Conflicts` | `codetrace.detectConflicts` | Manually trigger plugin conflict detection |

## Configuration

All settings are under `codetrace.*` in VS Code settings:

| Setting | Default | Description |
|---------|---------|-------------|
| `codetrace.enabled` | `true` | Master enable/disable switch |
| `codetrace.idleSleep.enabled` | `true` | Put Git queries to sleep after idle timeout |
| `codetrace.idleSleep.timeout` | `300` | Idle timeout in seconds |
| `codetrace.blame.fontSize` | `"0.8em"` | Font size for inline blame text |
| `codetrace.blame.opacity` | `0.55` | Opacity for inline blame text (0-1) |
| `codetrace.blame.color` | `"auto"` | Color (`"auto"` follows theme) |
| `codetrace.ignore.patterns` | `[...]` | Glob patterns to exclude from blame |
| `codetrace.ignore.useGitignore` | `true` | Also respect `.gitignore` |
| `codetrace.fileSizeLimit` | `20000` | Max file lines for inline blame (0 = unlimited) |
| `codetrace.cache.maxCommits` | `20` | Commits cached per workspace |
| `codetrace.logLevel` | `"info"` | Log level: `"debug"`, `"info"`, `"warn"`, or `"error"` |

## Contributing

Contributions are welcome! Please ensure:

1. All code passes ESLint (`npm run lint`)
2. All tests pass with coverage (`npm test`)
3. New features include unit tests
4. Functions have JSDoc comments

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
