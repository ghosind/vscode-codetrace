/**
 * HTML template utility for sidebar webview panels.
 * Generates theme-adaptive HTML using VS Code CSS variables.
 */
import { formatRelativeTime } from './time-utils';
import { CommitLogEntry } from '../core/git-engine';

/**
 * Generate full HTML document for sidebar panels.
 * @param title - Panel title
 * @param bodyContent - Inner HTML body content
 * @returns Full HTML document string
 */
export function wrapHtml(title: string, bodyContent: string): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      padding: 8px 0;
    }
    .empty-state {
      padding: 16px; text-align: center;
      color: var(--vscode-descriptionForeground); font-size: 0.9em;
    }
    .history-item {
      padding: 8px 12px; cursor: pointer;
      border-bottom: 1px solid var(--vscode-sideBar-border, transparent);
    }
    .history-item:hover { background: var(--vscode-list-hoverBackground); }
    .history-item .header {
      display: flex; justify-content: space-between;
      align-items: baseline; margin-bottom: 4px;
    }
    .history-item .author { font-weight: 600; font-size: 0.95em; }
    .history-item .time {
      color: var(--vscode-descriptionForeground); font-size: 0.8em;
    }
    .history-item .summary {
      font-size: 0.85em; color: var(--vscode-descriptionForeground);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .history-item .hash {
      font-family: var(--vscode-editor-font-family);
      font-size: 0.75em; color: var(--vscode-textLink-foreground); margin-top: 2px;
    }
    .scroll-container { }
  </style>
</head>
<body>${bodyContent}</body>
</html>`;
}

/**
 * Render a single history item as HTML.
 * @param entry - Commit log entry
 * @returns HTML string
 */
export function renderHistoryItem(entry: CommitLogEntry): string {
	const relTime = formatRelativeTime(entry.timestamp);
	return `<div class="history-item" data-hash="${escapeHtml(entry.hash)}">
  <div class="header">
    <span class="author">${escapeHtml(entry.author)}</span>
    <span class="time">${escapeHtml(relTime)}</span>
  </div>
  <div class="summary">${escapeHtml(entry.summary)}</div>
  <div class="hash">${entry.hash.substring(0, 8)}</div>
</div>`;
}

/** Escape HTML special characters. */
export function escapeHtml(text: string): string {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;')
		.replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
