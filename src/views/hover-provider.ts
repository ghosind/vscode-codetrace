/**
 * Hover provider for CodeTrace.
 * Displays commit details: author, date, message, change stats, hash.
 */
import * as vscode from 'vscode';
import { BlameProvider } from '../core/blame-provider';
import { GitEngine } from '../core/git-engine';
import { formatRelativeTime, formatAbsoluteTime } from '../utils/time-utils';

const statsCache = new Map<string, string>();

export class CodeTraceHoverProvider implements vscode.HoverProvider {
  private provider: BlameProvider;
  private engine: GitEngine;

  constructor(provider: BlameProvider, engine: GitEngine) {
    this.provider = provider;
    this.engine = engine;
  }

  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<vscode.Hover | undefined> {
    // Only show hover when cursor is on the blame decoration (at line end)
    const line = document.lineAt(position.line);
    if (line?.text && position.character < line.text.length) {
      return undefined;
    }

    const blame = await this.provider.getBlameForLine(document, position.line);
    if (!blame || blame.hash.startsWith('0000000')) {
      return undefined;
    }

    let stats = statsCache.get(blame.hash);
    if (!stats) {
      const s = await this.engine.getCommitStats(blame.hash);
      if (s) {
        statsCache.set(blame.hash, s);
        stats = s;
      }
    }

    const markdown = this.buildHoverMarkdown(blame, stats);
    const range = document.lineAt(position.line).range;
    return new vscode.Hover(markdown, range);
  }

  private buildHoverMarkdown(blame: {
    hash: string; author: string; email: string;
    timestamp: string; summary: string; body: string;
  }, stats?: string): vscode.MarkdownString {
    const m = new vscode.MarkdownString();
    m.isTrusted = true;
    m.supportHtml = true;

    this.appendAuthorLine(m, blame);
    this.appendCommitMessage(m, blame);
    if (stats) {
      m.appendMarkdown(`---  \n\n`);
      m.appendMarkdown(this.colorizeStats(stats) + `  \n\n`);
    }
    this.appendHashLine(m, blame);
    return m;
  }

  private appendAuthorLine(m: vscode.MarkdownString, blame: {
    author: string; email: string; timestamp: string;
  }): void {
    const author = blame.email
      ? `[${blame.author || blame.email}](mailto:${blame.email})`
      : (blame.author || 'unknown');
    const rel = formatRelativeTime(blame.timestamp);
    const abs = formatAbsoluteTime(blame.timestamp);
    const time = (rel && abs) ? `${rel} (${abs})` : (rel || abs || '--');
    m.appendMarkdown(`**${author}**, *${time}*  \n\n`);
  }

  private appendCommitMessage(m: vscode.MarkdownString, blame: {
    summary: string; body: string;
  }): void {
    m.appendMarkdown(`---  \n\n`);
    m.appendMarkdown(`**${this.esc(blame.summary)}**  \n\n`);
    if (blame.body?.trim()) {
      m.appendMarkdown(`${this.esc(this.truncateBody(blame.body))}  \n\n`);
    }
  }

  private appendHashLine(m: vscode.MarkdownString, blame: { hash: string }): void {
    const short = blame.hash.substring(0, 8);
    m.appendMarkdown(`*${short}* `);
    m.appendMarkdown(`<a href="command:codetrace.copyHash?${encodeURIComponent(JSON.stringify([blame.hash]))}" ` +
			`title="Copy full hash"><span class="codicon codicon-copy"></span></a>  \n`);
  }

  /** Wrap additions in green and deletions in red using HTML spans. */
  private colorizeStats(stats: string): string {
    return stats
      .replace(/(\d+) insertions?\(\+\)/g, '<span style="color:var(--vscode-gitDecoration-addedResourceForeground)">$&</span>')
      .replace(/(\d+) deletions?\(-\)/g, '<span style="color:var(--vscode-gitDecoration-deletedResourceForeground)">$&</span>');
  }

  private esc(text: string): string {
    return text.replace(/\\/g, '\\\\').replace(/\*/g, '\\*').replace(/_/g, '\\_')
      .replace(/`/g, '\\`').replace(/\[/g, '\\[').replace(/\]/g, '\\]');
  }

  private truncateBody(body: string, max = 6): string {
    const lines = body.split('\n');
    return lines.length <= max ? body : lines.slice(0, max).join('\n') + '\n\n*(truncated...)*';
  }
}
