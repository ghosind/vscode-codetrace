/**
 * Inline Blame decoration provider for CodeTrace.
 * Renders blame annotation at the end of the current cursor line only.
 * Auto-refreshes on cursor position change, editor switch, and document save.
 */
import * as vscode from 'vscode';
import * as fs from 'fs';
import { BlameProvider } from '../core/blame-provider';
import { RepoManager } from '../core/repo-manager';
import { getConfig } from '../utils/config';
import { formatRelativeTime } from '../utils/time-utils';
import { t } from '../utils/i18n';
import { debug } from '../utils/logger';

/** Prefix used by git for uncommitted (working-tree) hashes. */
const UNCOMMITTED_HASH_PREFIX = '0000000';

/** Author name placeholder used by git for uncommitted changes. */
const UNCOMMITTED_AUTHOR_MARKER = 'Not Committed Yet';

/** Fallback color used when the blame style is set to 'auto' (dark theme). */
const AUTO_DARK_COLOR = '#999999';

/** Fallback color used when the blame style is set to 'auto' (light theme). */
const AUTO_LIGHT_COLOR = '#888888';

/** The 'auto' color mode keyword. */
const AUTO_BLAME_COLOR = 'auto';

/** Bullet separator used in blame labels. */
const BLAME_LABEL_SEPARATOR = ' \u2022 ';

/** Debounce delay (ms) before fetching blame after cursor moves. */
const BLAME_UPDATE_DEBOUNCE_MS = 100;

export class InlineBlameManager {
  private provider: BlameProvider;
  private repo: RepoManager;
  private decorationType: vscode.TextEditorDecorationType | undefined;
  private enabled = true;
  private disposables: vscode.Disposable[] = [];
  private updateTimer: ReturnType<typeof setTimeout> | undefined;
  private previousEditor: vscode.TextEditor | undefined;
  private lastDecoratedLine = -1;
  private cachedUserName: string | undefined;
  onBlameUpdate: ((hash: string | undefined) => void) | undefined;

  constructor(provider: BlameProvider, repo: RepoManager) {
    this.provider = provider;
    this.repo = repo;
  }

  /** Initialize listeners and decoration type. */
  initialize(): void {
    this.updateDecorationType();

    // Editor switch: clear previous, decorate new cursor line
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) {
          this.onEditorChanged(editor);
        }
      })
    );

    // Cursor move: refresh blame for the new line
    this.disposables.push(
      vscode.window.onDidChangeTextEditorSelection((e) => {
        if (e.textEditor === vscode.window.activeTextEditor) {
          this.provider.reportActivity();
          this.scheduleUpdate(e.textEditor);
        }
      })
    );

    // Document save: invalidate stale cache and force re-fetch blame
    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument((doc) => {
        this.provider.invalidateFile(doc.uri.fsPath);
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          this.lastDecoratedLine = -1;
          this.scheduleUpdate(editor);
        }
      })
    );

    // Config change: re-apply
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('codetrace')) {
          this.enabled = getConfig().enabled;
          this.updateDecorationType();
          const editor = vscode.window.activeTextEditor;
          if (editor) {
            this.scheduleUpdate(editor);
          }
        }
      })
    );

    const editor = vscode.window.activeTextEditor;
    if (editor) {
      this.scheduleUpdate(editor);
    }
  }

  private onEditorChanged(editor: vscode.TextEditor): void {
    if (this.previousEditor) {
      this.previousEditor.setDecorations(this.getDecorationType(), []);
    }
    this.previousEditor = editor;
    this.lastDecoratedLine = -1;
    this.provider.reportActivity();
    this.scheduleUpdate(editor);
  }

  private scheduleUpdate(editor: vscode.TextEditor): void {
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
    }
    debug(`schedule blame update for line ${editor.selection.active.line}`);
    this.updateTimer = setTimeout(
      () => this.updateCursorBlame(editor),
      BLAME_UPDATE_DEBOUNCE_MS
    );
  }

  /**
     * Fetch blame for the current cursor line and decorate it.
     */
  private async updateCursorBlame(editor: vscode.TextEditor): Promise<void> {
    if (!this.enabled) {
      editor.setDecorations(this.getDecorationType(), []);
      return;
    }
    const cursorLine = this.checkCursorLine(editor);
    if (cursorLine < 0) {
      return;
    }

    const blame = await this.provider.getBlameForLine(editor.document, cursorLine);
    this.onBlameUpdate?.(blame?.hash.startsWith(UNCOMMITTED_HASH_PREFIX) ? undefined : blame?.hash);

    if (this.shouldClearBlame(blame, editor.document)) {
      editor.setDecorations(this.getDecorationType(), []);
      return;
    }

    const label = await this.buildBlameLabel(blame!.hash, blame!, editor.document);
    this.applyBlameDecoration(editor, cursorLine, label);
  }

  /** Returns cursor line number, or -1 if update should be skipped. */
  private checkCursorLine(editor: vscode.TextEditor): number {
    const line = editor.selection.active.line;
    if (line === this.lastDecoratedLine) {
      return -1;
    }
    this.lastDecoratedLine = line;
    if (line < 0 || line >= editor.document.lineCount) {
      editor.setDecorations(this.getDecorationType(), []);
      return -1;
    }
    return line;
  }

  /** Apply blame decoration for the given line. */
  private applyBlameDecoration(editor: vscode.TextEditor, cursorLine: number, label: string): void {
    if (!label) {
      editor.setDecorations(this.getDecorationType(), []);
      return;
    }
    const lineText = editor.document.lineAt(cursorLine).text;
    editor.setDecorations(this.getDecorationType(), [{
      range: new vscode.Range(cursorLine, lineText.length, cursorLine, lineText.length),
      renderOptions: {
        after: {
          contentText: `  ${label}`,
          color: this.getBlameColor(),
          fontStyle: 'italic',
        },
      },
    }]);
  }

  /**
     * Build a safe blame label. Guards against undefined/null/NaN values
     * in author, timestamp, and summary fields.
     */
  private async buildBlameLabel(hash: string, blame: {
    author?: string;
    timestamp?: string;
    summary?: string;
  }, document: vscode.TextDocument): Promise<string> {
    if (this.isUncommitted(hash, blame.author)) {
      return this.buildUncommittedLabel(document);
    }

    const author = blame.author || '';
    const summary = blame.summary || '';
    const timeStr = this.safeFormatTime(blame.timestamp);
    if (!author && !timeStr && !summary) {
      return '';
    }

    const parts: string[] = [];
    if (author) {
      parts.push(author);
    }
    if (timeStr) {
      parts.push(timeStr);
    }
    if (summary) {
      parts.push(summary);
    }
    return parts.join(BLAME_LABEL_SEPARATOR);
  }

  /** Build a label for uncommitted (saved) changes: user name + save time. */
  private async buildUncommittedLabel(document: vscode.TextDocument): Promise<string> {
    const userName = this.cachedUserName ||
      (this.cachedUserName = await this.repo.getUserName(document.fileName));
    let saveTime = '';
    try {
      saveTime = formatRelativeTime(fs.statSync(document.fileName).mtime.toISOString());
    } catch (e) {
      debug('stat mtime failed', String(e));
    }
    const parts = [userName];
    if (saveTime) {
      parts.push(saveTime);
    }
    parts.push(t('codetrace.blame.uncommitted'));
    return parts.join(BLAME_LABEL_SEPARATOR);
  }

  /** Returns true if blame should be cleared (null/undefined result, or uncommitted+unsaved). */
  private shouldClearBlame(
    blame: { hash?: string } | undefined,
    doc: vscode.TextDocument
  ): boolean {
    if (!blame) {
      return true;
    }
    return !!(blame.hash?.startsWith(UNCOMMITTED_HASH_PREFIX) && doc.isDirty);
  }

  /** Check if a blame line represents uncommitted working-tree changes. */
  private isUncommitted(hash: string, author?: string): boolean {
    return hash.startsWith(UNCOMMITTED_HASH_PREFIX) || author === UNCOMMITTED_AUTHOR_MARKER;
  }

  /** Safely format a timestamp to relative time, returning '' on invalid input. */
  private safeFormatTime(timestamp?: string): string {
    if (!timestamp) {
      return '';
    }
    const ms = new Date(timestamp).getTime();
    return isNaN(ms) ? '' : formatRelativeTime(timestamp);
  }

  private getDecorationType(): vscode.TextEditorDecorationType {
    if (!this.decorationType) {
      this.updateDecorationType();
    }
    return this.decorationType!;
  }

  private updateDecorationType(): void {
    if (this.decorationType) {
      this.decorationType.dispose();
    }
    this.decorationType = vscode.window.createTextEditorDecorationType({
      after: { margin: '0 0 0 3em' },
    });
  }

  /** Get blame text color, applying configured opacity via rgba. */
  private getBlameColor(): string {
    const config = getConfig();
    let baseColor = config.blame.color;
    if (baseColor === AUTO_BLAME_COLOR) {
      const isDark = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark;
      baseColor = isDark ? AUTO_DARK_COLOR : AUTO_LIGHT_COLOR;
    }
    if (config.blame.opacity < 1 && baseColor.startsWith('#')) {
      return this.hexToRgba(baseColor, config.blame.opacity);
    }
    return baseColor;
  }

  private hexToRgba(hex: string, alpha: number): string {
    const c = hex.replace('#', '');
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  toggle(): void {
    this.enabled = !this.enabled;
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      if (!this.enabled) {
        editor.setDecorations(this.getDecorationType(), []);
      } else {
        this.lastDecoratedLine = -1;
        this.scheduleUpdate(editor);
      }
    }
  }

  dispose(): void {
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
    }
    if (this.decorationType) {
      this.decorationType.dispose();
    }
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
