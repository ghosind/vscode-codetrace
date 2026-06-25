/**
 * Repository manager for CodeTrace.
 * Manages multiple GitEngine instances for multi-root workspaces and submodules.
 */
import * as fs from 'fs';
import * as path from 'path';
import { GitEngine, BlameResult, CommitLogEntry } from './git-engine';
import { debug } from '../utils/logger';

export class RepoManager {
  private engines = new Map<string, GitEngine>();
  private disposed = false;

  /**
   * Find the git repo root for a file path, creating an engine if needed.
   * Handles submodule `.git` files (not directories).
   */
  async getEngineFor(filePath: string): Promise<GitEngine | undefined> {
    if (this.disposed) {
      return undefined;
    }
    const root = this.findRepoRoot(filePath);
    if (!root) {
      return undefined;
    }
    return this.getOrCreateEngine(root);
  }

  /** Get an existing engine for a repo root (does not create). */
  getEngineByRoot(root: string): GitEngine | undefined {
    return this.engines.get(root);
  }

  /** Pre-warm engines for a list of workspace folder paths. */
  async discoverRoots(folders: readonly string[]): Promise<void> {
    for (const folder of folders) {
      const root = this.findRepoRoot(folder);
      if (root) {
        this.getOrCreateEngine(root);
      } else {
        this.probeSubdirectories(folder);
      }
    }
  }

  /** If the folder itself is not a repo root, probe one level down. */
  private probeSubdirectories(folder: string): void {
    try {
      const entries = fs.readdirSync(folder, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }
        const subRoot = this.findRepoRoot(path.join(folder, entry.name));
        if (subRoot) {
          this.getOrCreateEngine(subRoot);
        }
      }
    } catch {
      // Ignore read errors
    }
  }

  checkActive(): boolean {
    for (const engine of this.engines.values()) {
      if (!engine.isDisposed()) {
        return true;
      }
    }
    return false;
  }

  // ---- Convenience methods that auto-resolve the correct engine ----

  async getBlame(filePath: string): Promise<BlameResult[]> {
    const e = await this.getEngineFor(filePath);
    return e ? e.getBlame(filePath) : [];
  }

  async getFileHistory(filePath: string, maxCount?: number): Promise<CommitLogEntry[]> {
    const e = await this.getEngineFor(filePath);
    return e ? e.getFileHistory(filePath, maxCount) : [];
  }

  async getCurrentBranch(filePath: string): Promise<string | undefined> {
    const e = await this.getEngineFor(filePath);
    return e ? e.getCurrentBranch() : undefined;
  }

  async getDiff(filePath: string, commitHash: string): Promise<string | undefined> {
    const e = await this.getEngineFor(filePath);
    return e ? e.getDiff(filePath, commitHash) : undefined;
  }

  async getFileAtCommit(filePath: string, commitHash: string): Promise<string | undefined> {
    const e = await this.getEngineFor(filePath);
    return e ? e.getFileAtCommit(filePath, commitHash) : undefined;
  }

  async getChangedFilesCount(filePath: string): Promise<number> {
    const e = await this.getEngineFor(filePath);
    return e ? e.getChangedFilesCount() : 0;
  }

  async getLatestHash(filePath: string): Promise<string | undefined> {
    const e = await this.getEngineFor(filePath);
    return e ? e.getLatestHash() : undefined;
  }

  async getUserName(filePath: string): Promise<string> {
    const e = await this.getEngineFor(filePath);
    return e ? e.getUserName() : 'You';
  }

  async getCommitBody(hash: string, filePath: string): Promise<string | undefined> {
    const e = await this.getEngineFor(filePath);
    return e ? e.getCommitBody(hash) : undefined;
  }

  async getCommitStats(hash: string, filePath: string): Promise<string | undefined> {
    const e = await this.getEngineFor(filePath);
    return e ? e.getCommitStats(hash) : undefined;
  }

  async execCli(args: string[], filePath: string): Promise<string | undefined> {
    const e = await this.getEngineFor(filePath);
    return e ? e.execCli(args) : undefined;
  }

  dispose(): void {
    this.disposed = true;
    for (const engine of this.engines.values()) {
      engine.dispose();
    }
    this.engines.clear();
  }

  // ---- Internal helpers ----

  private getOrCreateEngine(root: string): GitEngine {
    let engine = this.engines.get(root);
    if (!engine) {
      engine = new GitEngine(root);
      this.engines.set(root, engine);
      debug('Created engine for repo', { root });
    }
    return engine;
  }

  /**
   * Walk up from a file path to find the nearest .git file or directory.
   * Handles submodules where .git is a file with `gitdir:` reference.
   */
  private findRepoRoot(startPath: string): string | undefined {
    let current = path.isAbsolute(startPath) ? startPath : path.resolve(startPath);

    try {
      if (fs.statSync(current).isFile()) {
        current = path.dirname(current);
      }
    } catch {
      return undefined;
    }

    for (let i = 0; i < 32; i++) {
      const gitPath = path.join(current, '.git');
      try {
        const gitStat = fs.statSync(gitPath);
        if (gitStat.isDirectory()) {
          return current;
        }
        // Submodule: .git is a file containing "gitdir: <path>"
        if (gitStat.isFile()) {
          const content = fs.readFileSync(gitPath, 'utf8');
          const match = content.match(/^gitdir:\s*(.+)$/m);
          if (match) {
            debug('Resolved submodule gitdir', { current, gitdir: match[1].trim() });
          }
          return current;
        }
      } catch {
        // .git doesn't exist here, continue up
      }

      const parent = path.dirname(current);
      if (parent === current) {
        break;
      }
      current = parent;
    }

    return undefined;
  }
}
