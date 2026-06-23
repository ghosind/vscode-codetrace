/**
 * Line history tracing for CodeTrace.
 * Uses git log -L to track a specific line's evolution across commits.
 */
import { GitEngine, CommitLogEntry } from './git-engine';
import { parseLineHistoryOutput } from './blame-parser';

/**
 * Get the commit history for a specific line in a file.
 * @param engine - The Git engine instance
 * @param filePath - Absolute path to the file
 * @param lineNumber - 0-based line number to trace
 * @param maxCount - Maximum commits to return
 */
export async function getLineHistory(
  engine: GitEngine,
  filePath: string,
  lineNumber: number,
  maxCount = 30
): Promise<CommitLogEntry[]> {
  // Try native git log -L
  const relPath = engine.toRepoRelative(filePath);
  const lineSpec = `${lineNumber + 1},${lineNumber + 1}:${relPath}`;
  const output = await engine.execCli(['log', `-${maxCount}`, `-L${lineSpec}`, '--format=%H%n%an%n%ae%n%aI%n%s']);
  if (output) {
    return parseLineHistoryOutput(output);
  }
  // Fallback: approximate via file history
  return lineHistoryFallback(engine, filePath, lineNumber, maxCount);
}

/** Approximate line history by filtering file commits against blame data. */
async function lineHistoryFallback(
  engine: GitEngine,
  filePath: string,
  lineNumber: number,
  maxCount: number
): Promise<CommitLogEntry[]> {
  const fileHistory = await engine.getFileHistory(filePath, maxCount);
  const blame = await engine.getBlame(filePath);
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
