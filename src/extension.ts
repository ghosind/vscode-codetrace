/**
 * CodeTrace - Lightweight Git Code Trace Extension for VS Code
 * Main entry point for activation, deactivation, and command registration.
 */
import * as vscode from 'vscode';
import { GitEngine } from './core/git-engine';
import { BlameProvider } from './core/blame-provider';
import { CacheManager } from './cache/cache-manager';
import { InlineBlameManager } from './views/inline-blame';
import { CodeTraceHoverProvider } from './views/hover-provider';
import { LineHistoryProvider, FileHistoryProvider } from './views/sidebar-panels';
import { StatusBarManager } from './views/status-bar';
import { initializeI18n } from './utils/i18n';
import { getConfig } from './utils/config';
import { detectConflicts } from './conflict-detector';
import { initLogger, info, warn, error as logErr } from './utils/logger';

let gitEngine: GitEngine | undefined;
let cacheManager: CacheManager | undefined;
let blameProvider: BlameProvider | undefined;
let inlineBlameManager: InlineBlameManager | undefined;
let hoverProvider: CodeTraceHoverProvider | undefined;
let lineHistoryProvider: LineHistoryProvider | undefined;
let fileHistoryProvider: FileHistoryProvider | undefined;
let statusBarManager: StatusBarManager | undefined;
const allDisposables: vscode.Disposable[] = [];

/** Activation: called when workspace containing .git is opened. */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  initLogger(context);
  initializeI18n(context);
  info('CodeTrace activating...');

  if (!getConfig().enabled) {
    info('CodeTrace disabled by config, skipping activation');
    return;
  }

  const repoPath = getWorkspaceRoot();
  if (!repoPath) {
    warn('No workspace root with .git found, skipping activation');
    return;
  }
  info('Workspace root', { repoPath });

  try {
    await initSubsystems(context, repoPath);
    registerCommands(context);
    registerViews(context);
    registerListeners();
    triggerInitialRefresh();
    statusBarManager?.show();
    vscode.commands.executeCommand('setContext', 'codetrace:enabled', true);
    setTimeout(() => detectConflicts(), 3000);
    info('CodeTrace activated successfully');
  } catch (e) {
    logErr('CodeTrace activation failed', e);
  }
}

function getWorkspaceRoot(): string | undefined {
  const folders = vscode.workspace.workspaceFolders;
  return folders?.length ? folders[0].uri.fsPath : undefined;
}

async function initSubsystems(context: vscode.ExtensionContext, repoPath: string): Promise<void> {
  info('Initializing subsystems...');
  cacheManager = new CacheManager(context, getConfig().cacheMaxCommits);
  allDisposables.push(cacheManager);
  gitEngine = new GitEngine(repoPath);
  await gitEngine.initialize();
  allDisposables.push(gitEngine);
  blameProvider = new BlameProvider(cacheManager);
  blameProvider.setEngine(gitEngine);
  inlineBlameManager = new InlineBlameManager(blameProvider, gitEngine);
  inlineBlameManager.initialize();
  hoverProvider = new CodeTraceHoverProvider(blameProvider, gitEngine);
  lineHistoryProvider = new LineHistoryProvider(blameProvider);
  lineHistoryProvider.setEngine(gitEngine);
  fileHistoryProvider = new FileHistoryProvider();
  fileHistoryProvider.setEngine(gitEngine);
  statusBarManager = new StatusBarManager();
  statusBarManager.setEngine(gitEngine);
  // Wire inline blame to status bar
  inlineBlameManager.onBlameUpdate = (hash: string | undefined): void => {
    statusBarManager?.setCurrentLineHash(hash);
  };
}

function registerCommands(context: vscode.ExtensionContext): void {
  const cmds: vscode.Disposable[] = [
    vscode.commands.registerCommand('codetrace.toggleBlame', () => inlineBlameManager?.toggle()),
    vscode.commands.registerCommand('codetrace.showFileHistory', async () => {
      const e = vscode.window.activeTextEditor;
      if (e && fileHistoryProvider) {
        await fileHistoryProvider.refresh(e.document.uri.fsPath);
      }
      vscode.commands.executeCommand('workbench.view.extension.codetrace-sidebar');
    }),
    vscode.commands.registerCommand('codetrace.revertFileVersion', async (hash?: string) => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || !gitEngine || !hash) {
        return;
      }
      const content = await gitEngine.getFileAtCommit(editor.document.uri.fsPath, hash);
      if (content) {
        const r = new vscode.Range(editor.document.positionAt(0),
          editor.document.positionAt(editor.document.getText().length));
        await editor.edit((b) => b.replace(r, content));
      }
    }),
    vscode.commands.registerCommand('codetrace.showSidebar', () =>
      vscode.commands.executeCommand('workbench.view.extension.codetrace-sidebar')),
    vscode.commands.registerCommand('codetrace.hideStatusBar', () => statusBarManager?.hide()),
    vscode.commands.registerCommand('codetrace.detectConflicts', () => detectConflicts()),
    vscode.commands.registerCommand('codetrace.copyHash', (hash?: string) => {
      if (hash) {
        vscode.env.clipboard.writeText(hash);
      }
    }),
  ];
  for (const d of cmds) {
    context.subscriptions.push(d);
    allDisposables.push(d);
  }
}

function registerViews(context: vscode.ExtensionContext): void {
  if (hoverProvider) {
    const hd = vscode.languages.registerHoverProvider({ scheme: 'file' }, hoverProvider);
    context.subscriptions.push(hd);
    allDisposables.push(hd);
  }
  if (lineHistoryProvider) {
    const ld = vscode.window.registerWebviewViewProvider('codetrace.lineHistory', lineHistoryProvider);
    context.subscriptions.push(ld);
    allDisposables.push(ld);
  }
  if (fileHistoryProvider) {
    const fd = vscode.window.registerWebviewViewProvider('codetrace.fileHistory', fileHistoryProvider);
    context.subscriptions.push(fd);
    allDisposables.push(fd);
  }
}

function registerListeners(): void {
  const ed = vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (editor && fileHistoryProvider) {
      fileHistoryProvider.refresh(editor.document.uri.fsPath);
    }
  });
  const cd = vscode.window.onDidChangeTextEditorSelection((e) => {
    if (e.textEditor === vscode.window.activeTextEditor && lineHistoryProvider) {
      lineHistoryProvider.setFile(e.textEditor.document.uri.fsPath, e.selections[0].active.line);
    }
  });
    // Catch documents that become visible without an editor-change event
  const od = vscode.window.onDidChangeVisibleTextEditors((editors) => {
    if (editors.length > 0 && fileHistoryProvider) {
      fileHistoryProvider.refresh(editors[0].document.uri.fsPath);
    }
  });
  allDisposables.push(ed, cd, od);
}

/** Refresh blame + history for any editor already open at activation time. */
function triggerInitialRefresh(): void {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    if (fileHistoryProvider) {
      fileHistoryProvider.refresh(editor.document.uri.fsPath);
    }
    if (lineHistoryProvider) {
      lineHistoryProvider.setFile(editor.document.uri.fsPath, editor.selection.active.line);
    }
  }
}

/** Deactivation: cleanup all resources. */
export function deactivate(): void {
  info('CodeTrace deactivating, cleaning up...');
  for (const d of allDisposables.reverse()) {
    try {
      d.dispose();
    } catch (e) {
      warn('dispose error', String(e));
    }
  }
  vscode.commands.executeCommand('setContext', 'codetrace:enabled', false);
  [gitEngine, cacheManager, blameProvider, inlineBlameManager,
    hoverProvider, lineHistoryProvider, fileHistoryProvider, statusBarManager] =
    [undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined];
  allDisposables.length = 0;
}
