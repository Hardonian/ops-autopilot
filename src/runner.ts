/**
 * Ops Autopilot Runner
 *
 * Implements the Runner Contract for ControlPlane integration.
 * Provides safe, provable, and callable execution of ops capabilities.
 */

import { randomUUID } from 'crypto';
import {
  RunnerContract,
  ExecuteResult,
  generateEvidencePacket,
  generateEvidenceMarkdown,
  RunnerContractSchema,
} from './contracts/runner-contract.js';
import { executeHealthAudit } from './capabilities/health-audit.js';
import { HealthAuditInputSchema } from './contracts/index.js';

/**
 * Ops Autopilot Runner Implementation
 *
 * Wraps ops capabilities with the Runner Contract interface.
 * Ensures safe execution and evidence generation.
 */
export class OpsAutopilotRunner implements RunnerContract {
  readonly id = 'ops-autopilot';
  readonly version = '0.1.0';
  readonly capabilities = ['ops.health_audit'];
  readonly blastRadius = 'infrastructure' as const;

  /**
   * Execute a capability with guaranteed safe return
   *
   * @param input - Input parameters for the capability
   * @returns ExecuteResult with status, output, evidence, and optional error
   */
  async execute(input: unknown): Promise<ExecuteResult> {
    const startedAt = new Date().toISOString();
    const startTime = Date.now();

    try {
      // Validate and parse input
      const validatedInput = HealthAuditInputSchema.parse(input);

      // Generate idempotency key if not provided
      const idempotencyKey = validatedInput.idempotency_key || randomUUID();

      // Execute the capability
      const auditResult = await executeHealthAudit(validatedInput);

      const completedAt = new Date().toISOString();
      const duration = Date.now() - startTime;

      // Generate evidence packet
      const evidencePacket = generateEvidencePacket(
        this.id,
        this.version,
        {
          tenant_id: validatedInput.tenant_id,
          project_id: validatedInput.project_id,
          services: validatedInput.services,
          audit_depth: validatedInput.audit_depth,
          // Redact sensitive data if any
        },
        [
          {
            stage: 'input_validation',
            decision: 'validated',
            reason: `Validated input for ${validatedInput.services?.length || 0} services`,
          },
          {
            stage: 'execution',
            decision: 'completed',
            reason: `Audited ${auditResult.services_audited.length} services with status ${auditResult.status}`,
          },
        ],
        {
          audit_id: auditResult.audit_id,
          status: auditResult.status,
          services_audited: auditResult.services_audited,
          findings_count: auditResult.findings.length,
          recommendations_count: auditResult.recommendations.length,
        },
        {
          started_at: startedAt,
          completed_at: completedAt,
          duration_ms: duration,
          estimated_cost_usd: auditResult.execution_metadata.cost_usd_estimate,
          actual_cost_usd: auditResult.execution_metadata.cost_usd_estimate, // For now, same as estimate
          idempotency_key: idempotencyKey,
        }
      );

      return {
        status: 'success',
        output: auditResult,
        evidence: {
          json: evidencePacket as unknown as Record<string, unknown>,
          markdown: generateEvidenceMarkdown(evidencePacket),
        },
      };
    } catch (error) {
      const completedAt = new Date().toISOString();
      const duration = Date.now() - startTime;

      // Generate error evidence
      const evidencePacket = generateEvidencePacket(
        this.id,
        this.version,
        { input }, // Raw input for error analysis
        [
          {
            stage: 'error_handling',
            decision: 'failed',
            reason: `Execution failed: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        {},
        {
          started_at: startedAt,
          completed_at: completedAt,
          duration_ms: duration,
          estimated_cost_usd: 0,
          idempotency_key: randomUUID(),
        }
      );

      return {
        status: 'failure',
        output: null,
        evidence: {
          json: evidencePacket as unknown as Record<string, unknown>,
          markdown: generateEvidenceMarkdown(evidencePacket),
        },
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

/**
 * Factory function to create a new Ops Autopilot Runner instance
 */
export function createOpsAutopilotRunner(): OpsAutopilotRunner {
  return new OpsAutopilotRunner();
}

/**
 * Demo run function for testing and demonstration
 *
 * @param options - Demo options
 * @returns ExecuteResult with deterministic demo data
 */
export async function runDemo(
  options: { tenantId?: string; projectId?: string } = {}
): Promise<ExecuteResult> {
  const runner = createOpsAutopilotRunner();

  const demoInput = {
    tenant_id: options.tenantId || 'demo-tenant',
    project_id: options.projectId || 'demo-project',
    services: ['api', 'database'],
    audit_depth: 'standard' as const,
    include_metrics: ['cpu', 'memory'],
    time_range: {
      start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 24 hours ago
      end: new Date().toISOString(),
    },
    idempotency_key: 'demo-run-' + Date.now(),
  };

  return runner.execute(demoInput);
}

/**
 * Validate runner contract compliance
 */
export function validateRunnerContract(runner: RunnerContract): boolean {
  try {
    RunnerContractSchema.parse(runner);
    return true;
  } catch {
    return false;
  }
}
