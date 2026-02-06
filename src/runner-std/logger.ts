/**
 * Structured Logger
 *
 * All log output is JSONL (one JSON object per line) to stderr.
 * Supports levels: debug, info, warn, error.
 * Redaction is applied automatically.
 */

import { redact, type RedactOptions } from './redact.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  ts: string;
  level: LogLevel;
  msg: string;
  runId?: string;
  [key: string]: unknown;
}

export interface LoggerOptions {
  runId?: string;
  json?: boolean;
  redactOpts?: RedactOptions;
  sink?: (line: string) => void;
}

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class Logger {
  private runId?: string;
  private json: boolean;
  private redactOpts: RedactOptions;
  private sink: (line: string) => void;
  private minLevel: LogLevel;
  readonly lines: string[] = [];

  constructor(opts: LoggerOptions = {}) {
    this.runId = opts.runId;
    this.json = opts.json ?? true;
    this.redactOpts = opts.redactOpts ?? {};
    this.sink = opts.sink ?? ((line: string): void => { process.stderr.write(line + '\n'); });
    this.minLevel = (process.env.LOG_LEVEL as LogLevel) ?? 'info';
  }

  private emit(level: LogLevel, msg: string, extra?: Record<string, unknown>): void {
    if (LEVEL_RANK[level] < LEVEL_RANK[this.minLevel]) return;

    const entry: LogEntry = {
      ts: new Date().toISOString(),
      level,
      msg,
      ...(this.runId ? { runId: this.runId } : {}),
      ...extra,
    };

    const redacted = redact(entry, this.redactOpts) as LogEntry;
    const line = this.json ? JSON.stringify(redacted) : `[${redacted.level.toUpperCase()}] ${redacted.msg}`;
    this.lines.push(line);
    this.sink(line);
  }

  debug(msg: string, extra?: Record<string, unknown>): void {
    this.emit('debug', msg, extra);
  }

  info(msg: string, extra?: Record<string, unknown>): void {
    this.emit('info', msg, extra);
  }

  warn(msg: string, extra?: Record<string, unknown>): void {
    this.emit('warn', msg, extra);
  }

  error(msg: string, extra?: Record<string, unknown>): void {
    this.emit('error', msg, extra);
  }
}
