/**
 * Git engine abstraction layer for CodeTrace.
 * CLI-first with automatic simple-git fallback.
 */
import { spawn } from 'child_process';
import * as path from 'path';
import simpleGit, { SimpleGit } from 'simple-git';
import { parseBlamePorcelain } from './blame-parser';

const MIN_GIT_CLI_VERSION = '2.20.0';
const CMD_TIMEOUT_MS = 8000;

export interface BlameResult {
    hash: string; author: string; email: string;
    timestamp: string; summary: string; body: string; lineNumber: number;
}
export interface CommitLogEntry {
    hash: string; author: string; email: string;
    timestamp: string; summary: string; body: string;
}

enum EngineCapability { Native = 'native', SimpleGit = 'simple-git' }

export class GitEngine {
    private repoPath: string;
    private capability: EngineCapability = EngineCapability.Native;
    private simpleGitInstance: SimpleGit | undefined;
    private disposed = false;

    constructor(repoPath: string) { this.repoPath = repoPath; }

    async initialize(): Promise<void> {
        if (this.disposed) { return; }
        try { const v = await this.execCli(['--version']); if (!v || !this.versionOk(v)) { this.fallbackToSimpleGit(); } }
        catch { this.fallbackToSimpleGit(); }
    }
    private fallbackToSimpleGit(): void { this.capability = EngineCapability.SimpleGit; this.simpleGitInstance = simpleGit(this.repoPath); }
    private versionOk(o: string): boolean {
        const m = o.match(/git version (\d+\.\d+\.\d+)/); if (!m) { return false; }
        const [a, b, c] = m[1].split('.').map(Number); const [ma, mb, mc] = MIN_GIT_CLI_VERSION.split('.').map(Number);
        return a > ma || (a === ma && b > mb) || (a === ma && b === mb && c >= mc);
    }

    /** Execute a Git CLI command with timeout. */
    execCli(args: string[]): Promise<string | undefined> {
        return new Promise<string | undefined>((resolve) => {
            const proc = spawn('git', args, { cwd: this.repoPath, timeout: CMD_TIMEOUT_MS, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
            let stdout = ''; let settled = false;
            proc.stdout?.on('data', (d: Buffer) => { stdout += d.toString(); });
            const finish = (): void => { if (!settled) { settled = true; resolve(stdout.trim() || undefined); } };
            proc.on('close', finish);
            proc.on('error', () => { if (!settled) { settled = true; resolve(undefined); } });
            setTimeout(() => { if (!settled) { settled = true; proc.kill(); resolve(undefined); } }, CMD_TIMEOUT_MS);
        });
    }

    /** Convert absolute path to repo-relative. */
    toRepoRelative(filePath: string): string {
        if (!path.isAbsolute(filePath)) { return filePath; }
        return path.relative(this.repoPath, filePath) || filePath;
    }

    async getBlame(filePath: string): Promise<BlameResult[]> {
        if (this.disposed) { return []; }
        try {
            if (this.capability === EngineCapability.Native) { const o = await this.execCli(['blame', '--porcelain', '--', filePath]); if (o) { return parseBlamePorcelain(o); } }
            if (this.simpleGitInstance) { const r = await this.simpleGitInstance.raw('blame', '--porcelain', '--', filePath); return parseBlamePorcelain(r); }
        } catch { this.fallbackToSimpleGit(); if (this.simpleGitInstance) { try { return parseBlamePorcelain(await this.simpleGitInstance.raw('blame', '--porcelain', '--', filePath)); } catch { /* */ } } }
        return [];
    }

    async getFileHistory(filePath: string, maxCount = 50): Promise<CommitLogEntry[]> {
        if (this.disposed) { return []; }
        const rel = this.toRepoRelative(filePath);
        try {
            if (this.capability === EngineCapability.Native) { const o = await this.execCli(['log', `-${maxCount}`, '--format=%H%n%an%n%ae%n%aI%n%s%n%b%n---END---', '--', rel]); if (o) { return parseLogOutput(o); } }
            if (this.simpleGitInstance) { const l = await this.simpleGitInstance.log({ file: rel, maxCount }); return l.all.map((e) => ({ hash: e.hash, author: e.author_name, email: e.author_email, timestamp: e.date, summary: e.message.split('\n')[0] || '', body: e.message.split('\n').slice(1).join('\n').trim() })); }
        } catch { this.fallbackToSimpleGit(); }
        return [];
    }

    async getCurrentBranch(): Promise<string | undefined> {
        if (this.disposed) { return undefined; }
        // Try simple-git first (typically faster for simple queries)
        if (this.simpleGitInstance) {
            try { return (await this.simpleGitInstance.status()).current || undefined; } catch { /* */ }
        }
        try { const o = await this.execCli(['rev-parse', '--abbrev-ref', 'HEAD']); if (o) { return o; } }
        catch { this.fallbackToSimpleGit(); if (this.simpleGitInstance) { try { return (await this.simpleGitInstance.status()).current || undefined; } catch { /* */ } } }
        return undefined;
    }

    async getDiff(filePath: string, commitHash: string): Promise<string | undefined> {
        if (this.disposed) { return undefined; }
        try { const o = await this.execCli(['diff', commitHash, '--', filePath]); if (o) { return o; } }
        catch { this.fallbackToSimpleGit(); }
        try { return this.simpleGitInstance?.diff([commitHash, '--', filePath]); } catch { return undefined; }
    }

    async getFileAtCommit(filePath: string, commitHash: string): Promise<string | undefined> {
        if (this.disposed) { return undefined; }
        try { const o = await this.execCli(['show', `${commitHash}:${filePath}`]); if (o) { return o; } }
        catch { this.fallbackToSimpleGit(); try { return this.simpleGitInstance?.show([`${commitHash}:${filePath}`]); } catch { return undefined; } }
        return undefined;
    }

    async getChangedFilesCount(): Promise<number> {
        if (this.disposed) { return 0; }
        try { const o = await this.execCli(['status', '--porcelain']); if (o) { return o.split('\n').filter((l) => l.trim()).length; } }
        catch { this.fallbackToSimpleGit(); }
        try { return this.simpleGitInstance ? (await this.simpleGitInstance.status()).files.length : 0; } catch { return 0; }
    }

    /** Get the short hash of the latest commit (HEAD). */
    async getLatestHash(): Promise<string | undefined> {
        if (this.disposed) { return undefined; }
        try { return await this.execCli(['rev-parse', '--short', 'HEAD']); }
        catch { this.fallbackToSimpleGit(); try { return await this.simpleGitInstance?.revparse(['--short', 'HEAD']); } catch { return undefined; } }
        return undefined;
    }

    /** Get the configured Git user name. */
    async getUserName(): Promise<string> {
        try { return (await this.execCli(['config', 'user.name'])) || 'You'; }
        catch { return 'You'; }
    }

    /** Get commit change stats: "2 files changed, 10 insertions(+), 3 deletions(-)". */
    async getCommitStats(hash: string): Promise<string | undefined> {
        if (this.disposed) { return undefined; }
        try {
            const o = await this.execCli(['show', '--stat', '--format=', hash]);
            if (o) {
                // Extract the last line which contains the summary
                const lines = o.trim().split('\n');
                return lines[lines.length - 1]?.trim();
            }
        } catch { /* fall through */ }
        return undefined;
    }

    isDisposed(): boolean { return this.disposed; }
    dispose(): void { this.disposed = true; this.simpleGitInstance = undefined; }
}

export function parseLogOutput(output: string): CommitLogEntry[] {
    const entries: CommitLogEntry[] = [];
    for (const block of output.split('---END---')) {
        const lines = block.trim().split('\n');
        if (lines.length < 5) { continue; }
        entries.push({ hash: lines[0], author: lines[1], email: lines[2], timestamp: lines[3], summary: lines[4], body: lines.slice(5).join('\n').trim() });
    }
    return entries;
}
