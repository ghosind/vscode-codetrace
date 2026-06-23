/**
 * Git engine for CodeTrace. Uses native Git CLI exclusively.
 */
import { spawn } from 'child_process';
import * as path from 'path';
import { parseBlamePorcelain } from './blame-parser';
import { debug, warn } from '../utils/logger';

const CMD_TIMEOUT_MS = 8000;

export interface BlameResult {
  hash: string; author: string; email: string;
  timestamp: string; summary: string; body: string; lineNumber: number;
}
export interface CommitLogEntry {
  hash: string; author: string; email: string;
  timestamp: string; summary: string; body: string;
}

export class GitEngine {
  private repoPath: string;
  private disposed = false;

  constructor(repoPath: string) { this.repoPath = repoPath; }

  async initialize(): Promise<void> {
    if (this.disposed) {
      return;
    }
    try {
      await this.execCli(['--version']);
    } catch (e) {
      warn('git --version failed', String(e));
    }
  }

  /** Execute a Git CLI command with timeout. */
  execCli(args: string[]): Promise<string | undefined> {
    const cmd = `git ${args.join(' ')}`;
    debug(cmd);
    return new Promise<string | undefined>((resolve) => {
      const proc = spawn('git', args, { cwd: this.repoPath, timeout: CMD_TIMEOUT_MS, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
      let stdout = '';
      let settled = false;
      proc.stdout?.on('data', (d: Buffer) => {
        stdout += d.toString();
      });
      const finish = (): void => {
        if (!settled) {
          settled = true;
          resolve(stdout.trim() || undefined);
        }
      };
      proc.on('close', finish);
      proc.on('error', (err) => {
        if (!settled) {
          settled = true;
          warn(`git command error: ${cmd}`, String(err));
          resolve(undefined);
        }
      });
      setTimeout(() => {
        if (!settled) {
          settled = true;
          proc.kill();
          resolve(undefined);
        }
      }, CMD_TIMEOUT_MS);
    });
  }

  /** Convert absolute path to repo-relative. */
  toRepoRelative(filePath: string): string {
    if (!path.isAbsolute(filePath)) {
      return filePath;
    }
    return path.relative(this.repoPath, filePath) || filePath;
  }

  async getBlame(filePath: string): Promise<BlameResult[]> {
    if (this.disposed) {
      return [];
    }
    try {
      const o = await this.execCli(['blame', '--porcelain', '--', filePath]);
      if (o) {
        return parseBlamePorcelain(o);
      }
    }
    catch (e) { warn('git blame failed', { filePath, error: String(e) }); }
    return [];
  }

  async getFileHistory(filePath: string, maxCount = 50): Promise<CommitLogEntry[]> {
    if (this.disposed) {
      return [];
    }
    const rel = this.toRepoRelative(filePath);
    try {
      const o = await this.execCli(['log', `-${maxCount}`, '--format=%H%n%an%n%ae%n%aI%n%s%n%b%n---END---', '--', rel]);
      if (o) {
        return parseLogOutput(o);
      }
    }
    catch (e) { warn('git log failed', { filePath, error: String(e) }); }
    return [];
  }

  async getCurrentBranch(): Promise<string | undefined> {
    if (this.disposed) {
      return undefined;
    }
    try {
      const o = await this.execCli(['rev-parse', '--abbrev-ref', 'HEAD']);
      if (o) {
        return o;
      }
    }
    catch (e) { warn('getCurrentBranch failed', String(e)); }
    return undefined;
  }

  async getDiff(filePath: string, commitHash: string): Promise<string | undefined> {
    if (this.disposed) {
      return undefined;
    }
    try {
      const o = await this.execCli(['diff', commitHash, '--', filePath]);
      if (o) {
        return o;
      }
    }
    catch (e) { warn('git diff failed', { filePath, commitHash, error: String(e) }); }
    return undefined;
  }

  async getFileAtCommit(filePath: string, commitHash: string): Promise<string | undefined> {
    if (this.disposed) {
      return undefined;
    }
    try {
      const o = await this.execCli(['show', `${commitHash}:${filePath}`]);
      if (o) {
        return o;
      }
    }
    catch (e) { warn('git show failed', { filePath, commitHash, error: String(e) }); }
    return undefined;
  }

  async getChangedFilesCount(): Promise<number> {
    if (this.disposed) {
      return 0;
    }
    try {
      const o = await this.execCli(['status', '--porcelain']);
      if (o) {
        return o.split('\n').filter((l) => l.trim()).length;
      }
    }
    catch (e) { warn('git status failed', String(e)); }
    return 0;
  }

  async getLatestHash(): Promise<string | undefined> {
    if (this.disposed) {
      return undefined;
    }
    try {
      return await this.execCli(['rev-parse', '--short', 'HEAD']);
    }
    catch (e) {
      warn('rev-parse HEAD failed', String(e));
      return undefined;
    }
  }

  async getUserName(): Promise<string> {
    try {
      return (await this.execCli(['config', 'user.name'])) || 'You';
    }
    catch (e) {
      warn('git config user.name failed', String(e));
      return 'You';
    }
  }

  async getCommitStats(hash: string): Promise<string | undefined> {
    if (this.disposed) {
      return undefined;
    }
    try {
      const o = await this.execCli(['show', '--stat', '--format=', hash]);
      if (o) {
        const lines = o.trim().split('\n');
        return lines[lines.length - 1]?.trim();
      }
    } catch (e) {
      warn('getCommitStats failed', { hash, error: String(e) });
    }
    return undefined;
  }

  isDisposed(): boolean { return this.disposed; }
  dispose(): void { this.disposed = true; }
}

export function parseLogOutput(output: string): CommitLogEntry[] {
  const entries: CommitLogEntry[] = [];
  for (const block of output.split('---END---')) {
    const lines = block.trim().split('\n');
    if (lines.length < 5) {
      continue;
    }
    entries.push({ hash: lines[0], author: lines[1], email: lines[2], timestamp: lines[3], summary: lines[4], body: lines.slice(5).join('\n').trim() });
  }
  return entries;
}
