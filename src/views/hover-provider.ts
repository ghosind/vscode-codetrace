/**
 * Hover provider for CodeTrace.
 * Displays commit details: author, date, message, change stats, hash.
 */
import * as vscode from 'vscode';
import { BlameProvider } from '../core/blame-provider';
import { GitEngine } from '../core/git-engine';
import { formatRelativeTime, formatAbsoluteTime } from '../utils/time-utils';

const statsCache = new Map<string, string>();
const bodyCache = new Map<string, string>();

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

    const [stats, body] = await this.fetchCommitDetails(blame.hash);
    const markdown = this.buildHoverMarkdown(blame, stats, body);
    const range = document.lineAt(position.line).range;
    return new vscode.Hover(markdown, range);
  }

  private async fetchCommitDetails(
    hash: string
  ): Promise<[string | undefined, string | undefined]> {
    let stats = statsCache.get(hash);
    if (!stats) {
      const s = await this.engine.getCommitStats(hash);
      if (s) {
        statsCache.set(hash, s);
        stats = s;
      }
    }

    let body = bodyCache.get(hash);
    if (body === undefined && !bodyCache.has(hash)) {
      const b = await this.engine.getCommitBody(hash);
      bodyCache.set(hash, b || '');
      body = b || '';
    }

    return [stats, body];
  }

  private buildHoverMarkdown(blame: {
    hash: string; author: string; email: string;
    timestamp: string; summary: string; body: string;
  }, stats?: string, fullBody?: string): vscode.MarkdownString {
    const m = new vscode.MarkdownString();
    m.isTrusted = true;
    m.supportHtml = true;

    this.appendAuthorLine(m, blame);
    this.appendCommitMessage(m, blame, fullBody);
    if (stats) {
      m.appendMarkdown(`---  \n\n`);
      m.appendMarkdown(`${stats}  \n\n`);
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
  }, fullBody?: string): void {
    m.appendMarkdown(`---  \n\n`);
    m.appendMarkdown(`**${this.esc(blame.summary)}**  \n\n`);
    const bodyText = (fullBody || blame.body || '').trim();
    if (bodyText) {
      m.appendMarkdown(`${this.esc(bodyText)}  \n\n`);
    }
  }

  private appendHashLine(m: vscode.MarkdownString, blame: { hash: string }): void {
    const short = blame.hash.substring(0, 8);
    m.appendMarkdown(`*${short}* `);
    m.appendMarkdown(`<a href="command:codetrace.copyHash?${encodeURIComponent(JSON.stringify([blame.hash]))}" ` +
      `title="Copy full hash"><span class="codicon codicon-copy"></span></a>  \n`);
  }

  private esc(text: string): string {
    return text.replace(/\\/g, '\\\\').replace(/\*/g, '\\*').replace(/_/g, '\\_')
      .replace(/`/g, '\\`').replace(/\[/g, '\\[').replace(/\]/g, '\\]');
  }
}
