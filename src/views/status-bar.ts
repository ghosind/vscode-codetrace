/**
 * Status bar component for CodeTrace.
 * Displays current branch and the commit hash of the current line.
 */
import * as vscode from 'vscode';
import { RepoManager } from '../core/repo-manager';
import { warn } from '../utils/logger';

/** Alignment priority for the status bar item (high = rightmost). */
const STATUS_BAR_PRIORITY = 100;

/** Interval (ms) for periodic branch refresh. */
const BRANCH_REFRESH_INTERVAL_MS = 30000;

/** Fallback text displayed when branch info is unavailable. */
const UNKNOWN_BRANCH_TEXT = '--';

export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;
  private repo: RepoManager | undefined;
  private updateTimer: ReturnType<typeof setTimeout> | undefined;
  private visible = true;
  private currentLineHash: string | undefined;
  private cachedBranch: string | undefined;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      STATUS_BAR_PRIORITY
    );
    this.statusBarItem.name = 'CodeTrace';
    this.statusBarItem.command = 'codetrace.showSidebar';
    this.statusBarItem.tooltip = 'CodeTrace - Click to show sidebar';
    this.statusBarItem.text = '$(git-branch) CodeTrace';
  }

  setRepo(repo: RepoManager): void {
    this.repo = repo;
    this.refreshBranch();
    this.startPeriodicUpdate();
  }

  setCurrentLineHash(hash: string | undefined): void {
    this.currentLineHash = hash;
    this.updateDisplay();
  }

  show(): void {
    this.visible = true;
    this.statusBarItem.show();
  }

  hide(): void {
    this.visible = false;
    this.statusBarItem.hide();
  }

  toggle(): void {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  async refresh(): Promise<void> {
    if (!this.repo || !this.visible) {
      return;
    }
    await this.refreshBranch();
  }

  private async refreshBranch(): Promise<void> {
    if (!this.repo) {
      return;
    }
    try {
      const editor = vscode.window.activeTextEditor;
      const fp = editor?.document.uri.fsPath || '';
      this.cachedBranch = await this.repo.getCurrentBranch(fp) || undefined;
    } catch (e) { warn('refreshBranch failed', String(e)); }
    this.updateDisplay();
  }

  private updateDisplay(): void {
    let text = '$(git-branch) ';
    text += this.cachedBranch || UNKNOWN_BRANCH_TEXT;
    if (this.currentLineHash) {
      text += ` $(git-commit) ${this.currentLineHash.substring(0, 8)}`;
    }
    this.statusBarItem.text = text;
  }

  private startPeriodicUpdate(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }
    this.updateTimer = setInterval(() => {
      this.refresh();
    }, BRANCH_REFRESH_INTERVAL_MS);
  }

  dispose(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }
    this.statusBarItem.dispose();
  }
}
