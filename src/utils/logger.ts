/**
 * Lightweight logger for CodeTrace. Writes to a dedicated VS Code output channel.
 * Log level controlled via codetrace.logLevel setting.
 */
import * as vscode from 'vscode';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

let channel: vscode.OutputChannel | undefined;
let minLevel: LogLevel = 'info';

/** Initialize the logger. Must be called once during extension activation. */
export function initLogger(context: vscode.ExtensionContext): void {
  channel = vscode.window.createOutputChannel('CodeTrace', { log: true });
  const cfg = vscode.workspace.getConfiguration('codetrace');
  minLevel = (cfg.get<string>('logLevel') as LogLevel) || 'info';
  context.subscriptions.push(channel);
  info('CodeTrace logger initialized');
}

/** Set the minimum log level dynamically. */
export function setLogLevel(level: LogLevel): void {
  minLevel = level;
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[minLevel];
}

function formatMsg(message: string, data?: unknown): string {
  const ts = new Date().toISOString().substring(11, 23);
  const prefix = `[${ts}]`;
  return data !== undefined ? `${prefix} ${message} ${JSON.stringify(data)}` : `${prefix} ${message}`;
}

/** Debug-level log (verbose, disabled by default). */
export function debug(message: string, data?: unknown): void {
  if (channel && shouldLog('debug')) {
    channel.appendLine(formatMsg(`DEBUG ${message}`, data));
  }
}

/** Info-level log. */
export function info(message: string, data?: unknown): void {
  if (channel && shouldLog('info')) {
    channel.appendLine(formatMsg(`INFO  ${message}`, data));
  }
}

/** Warning-level log. */
export function warn(message: string, data?: unknown): void {
  if (channel && shouldLog('warn')) {
    channel.appendLine(formatMsg(`WARN  ${message}`, data));
  }
}

/** Error-level log (always shown). */
export function error(message: string, data?: unknown): void {
  if (channel) {
    channel.appendLine(formatMsg(`ERROR ${message}`, data));
  }
}

/** Measure execution time of an async operation. Logs duration at debug level. */
export async function measure<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  try {
    return await fn();
  } finally {
    debug(`${label} took ${Date.now() - start}ms`);
  }
}
