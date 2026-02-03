import { describe, it, expect } from 'vitest';
import { RunbookSchema, type CorrelatedAlertGroup, type Alert } from '../src/contracts/index.js';
import {
  generateRunbook,
  validateRunbook,
  getAutomatedSteps,
  getManualSteps,
  getStepsRequiringApproval,
  calculateRunbookProgress,
} from '../src/runbooks/index.js';

describe('Runbook Generation', () => {
  const mockAlertGroup: CorrelatedAlertGroup = {
    group_id: 'group-1',
    correlation_rule_id: 'same-service-multiple-metrics',
    alerts: [
      {
        alert_id: 'alert-1',
        tenant_id: 'tenant-1',
        project_id: 'project-1',
        source: 'cloudwatch',
        status: 'open',
        title: 'High CPU Usage',
        description: 'CPU usage above 80%',
        severity: 'warning',
        service: 'api-service',
        metric: 'cpu_usage',
        timestamp: new Date().toISOString(),
      } as Alert,
      {
        alert_id: 'alert-2',
        tenant_id: 'tenant-1',
        project_id: 'project-1',
        source: 'cloudwatch',
        status: 'open',
        title: 'Memory Usage High',
        description: 'Memory usage above 90%',
        severity: 'warning',
        service: 'api-service',
        metric: 'memory_usage',
        timestamp: new Date().toISOString(),
      } as Alert,
    ],
    root_cause_analysis: {
      probable_cause: 'Resource exhaustion in api-service',
      confidence: 0.85,
      contributing_factors: ['High CPU usage', 'High memory usage'],
    },
    blast_radius: {
      services_affected: ['api-service'],
      estimated_impact: 'medium',
    },
    created_at: new Date().toISOString(),
  };

  const mockCascadeAlertGroup: CorrelatedAlertGroup = {
    group_id: 'group-2',
    correlation_rule_id: 'cascade-failure-pattern',
    alerts: [
      {
        alert_id: 'alert-3',
        tenant_id: 'tenant-1',
        project_id: 'project-1',
        source: 'datadog',
        status: 'open',
        title: 'Service A Down',
        description: 'Service A is not responding',
        severity: 'critical',
        service: 'service-a',
        timestamp: new Date().toISOString(),
      } as Alert,
      {
        alert_id: 'alert-4',
        tenant_id: 'tenant-1',
        project_id: 'project-1',
        source: 'datadog',
        status: 'open',
        title: 'Service B Degraded',
        description: 'Service B experiencing issues',
        severity: 'critical',
        service: 'service-b',
        timestamp: new Date().toISOString(),
      } as Alert,
      {
        alert_id: 'alert-5',
        tenant_id: 'tenant-1',
        project_id: 'project-1',
        source: 'datadog',
        status: 'open',
        title: 'Service C Errors',
        description: 'Service C showing errors',
        severity: 'critical',
        service: 'service-c',
        timestamp: new Date().toISOString(),
      } as Alert,
    ],
    root_cause_analysis: {
      probable_cause: 'Cascading failure across multiple services',
      confidence: 0.9,
      contributing_factors: ['Service dependency failure', 'Chain reaction'],
    },
    blast_radius: {
      services_affected: ['service-a', 'service-b', 'service-c'],
      estimated_impact: 'critical',
    },
    created_at: new Date().toISOString(),
  };

  describe('generateRunbook', () => {
    it('should generate a valid runbook', () => {
      const runbook = generateRunbook(mockAlertGroup);

      expect(runbook.runbook_id).toBeTruthy();
      expect(runbook.name).toBeTruthy();
      expect(runbook.description).toBeTruthy();
      expect(runbook.steps.length).toBeGreaterThan(0);
      expect(runbook.prerequisites.length).toBeGreaterThan(0);
      expect(runbook.post_conditions.length).toBeGreaterThan(0);
    });

    it('should generate runbook for resource exhaustion pattern', () => {
      const runbook = generateRunbook(mockAlertGroup);

      expect(runbook.name).toContain('Resource');
      expect(runbook.severity).toBe('warning');
      expect(runbook.estimated_duration_minutes).toBeGreaterThan(0);
    });

    it('should generate runbook for cascade failure pattern', () => {
      const runbook = generateRunbook(mockCascadeAlertGroup);

      expect(runbook.name).toContain('Cascade');
      expect(runbook.severity).toBe('critical');
    });

    it('should respect includeAutomation option', () => {
      const runbookWithAuto = generateRunbook(mockAlertGroup, undefined, {
        includeAutomation: true,
      });
      const runbookWithoutAuto = generateRunbook(mockAlertGroup, undefined, {
        includeAutomation: false,
      });

      const autoStepsWith = getAutomatedSteps(runbookWithAuto);
      const autoStepsWithout = getAutomatedSteps(runbookWithoutAuto);

      expect(autoStepsWith.length).toBeGreaterThanOrEqual(autoStepsWithout.length);
    });

    it('should number steps sequentially', () => {
      const runbook = generateRunbook(mockAlertGroup);

      for (let i = 0; i < runbook.steps.length; i++) {
        expect(runbook.steps[i].step_number).toBe(i + 1);
      }
    });
  });

  describe('validateRunbook', () => {
    it('should validate valid runbook', () => {
      const runbook = generateRunbook(mockAlertGroup);
      const validated = validateRunbook(runbook);

      expect(validated.runbook_id).toBe(runbook.runbook_id);
    });

    it('should throw on invalid runbook', () => {
      const invalid = { ...generateRunbook(mockAlertGroup), runbook_id: '' };
      expect(() => validateRunbook(invalid)).toThrow();
    });
  });

  describe('getAutomatedSteps', () => {
    it('should return automated steps', () => {
      const runbook = generateRunbook(mockAlertGroup, undefined, { includeAutomation: true });
      const automated = getAutomatedSteps(runbook);

      expect(automated.every(s => s.automated)).toBe(true);
    });
  });

  describe('getManualSteps', () => {
    it('should return manual steps', () => {
      const runbook = generateRunbook(mockAlertGroup);
      const manual = getManualSteps(runbook);

      expect(manual.every(s => !s.automated)).toBe(true);
    });
  });

  describe('getStepsRequiringApproval', () => {
    it('should return steps requiring approval', () => {
      const runbook = generateRunbook(mockAlertGroup);
      const approvalSteps = getStepsRequiringApproval(runbook);

      expect(approvalSteps.every(s => s.requires_approval)).toBe(true);
      expect(approvalSteps.length).toBeGreaterThan(0);
    });
  });

  describe('calculateRunbookProgress', () => {
    it('should calculate correct progress', () => {
      const runbook = generateRunbook(mockAlertGroup);
      const progress = calculateRunbookProgress(runbook, [1, 2]);

      expect(progress.percent).toBeGreaterThan(0);
      expect(progress.remaining).toBe(runbook.steps.length - 2);
    });

    it('should return 0% for no completed steps', () => {
      const runbook = generateRunbook(mockAlertGroup);
      const progress = calculateRunbookProgress(runbook, []);

      expect(progress.percent).toBe(0);
      expect(progress.remaining).toBe(runbook.steps.length);
    });

    it('should return 100% for all completed steps', () => {
      const runbook = generateRunbook(mockAlertGroup);
      const allSteps = runbook.steps.map(s => s.step_number);
      const progress = calculateRunbookProgress(runbook, allSteps);

      expect(progress.percent).toBe(100);
      expect(progress.remaining).toBe(0);
    });
  });
});
