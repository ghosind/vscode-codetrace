/**
 * Sidebar panel providers for CodeTrace.
 * Line History and File History webview views with auto-sync.
 */
import * as vscode from 'vscode';
import { RepoManager } from '../core/repo-manager';
import { BlameProvider } from '../core/blame-provider';
import { getLineHistory } from '../core/line-history';
import { t } from '../utils/i18n';
import { wrapHtml, renderHistoryItem } from '../utils/html-templates';

/** Common empty-state HTML. */
function emptyHtml(key: string): string {
  return `<div class="empty-state">${t(key)}</div>`;
}

/**
 * Line History sidebar view provider.
 * Shows the commit chain that modified the currently selected line.
 */
export class LineHistoryProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | undefined;
  private repo: RepoManager | undefined;
  private blameProvider: BlameProvider;
  private currentFile: string | undefined;
  private pendingLine: number | undefined;

  constructor(blameProvider: BlameProvider) { this.blameProvider = blameProvider; }
  setRepo(repo: RepoManager): void { this.repo = repo; }

  async setFile(filePath: string, lineNumber: number): Promise<void> {
    this.currentFile = filePath;
    this.pendingLine = lineNumber;
    if (this.view && this.repo) {
      await this.refresh(lineNumber);
    }
  }

  async refresh(lineNumber: number): Promise<void> {
    if (!this.view || !this.repo || !this.currentFile) {
      return;
    }
    this.showLoading();
    const history = await getLineHistory(this.repo, this.currentFile, lineNumber, 30);
    this.showHistory(history);
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true, localResourceRoots: [] };
    // If a file was already set before the view was ready, refresh now
    if (this.currentFile && this.pendingLine !== undefined && this.repo) {
      this.refresh(this.pendingLine);
    } else {
      this.showEmpty('codetrace.sidebar.noFile');
    }
  }

  private showEmpty(key: string): void {
    if (this.view) {
      this.view.webview.html = wrapHtml(t('codetrace.view.lineHistory'), emptyHtml(key));
    }
  }
  private showLoading(): void {
    if (this.view) {
      this.view.webview.html = wrapHtml(t('codetrace.view.lineHistory'), emptyHtml('codetrace.sidebar.loading'));
    }
  }
  private showHistory(history: import('../core/git-engine').CommitLogEntry[]): void {
    if (!this.view) {
      return;
    }
    const items = history.length > 0
      ? `<div class="scroll-container">${history.map((e) => renderHistoryItem(e)).join('')}</div>`
      : emptyHtml('codetrace.sidebar.noHistory');
    this.view.webview.html = wrapHtml(t('codetrace.view.lineHistory'), items);
  }
}

/**
 * File History sidebar view provider.
 * Shows the full commit history for the currently open file.
 */
export class FileHistoryProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | undefined;
  private repo: RepoManager | undefined;
  private pendingFilePath: string | undefined;

  setRepo(repo: RepoManager): void { this.repo = repo; }

  async refresh(filePath: string): Promise<void> {
    if (!this.repo) {
      return;
    }
    if (!this.view) {
      // Cache the path until the view is resolved
      this.pendingFilePath = filePath;
      return;
    }
    this.pendingFilePath = undefined;
    this.view.webview.html = wrapHtml(t('codetrace.view.fileHistory'), emptyHtml('codetrace.sidebar.loading'));
    const history = await this.repo.getFileHistory(filePath, 50);
    const items = history.length > 0
      ? `<div class="scroll-container">${history.map((e) => renderHistoryItem(e)).join('')}</div>`
      : emptyHtml('codetrace.sidebar.noHistory');
    this.view.webview.html = wrapHtml(t('codetrace.view.fileHistory'), items);
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true, localResourceRoots: [] };
    if (this.pendingFilePath && this.repo) {
      this.refresh(this.pendingFilePath);
    } else {
      webviewView.webview.html = wrapHtml(t('codetrace.view.fileHistory'), emptyHtml('codetrace.sidebar.noFile'));
    }
  }
}
