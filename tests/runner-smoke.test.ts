/**
 * Smoke test for Ops Autopilot Runner
 *
 * Tests the basic functionality and contract compliance of the runner.
 */

import { describe, it, expect } from 'vitest';
import { createOpsAutopilotRunner, runDemo, validateRunnerContract } from '../src/runner.js';
import { RunnerContractSchema } from '../src/contracts/runner-contract.js';

describe('OpsAutopilotRunner', () => {
  it('should implement RunnerContract interface', () => {
    const runner = createOpsAutopilotRunner();
    expect(validateRunnerContract(runner)).toBe(true);
  });

  it('should have valid contract schema', () => {
    const runner = createOpsAutopilotRunner();
    expect(() => RunnerContractSchema.parse(runner)).not.toThrow();
  });

  it('should have correct contract properties', () => {
    const runner = createOpsAutopilotRunner();
    expect(runner.id).toBe('ops-autopilot');
    expect(runner.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(runner.capabilities).toContain('ops.health_audit');
    expect(runner.blastRadius).toBe('infrastructure');
    expect(typeof runner.execute).toBe('function');
  });

  it('should execute demo successfully', async () => {
    const result = await runDemo();

    expect(result.status).toBe('success');
    expect(result.output).toBeDefined();
    expect(result.evidence).toBeDefined();
    expect(result.evidence.json).toBeDefined();
    expect(result.evidence.markdown).toBeDefined();
    expect(result.error).toBeUndefined();
  });

  it('should generate evidence packet in demo', async () => {
    const result = await runDemo();

    const evidence = result.evidence.json as any; // Type assertion for test
    expect(evidence.execution).toBeDefined();
    expect(evidence.execution.runner_id).toBe('ops-autopilot');
    expect(evidence.inputs).toBeDefined();
    expect(evidence.decisions).toBeInstanceOf(Array);
    expect(evidence.outputs).toBeDefined();
    expect(evidence.versions).toBeDefined();
    expect(evidence.resources).toBeDefined();
  });

  it('should handle invalid input gracefully', async () => {
    const runner = createOpsAutopilotRunner();

    const result = await runner.execute({ invalid: 'input' });

    expect(result.status).toBe('failure');
    expect(result.output).toBeNull();
    expect(result.error).toBeDefined();
    expect(result.evidence).toBeDefined();
  });

  it('should never throw unhandled exceptions', async () => {
    const runner = createOpsAutopilotRunner();

    // Test with completely invalid input
    const result = await runner.execute(null);

    expect(result.status).toBe('failure');
    expect(result.error).toBeDefined();
  });

  it('should generate markdown evidence summary', async () => {
    const result = await runDemo();

    expect(result.evidence.markdown).toContain('# Runner Execution Evidence');
    expect(result.evidence.markdown).toContain('**Runner:** ops-autopilot@');
    expect(result.evidence.markdown).toContain('## Execution Decisions');
    expect(result.evidence.markdown).toContain('## Resource Usage');
    expect(result.evidence.markdown).toContain('## Versions');
  });
});
