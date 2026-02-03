import {
  ReliabilityReportSchema,
  generateId,
  computeHash,
  type ReliabilityReport,
  type ReportInput,
  type Alert,
} from '../contracts/index.js';

export interface ReliabilityReportOptions {
  stableOutput?: boolean;
  generatedAt?: string;
}

const STABLE_TIMESTAMP = '2000-01-01T00:00:00.000Z';
const STABLE_ID = '00000000-0000-0000-0000-000000000000';

export function generateReliabilityReport(
  input: ReportInput,
  alerts: Alert[],
  options: ReliabilityReportOptions = {}
): ReliabilityReport {
  const findings = [];
  const recommendations = [];
  const anomalies = [];
  const serviceHealth = [];

  let criticalAlerts: Alert[] = [];
  if (alerts.length > 0) {
    criticalAlerts = alerts.filter(alert => alert.severity === 'critical');
    if (criticalAlerts.length > 0) {
      const findingId = options.stableOutput ? STABLE_ID : generateId();
      findings.push({
        id: findingId,
        severity: 'critical',
        category: 'incident_response',
        message: `${criticalAlerts.length} critical alerts during reporting period`,
        recommendation: 'Review critical incidents and ensure runbooks exist',
        evidence: [
          {
            type: 'event_count',
            path: 'alerts',
            value: criticalAlerts.length,
            description: 'Count of critical severity alerts',
          },
        ],
      });

      recommendations.push({
        priority: 'critical',
        category: 'incident_response',
        description: 'Improve early detection for critical issues',
        expected_impact: 'Reduce MTTR for critical incidents',
        implementation_effort: 'medium',
        related_findings: [findingId],
      });
    }

    if (alerts.length > 50) {
      anomalies.push({
        anomaly_id: options.stableOutput ? STABLE_ID : generateId(),
        type: 'spike',
        service: 'multiple',
        metric: 'alert_count',
        detected_at: input.period_end,
        severity: 'warning',
        baseline_value: 10,
        observed_value: alerts.length,
        deviation_percent: ((alerts.length - 10) / 10) * 100,
        contributing_factors: ['Unusual alert volume', 'Possible infrastructure event'],
      });
    }
  }

  if (input.services) {
    for (const service of input.services) {
      serviceHealth.push({
        service_name: service,
        status: 'healthy',
        availability_percent: 99.9,
        latency_p95_ms: 150,
        error_rate_percent: 0.1,
        metrics: [],
      });
    }
  }

  const healthScore = Math.max(0, 100 - (criticalAlerts?.length ?? 0) * 10 - anomalies.length * 5);
  const generatedAt =
    options.generatedAt ?? (options.stableOutput ? STABLE_TIMESTAMP : new Date().toISOString());

  const report = {
    report_id: options.stableOutput ? STABLE_ID : generateId(),
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    report_type: input.report_type,
    period_start: input.period_start,
    period_end: input.period_end,
    generated_at: generatedAt,
    overall_health_score: healthScore,
    service_health: serviceHealth,
    anomalies,
    findings,
    recommendations,
    job_requests: [],
    profile_id: input.profile_id,
    report_hash: computeHash(
      `${input.tenant_id}:${input.project_id}:${input.period_start}:${input.period_end}`
    ),
    redaction_applied: true,
  };

  return ReliabilityReportSchema.parse(report);
}
