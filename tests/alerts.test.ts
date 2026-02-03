import { describe, it, expect, beforeEach } from 'vitest';
import {
  AlertSchema,
  CorrelatedAlertGroupSchema,
  AlertCorrelationSchema,
  type Alert,
  type CorrelationRule,
} from '../src/contracts/index.js';
import {
  correlateAlerts,
  createAlertCorrelation,
  filterAlerts,
  validateAlerts,
  sortAlertsBySeverity,
  getCriticalAlerts,
  calculateAlertMetrics,
  defaultCorrelationRules,
} from '../src/alerts/index.js';

describe('Alert Correlation', () => {
  const mockAlerts: Alert[] = [
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
      threshold: 80,
      current_value: 85,
      timestamp: new Date(Date.now() - 300000).toISOString(), // 5 min ago
    },
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
      threshold: 90,
      current_value: 92,
      timestamp: new Date(Date.now() - 240000).toISOString(), // 4 min ago
    },
    {
      alert_id: 'alert-3',
      tenant_id: 'tenant-1',
      project_id: 'project-1',
      source: 'datadog',
      status: 'open',
      title: 'Database Connection Pool Exhausted',
      description: 'No available connections',
      severity: 'critical',
      service: 'database',
      metric: 'db_connections',
      threshold: 100,
      current_value: 100,
      timestamp: new Date(Date.now() - 180000).toISOString(), // 3 min ago
    },
    {
      alert_id: 'alert-4',
      tenant_id: 'tenant-1',
      project_id: 'project-1',
      source: 'prometheus',
      status: 'open',
      title: 'Latency P95 Spike',
      description: 'Latency above 500ms',
      severity: 'warning',
      service: 'frontend',
      metric: 'latency_p95',
      threshold: 500,
      current_value: 750,
      timestamp: new Date(Date.now() - 660000).toISOString(), // 11 min ago (outside window)
    },
  ];

  describe('validateAlerts', () => {
    it('should validate valid alerts', () => {
      const result = validateAlerts(mockAlerts);
      expect(result).toHaveLength(4);
      expect(result[0].alert_id).toBe('alert-1');
    });

    it('should throw on invalid alert', () => {
      const invalidAlerts = [{ ...mockAlerts[0], alert_id: '' }];
      expect(() => validateAlerts(invalidAlerts)).toThrow();
    });
  });

  describe('filterAlerts', () => {
    it('should filter by service', () => {
      const result = filterAlerts(mockAlerts, { services: ['api-service'] });
      expect(result).toHaveLength(2);
      expect(result[0].service).toBe('api-service');
    });

    it('should filter by source', () => {
      const result = filterAlerts(mockAlerts, { sources: ['cloudwatch'] });
      expect(result).toHaveLength(2);
      expect(result.every(a => a.source === 'cloudwatch')).toBe(true);
    });

    it('should filter by severity', () => {
      const result = filterAlerts(mockAlerts, { severities: ['critical'] });
      expect(result).toHaveLength(1);
      expect(result[0].severity).toBe('critical');
    });
  });

  describe('correlateAlerts', () => {
    it('should correlate alerts by service', () => {
      const result = correlateAlerts(mockAlerts.slice(0, 3)); // First 3 alerts

      expect(result.groups.length).toBeGreaterThan(0);
      expect(result.stats.total_alerts).toBe(3);
    });

    it('should respect time window', () => {
      const now = Date.now();
      const alerts = [
        {
          ...mockAlerts[0],
          alert_id: 'alert-window-1',
          timestamp: new Date(now - 900000).toISOString(), // 15 min ago
          service: 'checkout',
        },
        {
          ...mockAlerts[1],
          alert_id: 'alert-window-2',
          timestamp: new Date(now - 60000).toISOString(), // 1 min ago
          service: 'checkout',
        },
      ];

      const rule = {
        rule_id: 'time-window-test',
        name: 'Time Window Test',
        description: 'Ensure alerts outside window do not correlate',
        enabled: true,
        match_criteria: [{ field: 'service', operator: 'equals', value: '{{service}}' }],
        time_window_minutes: 5,
        correlation_logic: 'same_service',
        min_alerts: 2,
      };

      const result = correlateAlerts(alerts, [rule]);

      expect(result.groups).toHaveLength(0);
      expect(result.ungrouped).toHaveLength(2);
    });

    it('should create correlation groups with root cause analysis', () => {
      const result = correlateAlerts(mockAlerts.slice(0, 3));

      if (result.groups.length > 0) {
        const group = result.groups[0];
        expect(group.root_cause_analysis).toBeDefined();
        expect(group.root_cause_analysis.confidence).toBeGreaterThan(0);
        expect(group.root_cause_analysis.probable_cause).toBeTruthy();
      }
    });
  });

  describe('createAlertCorrelation', () => {
    it('should create valid AlertCorrelation output', () => {
      const correlationResult = correlateAlerts(mockAlerts.slice(0, 3));
      const correlation = createAlertCorrelation(
        'tenant-1',
        'project-1',
        correlationResult,
        'ops-base'
      );

      expect(correlation.tenant_id).toBe('tenant-1');
      expect(correlation.project_id).toBe('project-1');
      expect(correlation.profile_id).toBe('ops-base');
      expect(correlation.summary.total_alerts).toBe(3);
    });
  });

  describe('sortAlertsBySeverity', () => {
    it('should sort critical first', () => {
      const sorted = sortAlertsBySeverity(mockAlerts);
      expect(sorted[0].severity).toBe('critical');
    });
  });

  describe('getCriticalAlerts', () => {
    it('should return only critical alerts', () => {
      const critical = getCriticalAlerts(mockAlerts);
      expect(critical).toHaveLength(1);
      expect(critical[0].severity).toBe('critical');
    });
  });

  describe('calculateAlertMetrics', () => {
    it('should calculate correct metrics', () => {
      const metrics = calculateAlertMetrics(mockAlerts);

      expect(metrics.total).toBe(4);
      expect(metrics.by_severity.critical).toBe(1);
      expect(metrics.by_severity.warning).toBe(3);
      expect(metrics.by_service['api-service']).toBe(2);
      expect(metrics.by_source.cloudwatch).toBe(2);
    });
  });

  describe('defaultCorrelationRules', () => {
    it('should have valid rules', () => {
      expect(defaultCorrelationRules.length).toBeGreaterThan(0);

      for (const rule of defaultCorrelationRules) {
        expect(rule.rule_id).toBeTruthy();
        expect(rule.name).toBeTruthy();
        expect(rule.enabled).toBe(true);
        expect(rule.min_alerts).toBeGreaterThanOrEqual(1);
      }
    });
  });
});
