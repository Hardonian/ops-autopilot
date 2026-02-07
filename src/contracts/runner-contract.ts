/**
 * Runner Contract for ControlPlane Integration
 *
 * Defines the interface that ControlPlane expects from all runners.
 * Ensures safe, provable, and callable execution.
 */

import { z } from 'zod';

export const RunnerContractSchema = z.object({
  /** Unique runner identifier (e.g., 'ops.health_audit') */
  id: z.string().min(1),

  /** Semantic version of the runner */
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Must be semantic version'),

  /** Capabilities this runner provides */
  capabilities: z.array(z.string()).min(1),

  /** Blast radius assessment (what could this runner affect) */
  blastRadius: z.enum(['isolated', 'service', 'infrastructure', 'environment', 'global']),

  /** Execute function that never hard-crashes */
  execute: z
    .function()
    .args(z.unknown())
    .returns(
      z.promise(
        z.object({
          status: z.enum(['success', 'failure']),
          output: z.unknown(),
          evidence: z.object({
            json: z.record(z.string(), z.unknown()),
            markdown: z.string(),
          }),
          error: z.string().optional(),
        })
      )
    ),
});

export type RunnerContract = z.infer<typeof RunnerContractSchema>;

export const ExecuteResultSchema = z.object({
  status: z.enum(['success', 'failure']),
  output: z.unknown(),
  evidence: z.object({
    json: z.record(z.string(), z.unknown()),
    markdown: z.string(),
  }),
  error: z.string().optional(),
});

export type ExecuteResult = z.infer<typeof ExecuteResultSchema>;

/**
 * Evidence packet structure for provable execution
 */
export interface EvidencePacket extends Record<string, unknown> {
  /** Execution metadata */
  execution: {
    runner_id: string;
    runner_version: string;
    started_at: string;
    completed_at: string;
    duration_ms: number;
    idempotency_key?: string;
  };

  /** Input parameters (redacted) */
  inputs: Record<string, unknown>;

  /** Processing decisions and logic */
  decisions: Array<{
    stage: string;
    decision: string;
    reason: string;
    timestamp: string;
  }>;

  /** Output data */
  outputs: Record<string, unknown>;

  /** Version information */
  versions: {
    runner: string;
    contracts: string;
    runtime: string;
  };

  /** Cost and resource usage */
  resources: {
    estimated_cost_usd: number;
    actual_cost_usd?: number;
    resources_used: string[];
  };
}

/**
 * Generate evidence packet from execution context
 */
export function generateEvidencePacket(
  runnerId: string,
  runnerVersion: string,
  inputs: Record<string, unknown>,
  decisions: Array<{ stage: string; decision: string; reason: string }>,
  outputs: Record<string, unknown>,
  executionMetadata: {
    started_at: string;
    completed_at: string;
    duration_ms: number;
    estimated_cost_usd: number;
    actual_cost_usd?: number;
    idempotency_key?: string;
  }
): EvidencePacket {
  return {
    execution: {
      runner_id: runnerId,
      runner_version: runnerVersion,
      started_at: executionMetadata.started_at,
      completed_at: executionMetadata.completed_at,
      duration_ms: executionMetadata.duration_ms,
      idempotency_key: executionMetadata.idempotency_key,
    },
    inputs,
    decisions: decisions.map(d => ({
      ...d,
      timestamp: new Date().toISOString(),
    })),
    outputs,
    versions: {
      runner: runnerVersion,
      contracts: '1.0.0', // TODO: get from contracts package
      runtime: process.version,
    },
    resources: {
      estimated_cost_usd: executionMetadata.estimated_cost_usd,
      actual_cost_usd: executionMetadata.actual_cost_usd,
      resources_used: [], // TODO: implement resource tracking
    },
  };
}

/**
 * Generate markdown summary from evidence packet
 */
export function generateEvidenceMarkdown(packet: EvidencePacket): string {
  const { execution, decisions, resources } = packet;

  let markdown = `# Runner Execution Evidence\n\n`;
  markdown += `**Runner:** ${execution.runner_id}@${execution.runner_version}\n`;
  markdown += `**Execution ID:** ${execution.idempotency_key || 'N/A'}\n`;
  markdown += `**Started:** ${execution.started_at}\n`;
  markdown += `**Duration:** ${execution.duration_ms}ms\n`;
  markdown += `**Status:** ${decisions.length > 0 ? 'Executed' : 'No decisions made'}\n\n`;

  if (decisions.length > 0) {
    markdown += `## Execution Decisions\n\n`;
    for (const decision of decisions) {
      markdown += `- **${decision.stage}:** ${decision.decision}\n`;
      markdown += `  *${decision.reason}*\n\n`;
    }
  }

  markdown += `## Resource Usage\n\n`;
  markdown += `- **Estimated Cost:** $${resources.estimated_cost_usd}\n`;
  if (resources.actual_cost_usd !== undefined) {
    markdown += `- **Actual Cost:** $${resources.actual_cost_usd}\n`;
  }
  markdown += `- **Resources Used:** ${resources.resources_used.length > 0 ? resources.resources_used.join(', ') : 'None'}\n\n`;

  markdown += `## Versions\n\n`;
  markdown += `- **Runner:** ${packet.versions.runner}\n`;
  markdown += `- **Contracts:** ${packet.versions.contracts}\n`;
  markdown += `- **Runtime:** ${packet.versions.runtime}\n`;

  return markdown;
}
