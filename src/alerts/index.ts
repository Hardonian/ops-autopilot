import {
  AlertSchema,
  generateId,
  type Alert,
  type AlertSource,
  type CorrelationRule,
  type CorrelatedAlertGroup,
  type AlertCorrelation,
  type Severity,
} from '../contracts/index.js';
import { type Profile } from '../profiles/index.js';

/**
 * Alert Correlation Logic
 * 
 * Detects patterns across infrastructure alerts to identify root causes,
 * reduce noise, and prioritize incident response.
 */

// ============================================================================
// Default Correlation Rules
// ============================================================================

export const defaultCorrelationRules: CorrelationRule[] = [
  {
    rule_id: 'same-service-multiple-metrics',
    name: 'Same Service - Multiple Metrics',
    description: 'Correlate alerts from the same service across different metrics',
    enabled: true,
    match_criteria: [
      { field: 'service', operator: 'equals', value: '{{service}}' },
    ],
    time_window_minutes: 10,
    correlation_logic: 'same_service',
    min_alerts: 2,
  },
  {
    rule_id: 'cascade-failure-pattern',
    name: 'Cascade Failure Pattern',
    description: 'Detect cascading failures across dependent services',
    enabled: true,
    match_criteria: [
      { field: 'severity', operator: 'equals', value: 'critical' },
    ],
    time_window_minutes: 5,
    correlation_logic: 'custom',
    min_alerts: 3,
  },
  {
    rule_id: 'infrastructure-resource-exhaustion',
    name: 'Resource Exhaustion Pattern',
    description: 'Correlate CPU, memory, and disk alerts indicating resource exhaustion',
    enabled: true,
    match_criteria: [
      { field: 'metric', operator: 'regex', value: '(cpu|memory|disk)_usage' },
    ],
    time_window_minutes: 15,
    correlation_logic: 'common_source',
    min_alerts: 2,
  },
  {
    rule_id: 'deployment-related-issues',
    name: 'Deployment Related Issues',
    description: 'Group alerts that occur shortly after a deployment',
    enabled: true,
    match_criteria: [
      { field: 'title', operator: 'contains', value: 'deployment' },
    ],
    time_window_minutes: 30,
    correlation_logic: 'custom',
    min_alerts: 1,
  },
  {
    rule_id: 'database-connection-pool',
    name: 'Database Connection Pool Exhaustion',
    description: 'Detect database connection pool issues',
    enabled: true,
    match_criteria: [
      { field: 'metric', operator: 'regex', value: 'db_(connections|pool)' },
    ],
    time_window_minutes: 5,
    correlation_logic: 'same_metric',
    min_alerts: 2,
  },
];

// ============================================================================
// Alert Processing
// ============================================================================

export interface AlertFilter {
  sources?: AlertSource[];
  services?: string[];
  severities?: Severity[];
  status?: string[];
  timeRange?: { start: Date; end: Date };
}

export function filterAlerts(alerts: Alert[], filter: AlertFilter): Alert[] {
  return alerts.filter(alert => {
    if (filter.sources && !filter.sources.includes(alert.source)) {
      return false;
    }
    if (filter.services && !filter.services.includes(alert.service)) {
      return false;
    }
    if (filter.severities && !filter.severities.includes(alert.severity)) {
      return false;
    }
    if (filter.status && !filter.status.includes(alert.status)) {
      return false;
    }
    if (filter.timeRange) {
      const alertTime = new Date(alert.timestamp);
      if (alertTime < filter.timeRange.start || alertTime > filter.timeRange.end) {
        return false;
      }
    }
    return true;
  });
}

export function groupAlertsByService(alerts: Alert[]): Map<string, Alert[]> {
  const groups = new Map<string, Alert[]>();
  
  for (const alert of alerts) {
    const existing = groups.get(alert.service) ?? [];
    existing.push(alert);
    groups.set(alert.service, existing);
  }
  
  return groups;
}

export function groupAlertsBySource(alerts: Alert[]): Map<string, Alert[]> {
  const groups = new Map<string, Alert[]>();
  
  for (const alert of alerts) {
    const existing = groups.get(alert.source) ?? [];
    existing.push(alert);
    groups.set(alert.source, existing);
  }
  
  return groups;
}

// ============================================================================
// Correlation Engine
// ============================================================================

export interface CorrelationResult {
  groups: CorrelatedAlertGroup[];
  ungrouped: Alert[];
  stats: {
    total_alerts: number;
    grouped_alerts: number;
    total_groups: number;
    rules_triggered: string[];
  };
}

export function correlateAlerts(
  alerts: Alert[],
  rules: CorrelationRule[] = defaultCorrelationRules,
  profile?: Profile
): CorrelationResult {
  const minForCorrelation = profile?.config.thresholds.min_alerts_for_correlation ?? { warning: 3, critical: 2, enabled: true };
  const minAlerts = minForCorrelation.critical;
  
  const groups: CorrelatedAlertGroup[] = [];
  const groupedAlertIds = new Set<string>();
  const rulesTriggered = new Set<string>();
  
  // Sort alerts by timestamp
  const sortedAlerts = [...alerts].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  // Apply each rule
  for (const rule of rules) {
    if (!rule.enabled) continue;
    
    const ruleWindow = rule.time_window_minutes * 60 * 1000; // Convert to milliseconds
    const ruleGroups = new Map<string, Alert[]>();
    
    // Group alerts based on rule criteria
    for (const alert of sortedAlerts) {
      if (groupedAlertIds.has(alert.alert_id)) continue;
      
      let key: string;
      
      switch (rule.correlation_logic) {
        case 'same_service':
          key = alert.service;
          break;
        case 'same_metric':
          key = alert.metric ?? 'unknown';
          break;
        case 'common_source':
          key = alert.source;
          break;
        case 'custom':
        default:
          key = generateCorrelationKey(alert, rule);
      }
      
      if (key) {
        const existing = ruleGroups.get(key) ?? [];
        
        // Check time window
        if (existing.length > 0) {
          const lastAlert = existing[existing.length - 1];
          const timeDiff = new Date(alert.timestamp).getTime() - new Date(lastAlert.timestamp).getTime();
          
          if (timeDiff > ruleWindow) {
            // Start a new group for this key
            ruleGroups.set(key, [alert]);
          } else {
            existing.push(alert);
          }
        } else {
          existing.push(alert);
        }
        
        ruleGroups.set(key, existing);
      }
    }
    
    // Create groups that meet minimum threshold
    for (const groupAlerts of ruleGroups.values()) {
      if (groupAlerts.length >= (rule.min_alerts ?? minAlerts)) {
        const group = createCorrelatedGroup(groupAlerts, rule);
        groups.push(group);
        
        for (const alert of groupAlerts) {
          groupedAlertIds.add(alert.alert_id);
        }
        
        rulesTriggered.add(rule.rule_id);
      }
    }
  }
  
  // Identify ungrouped alerts
  const ungrouped = sortedAlerts.filter(a => !groupedAlertIds.has(a.alert_id));
  
  return {
    groups,
    ungrouped,
    stats: {
      total_alerts: alerts.length,
      grouped_alerts: groupedAlertIds.size,
      total_groups: groups.length,
      rules_triggered: Array.from(rulesTriggered),
    },
  };
}

function generateCorrelationKey(alert: Alert, rule: CorrelationRule): string {
  // Generate a correlation key based on rule match criteria
  const parts: string[] = [];
  
  for (const criterion of rule.match_criteria) {
    let value: string;
    
    switch (criterion.field) {
      case 'source':
        value = alert.source;
        break;
      case 'service':
        value = alert.service;
        break;
      case 'severity':
        value = alert.severity;
        break;
      case 'metric':
        value = alert.metric ?? 'unknown';
        break;
      case 'title':
        value = alert.title;
        break;
      default:
        value = 'unknown';
    }
    
    parts.push(`${criterion.field}:${value}`);
  }
  
  return parts.join('|');
}

function createCorrelatedGroup(
  alerts: Alert[],
  rule: CorrelationRule
): CorrelatedAlertGroup {
  const services = [...new Set(alerts.map(a => a.service))];
  const severities = alerts.map(a => a.severity);
  
  // Determine impact level
  let estimatedImpact: 'low' | 'medium' | 'high' | 'critical' = 'low';
  if (severities.includes('critical')) {
    estimatedImpact = 'critical';
  } else if (severities.includes('warning') && alerts.length > 5) {
    estimatedImpact = 'high';
  } else if (alerts.length > 3) {
    estimatedImpact = 'medium';
  }
  
  // Simple root cause analysis
  const { probableCause, confidence, contributingFactors } = analyzeRootCause(alerts, rule);
  
  return {
    group_id: generateId(),
    correlation_rule_id: rule.rule_id,
    alerts,
    root_cause_analysis: {
      probable_cause: probableCause,
      confidence,
      contributing_factors: contributingFactors,
    },
    blast_radius: {
      services_affected: services,
      estimated_impact: estimatedImpact,
    },
    created_at: new Date().toISOString(),
  };
}

function analyzeRootCause(
  alerts: Alert[],
  rule: CorrelationRule
): { probableCause: string; confidence: number; contributingFactors: string[] } {
  const metrics = [...new Set(alerts.map(a => a.metric).filter(Boolean))];
  const services = [...new Set(alerts.map(a => a.service))];
  
  let probableCause: string;
  let confidence = 0.7;
  const contributingFactors: string[] = [];
  
  // Pattern-based root cause analysis
  switch (rule.rule_id) {
    case 'same-service-multiple-metrics':
      probableCause = `Multiple infrastructure issues detected in ${services[0]} affecting ${metrics.join(', ')}`;
      confidence = 0.75;
      contributingFactors.push(`Service degradation in ${services[0]}`, 'Multiple metric breaches');
      break;
      
    case 'cascade-failure-pattern':
      probableCause = `Cascading failure detected across ${services.length} services`;
      confidence = 0.85;
      contributingFactors.push('Service dependency failure', 'Resource exhaustion likely', 'Chain reaction of alerts');
      break;
      
    case 'infrastructure-resource-exhaustion':
      probableCause = 'Resource exhaustion detected (CPU, memory, or disk)';
      confidence = 0.9;
      contributingFactors.push('High resource utilization', 'Possible capacity limit reached', 'Scale-up may be required');
      break;
      
    case 'deployment-related-issues':
      probableCause = 'Post-deployment issues detected';
      confidence = 0.8;
      contributingFactors.push('Recent deployment activity', 'New configuration issues possible', 'Rollback candidate');
      break;
      
    case 'database-connection-pool':
      probableCause = 'Database connection pool exhaustion';
      confidence = 0.88;
      contributingFactors.push('Connection pool limit reached', 'Connection leaks possible', 'Query optimization needed');
      break;
      
    default:
      probableCause = `Correlated alerts: ${alerts.length} alerts from ${services.length} services`;
      confidence = 0.65;
      contributingFactors.push(`${alerts.length} correlated alerts`, `Spanning ${services.length} services`);
  }
  
  return { probableCause, confidence, contributingFactors };
}

// ============================================================================
// Alert Correlation Output
// ============================================================================

export function createAlertCorrelation(
  tenantId: string,
  projectId: string,
  result: CorrelationResult,
  profileId: string = 'ops-base'
): AlertCorrelation {
  return {
    correlation_id: generateId(),
    tenant_id: tenantId,
    project_id: projectId,
    groups: result.groups,
    summary: {
      total_alerts: result.stats.total_alerts,
      total_groups: result.stats.total_groups,
      new_groups: result.groups.filter(g => !g.resolved_at).length,
      resolved_groups: result.groups.filter(g => g.resolved_at).length,
    },
    generated_at: new Date().toISOString(),
    profile_id: profileId,
  };
}

// ============================================================================
// Alert Utilities
// ============================================================================

export function validateAlert(alert: unknown): Alert {
  return AlertSchema.parse(alert);
}

export function validateAlerts(alerts: unknown[]): Alert[] {
  return alerts.map(a => validateAlert(a));
}

export function sortAlertsBySeverity(alerts: Alert[]): Alert[] {
  const severityOrder: Record<Severity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
    opportunity: 3,
  };
  
  return [...alerts].sort(
    (a, b) => severityOrder[a.severity as Severity] - severityOrder[b.severity as Severity]
  );
}

export function getCriticalAlerts(alerts: Alert[]): Alert[] {
  return alerts.filter(a => a.severity === 'critical');
}

export function getAlertsByService(alerts: Alert[], service: string): Alert[] {
  return alerts.filter(a => a.service === service);
}

export function calculateAlertMetrics(alerts: Alert[]): {
  total: number;
  by_severity: Record<Severity, number>;
  by_service: Record<string, number>;
  by_source: Record<string, number>;
} {
  const bySeverity: Record<Severity, number> = { critical: 0, warning: 0, info: 0, opportunity: 0 };
  const byService: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  
  for (const alert of alerts) {
    const severity = alert.severity as Severity;
    bySeverity[severity]++;
    byService[alert.service] = (byService[alert.service] ?? 0) + 1;
    bySource[alert.source] = (bySource[alert.source] ?? 0) + 1;
  }
  
  return {
    total: alerts.length,
    by_severity: bySeverity,
    by_service: byService,
    by_source: bySource,
  };
}
