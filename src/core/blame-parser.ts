/**
 * Git blame porcelain output parser for CodeTrace.
 * Parses `git blame --porcelain` and `git log -L` output.
 */
import { BlameResult, CommitLogEntry } from './git-engine';

/** Cached commit attributes keyed by hash. */
type BlameAttrs = Pick<BlameResult, 'author' | 'email' | 'timestamp' | 'summary'>;

/** Internal state for building blame results during porcelain parsing. */
interface ParseState {
  current: Partial<BlameResult> & { numLines?: number };
  lineNumber: number;
  commitProcessed: boolean;
}

/** Bundled mutable context shared across parser helper functions. */
interface BlameContext {
  state: ParseState;
  results: BlameResult[];
  attrCache: Map<string, BlameAttrs>;
  lastAttrs: BlameAttrs;
}

/**
 * Parse `git blame --porcelain` output into structured results.
 * @param output - Raw porcelain blame output
 * @returns Array of parsed blame results
 */
export function parseBlamePorcelain(output: string): BlameResult[] {
  const results: BlameResult[] = [];
  const lines = output.split('\n');
  const ctx: BlameContext = {
    state: { current: {}, lineNumber: 0, commitProcessed: false },
    results,
    attrCache: new Map(),
    lastAttrs: { author: '', email: '', timestamp: '', summary: '' },
  };

  for (const line of lines) {
    if (tryParseHeader(line, ctx)) {
      continue;
    }
    if (!ctx.state.commitProcessed) {
      parseAttributeLine(line, ctx);
    }
  }

  flushCurrentCommit(ctx);
  results.sort((a, b) => a.lineNumber - b.lineNumber);
  return results;
}

/** Get or create cached attributes for a commit hash. */
function getCachedAttrs(ctx: BlameContext, hash: string): BlameAttrs {
  let attrs = ctx.attrCache.get(hash);
  if (!attrs) {
    attrs = { author: '', email: '', timestamp: '', summary: '' };
    ctx.attrCache.set(hash, attrs);
  }
  return attrs;
}

/**
 * Try to parse a header line. Returns true if the line was a header.
 * Handles both full (4-field) and continuation (3-field) header formats.
 */
function tryParseHeader(line: string, ctx: BlameContext): boolean {
  const fullMatch = line.match(/^([0-9a-f]{40})\s+(\d+)\s+(\d+)\s+(\d+)/);
  if (fullMatch) {
    handleFullHeader(fullMatch[1], parseInt(fullMatch[3]), parseInt(fullMatch[4]), ctx);
    return true;
  }
  const contMatch = line.match(/^([0-9a-f]{40})\s+(\d+)\s+(\d+)$/);
  if (contMatch) {
    handleContinuationHeader(contMatch[1], parseInt(contMatch[3]), ctx);
    return true;
  }
  return false;
}

/** Process a full header line (4-field format). */
function handleFullHeader(
  hash: string, finalLine: number, numLines: number, ctx: BlameContext
): void {
  flushCurrentCommit(ctx);
  const attrs = getCachedAttrs(ctx, hash);
  ctx.state.current = {
    hash, numLines,
    author: attrs.author, email: attrs.email,
    timestamp: attrs.timestamp, summary: attrs.summary,
  };
  ctx.state.lineNumber = finalLine - 1;
  ctx.state.commitProcessed = false;
}

/** Process a continuation header line (3-field format). */
function handleContinuationHeader(
  hash: string, finalLine: number, ctx: BlameContext
): void {
  flushCurrentCommit(ctx);
  const attrs = getCachedAttrs(ctx, hash);
  ctx.results.push({
    hash, author: attrs.author || '', email: attrs.email || '',
    timestamp: attrs.timestamp || '', summary: attrs.summary || '',
    body: '', lineNumber: finalLine - 1,
  });
  ctx.state.commitProcessed = true;
}

/** Flush the current commit being built into results. */
function flushCurrentCommit(ctx: BlameContext): void {
  const { current, lineNumber, commitProcessed } = ctx.state;
  if (!current.hash || commitProcessed) {
    return;
  }
  const numLines = current.numLines || 1;
  for (let i = 0; i < numLines; i++) {
    ctx.results.push({
      hash: current.hash, author: current.author || '',
      email: current.email || '', timestamp: current.timestamp || '',
      summary: current.summary || '', body: '',
      lineNumber: lineNumber + i,
    });
  }
}

/**
 * Parse a single attribute line and update current commit, lastAttrs, and attrCache.
 * Handles: author, author-mail, author-time, summary.
 */
function parseAttributeLine(line: string, ctx: BlameContext): void {
  if (line.startsWith('author ')) {
    setBlameAttr(ctx, 'author', line.substring(7));
  } else if (line.startsWith('author-mail ')) {
    setBlameAttr(ctx, 'email', line.substring(12).replace(/[<>]/g, ''));
  } else if (line.startsWith('author-time ')) {
    const ts = new Date(parseInt(line.substring(12), 10) * 1000).toISOString();
    setBlameAttr(ctx, 'timestamp', ts);
  } else if (line.startsWith('summary ')) {
    setBlameAttr(ctx, 'summary', line.substring(8));
  }
}

/** Set a blame attribute on the current commit, lastAttrs, and the attrCache entry. */
function setBlameAttr(ctx: BlameContext, key: keyof BlameAttrs, value: string): void {
  const { current } = ctx.state;
  (current as Record<string, string>)[key] = value;
  ctx.lastAttrs[key] = value;
  if (current.hash) {
    const cached = ctx.attrCache.get(current.hash);
    if (cached) {
      cached[key] = value;
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
