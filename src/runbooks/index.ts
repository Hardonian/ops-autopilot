import {
  RunbookSchema,
  type Runbook,
  type RunbookStep,
  type CorrelatedAlertGroup,
  type Severity,
  generateId,
} from '../contracts/index.js';

/**
 * Runbook Generation
 * 
 * Generates incident response runbooks based on correlated alerts
 * and infrastructure patterns. All generated runbooks require
 * policy tokens and approval before execution.
 */

// ============================================================================
// Runbook Templates
// ============================================================================

interface RunbookTemplate {
  name: string;
  description: string;
  applicableTo: (alertGroup: CorrelatedAlertGroup) => boolean;
  generateSteps: (alertGroup: CorrelatedAlertGroup) => RunbookStep[];
  estimatedDurationMinutes: number;
  prerequisites: string[];
  postConditions: string[];
}

const runbookTemplates: RunbookTemplate[] = [
  {
    name: 'Service Degradation Response',
    description: 'Respond to degraded service performance across multiple metrics',
    applicableTo: (group) => 
      group.root_cause_analysis.probable_cause.includes('degradation') ||
      group.alerts.some(a => a.title.includes('degradation')),
    generateSteps: () => [
      {
        step_number: 1,
        title: 'Assess Service Health',
        description: 'Check service health dashboard and current error rates',
        command: 'kubectl get pods -l app={{service}}',
        expected_output: 'Running pods with status',
        verification: 'All critical pods are running',
        requires_approval: false,
        automated: false,
      },
      {
        step_number: 2,
        title: 'Review Recent Deployments',
        description: 'Check for recent deployments that may have caused issues',
        command: 'helm history {{service}} -n production',
        expected_output: 'Deployment history',
        verification: 'Identify recent changes',
        rollback_step: 5,
        requires_approval: false,
        automated: true,
      },
      {
        step_number: 3,
        title: 'Check Resource Utilization',
        description: 'Verify CPU, memory, and disk usage',
        command: 'kubectl top pods -l app={{service}}',
        expected_output: 'Resource metrics',
        verification: 'Resources within normal limits',
        requires_approval: false,
        automated: true,
      },
      {
        step_number: 4,
        title: 'Scale Service if Needed',
        description: 'Increase replica count to handle load',
        command: 'kubectl scale deployment {{service}} --replicas={{target_replicas}}',
        expected_output: 'Scaled',
        verification: 'New pods are ready',
        requires_approval: true,
        automated: false,
      },
      {
        step_number: 5,
        title: 'Rollback (if deployment issue)',
        description: 'Rollback to previous stable version',
        command: 'helm rollback {{service}} {{revision}} -n production',
        expected_output: 'Rollback successful',
        verification: 'Service recovered',
        requires_approval: true,
        automated: false,
      },
    ],
    estimatedDurationMinutes: 30,
    prerequisites: ['kubectl access', 'Helm access', 'Service access'],
    postConditions: ['Service health restored', 'Error rates normalized'],
  },
  {
    name: 'Cascade Failure Recovery',
    description: 'Recover from cascading failures across multiple services',
    applicableTo: (group) => 
      group.root_cause_analysis.probable_cause.includes('cascading') ||
      group.blast_radius.services_affected.length > 2,
    generateSteps: (group) => [
      {
        step_number: 1,
        title: 'Identify Root Cause Service',
        description: `Determine the originating service from ${group.blast_radius.services_affected.join(', ')}`,
        command: 'kubectl get events --sort-by=.lastTimestamp | grep -i error',
        expected_output: 'Event log with errors',
        verification: 'Root cause service identified',
        requires_approval: false,
        automated: false,
      },
      {
        step_number: 2,
        title: 'Isolate Affected Services',
        description: 'Circuit break downstream services to prevent further cascade',
        command: 'curl -X POST {{circuit_breaker_endpoint}}/break -d "service={{service}}"',
        expected_output: '200 OK',
        verification: 'Circuit breaker activated',
        requires_approval: true,
        automated: false,
      },
      {
        step_number: 3,
        title: 'Restart Root Service',
        description: 'Restart the root cause service pods',
        command: 'kubectl rollout restart deployment {{root_service}} -n production',
        expected_output: 'Restart initiated',
        verification: 'Pods restarting',
        requires_approval: true,
        automated: true,
      },
      {
        step_number: 4,
        title: 'Verify Recovery',
        description: 'Monitor service recovery in sequence',
        command: 'watch -n 5 "kubectl get pods -n production | grep {{services}}"',
        expected_output: 'All pods running',
        verification: 'Services healthy',
        requires_approval: false,
        automated: false,
      },
      {
        step_number: 5,
        title: 'Restore Circuit Breakers',
        description: 'Gradually restore service connectivity',
        command: 'curl -X POST {{circuit_breaker_endpoint}}/restore -d "service={{service}}"',
        expected_output: '200 OK',
        verification: 'Full service mesh restored',
        rollback_step: 2,
        requires_approval: true,
        automated: false,
      },
    ],
    estimatedDurationMinutes: 45,
    prerequisites: ['kubectl access', 'Circuit breaker API access', 'Multi-service visibility'],
    postConditions: ['All services healthy', 'No cascading alerts', 'Circuit breakers reset'],
  },
  {
    name: 'Resource Exhaustion Resolution',
    description: 'Address CPU, memory, or disk resource exhaustion',
    applicableTo: (group) =>
      group.root_cause_analysis.probable_cause.includes('Resource exhaustion') ||
      group.alerts.some(a => a.metric?.includes('cpu') || a.metric?.includes('memory') || a.metric?.includes('disk')),
    generateSteps: () => [
      {
        step_number: 1,
        title: 'Identify Resource Type',
        description: 'Determine which resource is exhausted',
        command: 'kubectl describe node {{node}}',
        expected_output: 'Node resource details',
        verification: 'Resource type identified',
        requires_approval: false,
        automated: true,
      },
      {
        step_number: 2,
        title: 'Check Resource Limits',
        description: 'Review pod resource requests and limits',
        command: 'kubectl get pods -o yaml | grep -A 5 resources',
        expected_output: 'Resource configurations',
        verification: 'Limits reviewed',
        requires_approval: false,
        automated: true,
      },
      {
        step_number: 3,
        title: 'Increase Resource Allocation',
        description: 'Update deployment with higher resource limits',
        command: 'kubectl set resources deployment {{service}} --limits=cpu={{new_cpu}},memory={{new_memory}}',
        expected_output: 'Resources updated',
        verification: 'New limits applied',
        requires_approval: true,
        automated: false,
      },
      {
        step_number: 4,
        title: 'Add Node Capacity',
        description: 'Scale node pool if cluster-wide issue',
        command: 'kubectl scale node-pool {{pool}} --nodes={{target_nodes}}',
        expected_output: 'Node pool scaling',
        verification: 'New nodes available',
        rollback_step: 5,
        requires_approval: true,
        automated: false,
      },
      {
        step_number: 5,
        title: 'Optimize Workloads',
        description: 'Review and optimize resource-intensive workloads',
        command: 'kubectl top pods --all-namespaces | sort -k3 -n -r | head -20',
        expected_output: 'Top resource consumers',
        verification: 'Optimization targets identified',
        requires_approval: false,
        automated: false,
      },
    ],
    estimatedDurationMinutes: 60,
    prerequisites: ['kubectl access', 'Node scaling permissions', 'Deployment update access'],
    postConditions: ['Resource utilization below 80%', 'No resource alerts', 'Performance normalized'],
  },
  {
    name: 'Database Connection Pool Recovery',
    description: 'Resolve database connection pool exhaustion issues',
    applicableTo: (group) =>
      group.root_cause_analysis.probable_cause.includes('connection pool') ||
      group.alerts.some(a => a.metric?.includes('connection') || a.title.includes('connection')),
    generateSteps: () => [
      {
        step_number: 1,
        title: 'Check Current Connections',
        description: 'View current database connection status',
        command: 'psql -c "SELECT count(*) FROM pg_stat_activity;"',
        expected_output: 'Connection count',
        verification: 'Current load assessed',
        requires_approval: false,
        automated: true,
      },
      {
        step_number: 2,
        title: 'Identify Idle Connections',
        description: 'Find and close idle connections',
        command: 'psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = \'idle\' AND state_change < now() - interval \'5 minutes\';"',
        expected_output: 'Terminated connections',
        verification: 'Idle connections closed',
        requires_approval: true,
        automated: true,
      },
      {
        step_number: 3,
        title: 'Increase Pool Size',
        description: 'Temporarily increase connection pool size',
        command: 'kubectl set env deployment/{{service}} DB_POOL_SIZE={{new_pool_size}}',
        expected_output: 'Environment updated',
        verification: 'Pool size increased',
        requires_approval: true,
        automated: false,
      },
      {
        step_number: 4,
        title: 'Review Connection Leaks',
        description: 'Analyze application for connection leaks',
        command: 'grep -r "getConnection" /var/log/app/ | grep -v "close" | wc -l',
        expected_output: 'Potential leak count',
        verification: 'Leak sources identified',
        requires_approval: false,
        automated: true,
      },
      {
        step_number: 5,
        title: 'Restart Application Pods',
        description: 'Restart to clear stuck connections',
        command: 'kubectl rollout restart deployment {{service}}',
        expected_output: 'Restart initiated',
        verification: 'Fresh connections established',
        rollback_step: 3,
        requires_approval: true,
        automated: true,
      },
    ],
    estimatedDurationMinutes: 25,
    prerequisites: ['Database access', 'kubectl access', 'Application deployment access'],
    postConditions: ['Connection pool healthy', 'No waiting connections', 'Query performance normal'],
  },
  {
    name: 'Post-Deployment Incident Response',
    description: 'Handle issues following a deployment',
    applicableTo: (group) =>
      group.root_cause_analysis.probable_cause.includes('deployment'),
    generateSteps: () => [
      {
        step_number: 1,
        title: 'Verify Deployment Status',
        description: 'Check if deployment completed successfully',
        command: 'kubectl rollout status deployment {{service}}',
        expected_output: 'Successfully rolled out',
        verification: 'Deployment status confirmed',
        requires_approval: false,
        automated: true,
      },
      {
        step_number: 2,
        title: 'Review Deployment Logs',
        description: 'Check for deployment errors',
        command: 'kubectl logs deployment/{{service}} --tail=100 | grep -i error',
        expected_output: 'Error log entries',
        verification: 'Issues identified',
        requires_approval: false,
        automated: true,
      },
      {
        step_number: 3,
        title: 'Check Configuration Changes',
        description: 'Review configmap and secret changes',
        command: 'kubectl get configmap {{service}}-config -o yaml | diff - previous_config.yaml',
        expected_output: 'Configuration diff',
        verification: 'Config changes reviewed',
        requires_approval: false,
        automated: true,
      },
      {
        step_number: 4,
        title: 'Rollback Deployment',
        description: 'Revert to previous stable version',
        command: 'kubectl rollout undo deployment/{{service}}',
        expected_output: 'Rolled back',
        verification: 'Previous version active',
        requires_approval: true,
        automated: false,
      },
      {
        step_number: 5,
        title: 'Verify Rollback Success',
        description: 'Confirm service health after rollback',
        command: 'kubectl get pods -l app={{service}} && curl -f http://{{service}}/health',
        expected_output: 'Healthy pods, 200 OK',
        verification: 'Service fully recovered',
        requires_approval: false,
        automated: true,
      },
    ],
    estimatedDurationMinutes: 20,
    prerequisites: ['kubectl access', 'Previous deployment revision known', 'Health endpoint available'],
    postConditions: ['Deployment rolled back', 'Service stable', 'Error rates normal'],
  },
];

// ============================================================================
// Runbook Generation Functions
// ============================================================================

export function generateRunbook(
  alertGroup: CorrelatedAlertGroup,
  options?: {
    includeAutomation?: boolean;
    includeRollback?: boolean;
    customSteps?: RunbookStep[];
  }
): Runbook {
  // Find matching template
  const template = runbookTemplates.find(t => t.applicableTo(alertGroup));
  
  if (!template) {
    return generateGenericRunbook(alertGroup, options);
  }
  
  const steps = template.generateSteps(alertGroup);
  
  // Apply options
  let finalSteps = steps;
  if (options?.includeRollback === false) {
    finalSteps = steps.filter(s => s.step_number !== s.rollback_step);
  }
  if (options?.customSteps) {
    finalSteps = [...finalSteps, ...options.customSteps];
  }
  
  // Re-number steps
  finalSteps = finalSteps.map((step, index) => ({
    ...step,
    step_number: index + 1,
    automated: options?.includeAutomation ? step.automated : false,
  }));
  
  const severity = determineSeverity(alertGroup);
  const tenantId = alertGroup.alerts[0]?.tenant_id ?? 'default';
  const projectId = alertGroup.alerts[0]?.project_id ?? 'default';
  
  return {
    runbook_id: generateId(),
    tenant_id: tenantId,
    project_id: projectId,
    name: template.name,
    description: `${template.description}\n\nGenerated for alert group: ${alertGroup.group_id}`,
    trigger_conditions: alertGroup.alerts.map(a => ({
      alert_source: a.source,
      alert_title_pattern: a.title,
      service: a.service,
      metric: a.metric,
    })),
    severity,
    estimated_duration_minutes: template.estimatedDurationMinutes,
    steps: finalSteps,
    prerequisites: template.prerequisites,
    post_conditions: template.postConditions,
    rollback_procedure: finalSteps.some(s => s.rollback_step)
      ? 'Execute rollback steps indicated in the procedure'
      : undefined,
    related_runbooks: findRelatedRunbooks(alertGroup),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    version: '1.0.0',
    generated_by: 'ai',
  };
}

function generateGenericRunbook(
  alertGroup: CorrelatedAlertGroup,
  options?: {
    includeAutomation?: boolean;
    includeRollback?: boolean;
  }
): Runbook {
  const services = [...new Set(alertGroup.alerts.map(a => a.service))];
  const severity = determineSeverity(alertGroup);
  const tenantId = alertGroup.alerts[0]?.tenant_id ?? 'default';
  const projectId = alertGroup.alerts[0]?.project_id ?? 'default';
  
  const steps: RunbookStep[] = [
    {
      step_number: 1,
      title: 'Acknowledge Alert Group',
      description: `Acknowledge ${alertGroup.alerts.length} correlated alerts affecting ${services.join(', ')}`,
      verification: 'All alerts acknowledged in incident management system',
      requires_approval: false,
      automated: false,
    },
    {
      step_number: 2,
      title: 'Assess Impact',
      description: `Evaluate impact level: ${alertGroup.blast_radius.estimated_impact}. Services affected: ${services.join(', ')}`,
      verification: 'Impact assessment complete',
      requires_approval: false,
      automated: false,
    },
    {
      step_number: 3,
      title: 'Investigate Root Cause',
      description: alertGroup.root_cause_analysis.probable_cause,
      verification: 'Root cause confirmed',
      requires_approval: false,
      automated: false,
    },
    {
      step_number: 4,
      title: 'Execute Remediation',
      description: 'Apply appropriate fixes based on root cause analysis',
      verification: 'Issues resolved',
      requires_approval: true,
      automated: false,
    },
    {
      step_number: 5,
      title: 'Verify Recovery',
      description: 'Confirm all services are healthy and metrics are normal',
      verification: 'All checks passing',
      requires_approval: false,
      automated: options?.includeAutomation ?? false,
    },
    {
      step_number: 6,
      title: 'Close Alert Group',
      description: 'Resolve all correlated alerts',
      verification: 'All alerts resolved',
      requires_approval: false,
      automated: false,
    },
  ];
  
  return {
    runbook_id: generateId(),
    tenant_id: tenantId,
    project_id: projectId,
    name: 'Generic Incident Response',
    description: `Automated runbook for ${alertGroup.alerts.length} correlated alerts. Root cause: ${alertGroup.root_cause_analysis.probable_cause}`,
    trigger_conditions: alertGroup.alerts.map(a => ({
      alert_source: a.source,
      service: a.service,
    })),
    severity,
    estimated_duration_minutes: 45,
    steps,
    prerequisites: ['Incident management access', 'Service monitoring access'],
    post_conditions: ['All alerts resolved', 'Services healthy', 'Root cause documented'],
    related_runbooks: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    version: '1.0.0',
    generated_by: 'ai',
  };
}

function determineSeverity(alertGroup: CorrelatedAlertGroup): Severity {
  if (alertGroup.blast_radius.estimated_impact === 'critical') {
    return 'critical';
  }
  if (alertGroup.alerts.some(a => a.severity === 'critical')) {
    return 'critical';
  }
  if (alertGroup.blast_radius.estimated_impact === 'high') {
    return 'warning';
  }
  if (alertGroup.alerts.some(a => a.severity === 'warning')) {
    return 'warning';
  }
  return 'info';
}

function findRelatedRunbooks(alertGroup: CorrelatedAlertGroup): string[] {
  // In a real implementation, this would query a runbook database
  // For now, return template names that might be related
  const related: string[] = [];
  
  const services = alertGroup.blast_radius.services_affected;
  
  if (services.length > 2) {
    related.push('Cascade Failure Recovery');
  }
  
  if (alertGroup.alerts.some(a => a.metric?.includes('cpu') || a.metric?.includes('memory'))) {
    related.push('Resource Exhaustion Resolution');
  }
  
  return related;
}

// ============================================================================
// Runbook Utilities
// ============================================================================

export function validateRunbook(runbook: unknown): Runbook {
  return RunbookSchema.parse(runbook);
}

export function getAutomatedSteps(runbook: Runbook): RunbookStep[] {
  return runbook.steps.filter(s => s.automated);
}

export function getManualSteps(runbook: Runbook): RunbookStep[] {
  return runbook.steps.filter(s => !s.automated);
}

export function getStepsRequiringApproval(runbook: Runbook): RunbookStep[] {
  return runbook.steps.filter(s => s.requires_approval);
}

export function calculateRunbookProgress(
  runbook: Runbook,
  completedSteps: number[]
): { percent: number; remaining: number } {
  const total = runbook.steps.length;
  const completed = completedSteps.length;
  
  return {
    percent: Math.round((completed / total) * 100),
    remaining: total - completed,
  };
}

export function serializeRunbook(runbook: Runbook): string {
  return JSON.stringify(runbook, null, 2);
}
