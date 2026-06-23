/**
 * Git blame porcelain output parser for CodeTrace.
 * Parses `git blame --porcelain` and `git log -L` output.
 */
import { BlameResult, CommitLogEntry } from './git-engine';

/**
 * Parse `git blame --porcelain` output into structured results.
 * @param output - Raw porcelain blame output
 * @returns Array of parsed blame results
 */
export function parseBlamePorcelain(output: string): BlameResult[] {
  const results: BlameResult[] = [];
  const lines = output.split('\n');

  let current: Partial<BlameResult> & { numLines?: number } = {};
  let lineNumber = 0;
  let commitProcessed = false;
  // Cache attributes per commit hash for non-contiguous same-commit blocks
  type Attrs = Pick<BlameResult, 'author' | 'email' | 'timestamp' | 'summary'>;
  const attrCache = new Map<string, Attrs>();
  const lastAttrs: Attrs = { author: '', email: '', timestamp: '', summary: '' };

  for (const line of lines) {
    if (processHeaderLine(line)) {
      continue;
    }
    if (!commitProcessed) {
      parseAttr(line);
    }
  }

  flushCurrent();
  results.sort((a, b) => a.lineNumber - b.lineNumber);
  return results;

  /** Returns cached attrs for a hash, creating an empty entry if not found. */
  function getCachedAttrs(hash: string): Attrs {
    let a = attrCache.get(hash);
    if (!a) {
      a = { author: '', email: '', timestamp: '', summary: '' };
      attrCache.set(hash, a);
    }
    return a;
  }

  function processHeaderLine(line: string): boolean {
    const fm = line.match(/^([0-9a-f]{40})\s+(\d+)\s+(\d+)\s+(\d+)/);
    if (fm) {
      handleFullHeader(fm[1], parseInt(fm[3]), parseInt(fm[4]));
      return true;
    }
    const cm = line.match(/^([0-9a-f]{40})\s+(\d+)\s+(\d+)$/);
    if (cm) {
      handleContHeader(cm[1], parseInt(cm[3]));
      return true;
    }
    return false;
  }

  function handleFullHeader(hash: string, finalLine: number, numLines: number): void {
    flushCurrent();
    const attrs = getCachedAttrs(hash);
    current = { hash, numLines, author: attrs.author, email: attrs.email,
      timestamp: attrs.timestamp, summary: attrs.summary };
    lineNumber = finalLine - 1;
    commitProcessed = false;
  }

  function handleContHeader(hash: string, finalLine: number): void {
    flushCurrent();
    const attrs = getCachedAttrs(hash);
    results.push({ hash, author: attrs.author || '', email: attrs.email || '',
      timestamp: attrs.timestamp || '', summary: attrs.summary || '',
      body: '', lineNumber: finalLine - 1 });
    commitProcessed = true;
  }

  /** Flush the current commit being built into results */
  function flushCurrent(): void {
    if (!current.hash || commitProcessed) {
      return;
    }
    const numLines = current.numLines || 1;
    for (let i = 0; i < numLines; i++) {
      results.push({
        hash: current.hash, author: current.author || '',
        email: current.email || '', timestamp: current.timestamp || '',
        summary: current.summary || '', body: '',
        lineNumber: lineNumber + i,
      });
    }
  }

  /** Parse a single attribute line, updating current, lastAttrs, and attrCache. */
  function parseAttr(line: string): void {
    const c = current;
    const set = (k: keyof Attrs, v: string): void => {
      (c as Record<string, string>)[k] = v;
      lastAttrs[k] = v;
      const cached = c.hash ? attrCache.get(c.hash) : undefined;
      if (cached) {
        cached[k] = v;
      }
    };
    if (line.startsWith('author ')) {
      set('author', line.substring(7));
    }
    else if (line.startsWith('author-mail ')) {
      set('email', line.substring(12).replace(/[<>]/g, ''));
    }
    else if (line.startsWith('author-time ')) {
      set('timestamp', new Date(parseInt(line.substring(12), 10) * 1000).toISOString());
    }
    else if (line.startsWith('summary ')) {
      set('summary', line.substring(8));
    }
  }
}

/**
 * Parse git log -L output into CommitLogEntry array.
 * The --format option produces 5-line blocks per commit.
 * @param output - Raw git log -L output
 * @returns Array of parsed commit log entries
 */
export function parseLineHistoryOutput(output: string): CommitLogEntry[] {
  const entries: CommitLogEntry[] = [];
  const lines = output.split('\n');
  let i = 0;
  while (i < lines.length) {
    if (/^[0-9a-f]{40}$/.test(lines[i])) {
      entries.push({
        hash: lines[i],
        author: lines[i + 1] || '',
        email: lines[i + 2] || '',
        timestamp: lines[i + 3] || '',
        summary: lines[i + 4] || '',
        body: '',
      });
      i += 5;
    } else {
      i++;
    }
  }
  return entries;
}
