/**
 * Blame provider module for CodeTrace.
 * Coordinates blame operations between the Git engine and cache layer.
 */
import * as vscode from 'vscode';
import { RepoManager } from './repo-manager';
import { BlameResult } from './git-engine';
import { CacheManager, CachedBlameLine } from '../cache/cache-manager';
import { shouldFilterFile, isSupportedUriScheme } from '../utils/filter';
import { getConfig } from '../utils/config';

export class BlameProvider {
  private repo: RepoManager | undefined;
  private cache: CacheManager;
  private idleTimer: ReturnType<typeof setTimeout> | undefined;
  private isSleeping = false;
  private isActive = true;

  constructor(cache: CacheManager) {
    this.cache = cache;
  }

  /** Set the Git engine and reset idle state. */
  setRepo(repo: RepoManager): void {
    this.repo = repo;
    this.isSleeping = false;
    this.isActive = true;
  }

  /** Check if the provider can serve blame requests. */
  private canServe(document: vscode.TextDocument): boolean {
    return this.isActive && !this.isSleeping &&
            !!this.repo && this.repo.checkActive() &&
            isSupportedUriScheme(document.uri) && !shouldFilterFile(document);
  }

  /** Get blame for a specific file and line. */
  async getBlameForLine(
    document: vscode.TextDocument,
    lineNumber: number
  ): Promise<BlameResult | undefined> {
    if (!this.canServe(document)) {
      return undefined;
    }

    const cached = this.cache.get(document.uri.fsPath, lineNumber);
    if (cached) {
      return this.cachedToBlameResult(cached);
    }

    const results = await this.repo!.getBlame(document.uri.fsPath);
    this.cacheAllResults(document.uri.fsPath, results);
    return results.find((r) => r.lineNumber === lineNumber);
  }

  /** Get blame for the visible range of a document. */
  async getBlameForVisibleRange(
    document: vscode.TextDocument,
    visibleRange: vscode.Range
  ): Promise<Map<number, BlameResult>> {
    const resultMap = new Map<number, BlameResult>();
    if (!this.canServe(document)) {
      return resultMap;
    }

    const uncachedLines = this.collectCachedLines(document, visibleRange, resultMap);
    if (uncachedLines.length === 0) {
      return resultMap;
    }

    const allResults = await this.repo!.getBlame(document.uri.fsPath);
    this.addResultsToMap(allResults, visibleRange, resultMap);
    return resultMap;
  }

  /** Cache all blame results for a file. */
  private cacheAllResults(filePath: string, results: BlameResult[]): void {
    for (const r of results) {
      this.cache.set(filePath, r.lineNumber, {
        hash: r.hash, author: r.author, email: r.email,
        timestamp: r.timestamp, summary: r.summary,
        body: r.body, lineNumber: r.lineNumber,
      });
    }
  }

  /** Collect cached lines and return uncached line numbers. */
  private collectCachedLines(
    document: vscode.TextDocument,
    range: vscode.Range,
    resultMap: Map<number, BlameResult>
  ): number[] {
    const uncached: number[] = [];
    const fp = document.uri.fsPath;
    for (let line = range.start.line; line <= range.end.line; line++) {
      const cached = this.cache.get(fp, line);
      if (cached) {
        resultMap.set(line, this.cachedToBlameResult(cached));
      }
      else {
        uncached.push(line);
      }
    }
    return uncached;
  }

  /** Add blame results that fall within the visible range to the map. */
  private addResultsToMap(
    results: BlameResult[],
    range: vscode.Range,
    resultMap: Map<number, BlameResult>
  ): void {
    for (const r of results) {
      if (r.lineNumber >= range.start.line && r.lineNumber <= range.end.line) {
        resultMap.set(r.lineNumber, r);
      }
    }
  }

  private cachedToBlameResult(cached: CachedBlameLine): BlameResult {
    return {
      hash: cached.hash, author: cached.author, email: cached.email,
      timestamp: cached.timestamp, summary: cached.summary,
      body: cached.body, lineNumber: cached.lineNumber,
    };
  }

  wake(): void {
    this.isSleeping = false;
    this.resetIdleTimer();
  }
  sleep(): void {
    this.isSleeping = true;
    this.cache.clearAll();
  }
  reportActivity(): void {
    // Wake from sleep if needed, then reset idle timer
    if (this.isSleeping) {
      this.isSleeping = false;
    }
    this.resetIdleTimer();
  }

  /** Invalidate all cached blame entries for a file. */
  invalidateFile(filePath: string): void {
    this.cache.invalidateFile(filePath);
  }

  private resetIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }
    const config = getConfig();
    if (config.idleSleep.enabled) {
      this.idleTimer = setTimeout(() => {
        this.sleep();
      }, config.idleSleep.timeout * 1000);
    }
  }

  dispose(): void {
    this.isActive = false;
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }
    this.cache.clearAll();
    this.repo = undefined;
  }
}
