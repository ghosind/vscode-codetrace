/**
 * Line history tracing for CodeTrace.
 * Uses git log -L to track a specific line's evolution across commits.
 */
import { RepoManager } from './repo-manager';
import { CommitLogEntry } from './git-engine';
import { parseLineHistoryOutput } from './blame-parser';

/**
 * Get the commit history for a specific line in a file.
 * @param repo - The repository manager
 * @param filePath - Absolute path to the file
 * @param lineNumber - 0-based line number to trace
 * @param maxCount - Maximum commits to return
 */
export async function getLineHistory(
  repo: RepoManager,
  filePath: string,
  lineNumber: number,
  maxCount = 30
): Promise<CommitLogEntry[]> {
  const engine = await repo.getEngineFor(filePath);
  if (!engine) {
    return [];
  }
  const relPath = engine.toRepoRelative(filePath);
  const lineSpec = `${lineNumber + 1},${lineNumber + 1}:${relPath}`;
  const output = await repo.execCli(
    ['log', `-${maxCount}`, `-L${lineSpec}`, '--format=%H%n%an%n%ae%n%aI%n%s'],
    filePath
  );
  if (output) {
    return parseLineHistoryOutput(output);
  }
  return lineHistoryFallback(repo, filePath, lineNumber, maxCount);
}

/** Approximate line history by filtering file commits against blame data. */
async function lineHistoryFallback(
  repo: RepoManager,
  filePath: string,
  lineNumber: number,
  maxCount: number
): Promise<CommitLogEntry[]> {
  const fileHistory = await repo.getFileHistory(filePath, maxCount);
  const blame = await repo.getBlame(filePath);
  const targetBlame = blame.find((b) => b.lineNumber === lineNumber);
  if (!targetBlame) {
    return fileHistory.slice(0, 5);
  }
  const result = fileHistory.filter((e) => e.hash === targetBlame.hash);
  for (const entry of fileHistory) {
    if (entry.hash !== targetBlame.hash) {
      result.push(entry);
    }
  }
  return result.slice(0, maxCount);
}
