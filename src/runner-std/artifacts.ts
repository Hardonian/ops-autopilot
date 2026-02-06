/**
 * Artifact Layout Manager
 *
 * Enforces the standard artifact directory structure:
 *   ./artifacts/<runId>/logs.jsonl
 *   ./artifacts/<runId>/evidence/*.json
 *   ./artifacts/<runId>/summary.json
 */

import { mkdirSync, writeFileSync, existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { redact, type RedactOptions } from './redact.js';
import type { ErrorEnvelope } from './errors.js';

export interface ArtifactSummary {
  runId: string;
  command: string;
  status: 'success' | 'failure';
  startedAt: string;
  completedAt: string;
  dryRun: boolean;
  error?: ErrorEnvelope;
  evidenceFiles: string[];
  logLineCount: number;
}

export interface ArtifactWriterOptions {
  baseDir?: string;
  redactOpts?: RedactOptions;
}

export class ArtifactWriter {
  readonly runId: string;
  readonly dir: string;
  readonly evidenceDir: string;
  private redactOpts: RedactOptions;
  private evidenceFiles: string[] = [];
  private logLines: string[] = [];

  constructor(runId: string, opts: ArtifactWriterOptions = {}) {
    const baseDir = opts.baseDir ?? './artifacts';
    this.runId = runId;
    this.dir = join(baseDir, runId);
    this.evidenceDir = join(this.dir, 'evidence');
    this.redactOpts = opts.redactOpts ?? {};
  }

  init(): void {
    mkdirSync(this.dir, { recursive: true });
    mkdirSync(this.evidenceDir, { recursive: true });
  }

  writeEvidence(name: string, data: unknown): string {
    const filename = name.endsWith('.json') ? name : `${name}.json`;
    const filePath = join(this.evidenceDir, filename);
    const redacted = redact(data, this.redactOpts);
    writeFileSync(filePath, JSON.stringify(redacted, null, 2));
    this.evidenceFiles.push(filename);
    return filePath;
  }

  appendLog(line: string): void {
    this.logLines.push(line);
  }

  flushLogs(): void {
    const logsPath = join(this.dir, 'logs.jsonl');
    writeFileSync(logsPath, this.logLines.join('\n') + (this.logLines.length > 0 ? '\n' : ''));
  }

  writeSummary(summary: ArtifactSummary): string {
    const summaryPath = join(this.dir, 'summary.json');
    const redacted = redact(summary, this.redactOpts);
    writeFileSync(summaryPath, JSON.stringify(redacted, null, 2));
    return summaryPath;
  }

  getEvidenceFiles(): string[] {
    return [...this.evidenceFiles];
  }
}

/**
 * Load an existing artifact directory for replay/diagnosis
 */
export function loadArtifacts(artifactDir: string): {
  summary: ArtifactSummary | null;
  logs: string[];
  evidence: Record<string, unknown>;
} {
  const summaryPath = join(artifactDir, 'summary.json');
  const logsPath = join(artifactDir, 'logs.jsonl');
  const evidenceDir = join(artifactDir, 'evidence');

  const summary = existsSync(summaryPath)
    ? (JSON.parse(readFileSync(summaryPath, 'utf-8')) as ArtifactSummary)
    : null;

  const logs = existsSync(logsPath)
    ? readFileSync(logsPath, 'utf-8').split('\n').filter(Boolean)
    : [];

  const evidence: Record<string, unknown> = {};
  if (existsSync(evidenceDir)) {
    for (const file of readdirSync(evidenceDir)) {
      if (file.endsWith('.json')) {
        evidence[file] = JSON.parse(readFileSync(join(evidenceDir, file), 'utf-8'));
      }
    }
  }

  return { summary, logs, evidence };
}
