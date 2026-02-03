export interface Threshold {
  warning: number;
  critical: number;
  enabled: boolean;
}

export interface ProfileConfig {
  thresholds: Record<string, Threshold>;
  features: Record<string, boolean>;
  weights: Record<string, number>;
  custom: Record<string, number | string | boolean>;
}

export interface Profile {
  id: string;
  name: string;
  description: string;
  config: ProfileConfig;
  metadata: Record<string, unknown>;
}

/**
 * Ops Autopilot Profiles
 *
 * Extends base profiles with ops-specific configurations for infrastructure
 * monitoring, alert correlation, and reliability analysis.
 */

// ============================================================================
// Ops-Specific Thresholds
// ============================================================================

export interface OpsThresholds {
  // Alert thresholds
  alert_correlation_window_minutes: { warning: number; critical: number };
  error_rate_spike: { warning: number; critical: number };
  latency_p95_spike: { warning: number; critical: number };
  memory_usage_threshold: { warning: number; critical: number };
  cpu_usage_threshold: { warning: number; critical: number };
  disk_usage_threshold: { warning: number; critical: number };

  // Correlation thresholds
  min_alerts_for_correlation: { warning: number; critical: number };
  correlation_confidence_threshold: { warning: number; critical: number };

  // Reliability thresholds
  availability_threshold_percent: { warning: number; critical: number };
  mttr_target_minutes: { warning: number; critical: number };
  mtbf_target_hours: { warning: number; critical: number };
}

// ============================================================================
// Base Profile + Helpers
// ============================================================================

export const baseProfile: Profile = {
  id: 'base',
  name: 'Base Ops Profile',
  description: 'Baseline ops configuration for infrastructure monitoring',
  config: {
    thresholds: {
      alert_correlation_window_minutes: { warning: 10, critical: 5, enabled: true },
      error_rate_spike: { warning: 2.0, critical: 5.0, enabled: true },
      latency_p95_spike: { warning: 1.5, critical: 3.0, enabled: true },
      memory_usage_threshold: { warning: 80, critical: 95, enabled: true },
      cpu_usage_threshold: { warning: 70, critical: 90, enabled: true },
      disk_usage_threshold: { warning: 80, critical: 95, enabled: true },
      min_alerts_for_correlation: { warning: 3, critical: 2, enabled: true },
      correlation_confidence_threshold: { warning: 0.6, critical: 0.8, enabled: true },
      availability_threshold_percent: { warning: 99.0, critical: 99.9, enabled: true },
      mttr_target_minutes: { warning: 60, critical: 15, enabled: true },
      mtbf_target_hours: { warning: 168, critical: 720, enabled: true },
    },
    features: {
      auto_redact: true,
      include_evidence: true,
      generate_job_requests: true,
      require_approval: true,
      enable_alert_correlation: true,
      enable_runbook_generation: true,
      enable_anomaly_detection: true,
      enable_predictive_alerts: false,
      include_historical_context: true,
    },
    weights: {
      severity_weight: 1.0,
      blast_radius: 0.8,
      service_criticality: 0.9,
      historical_frequency: 0.6,
      customer_impact: 0.7,
      temporal_proximity: 0.8,
      service_dependency: 0.9,
      metric_correlation: 0.7,
    },
    custom: {
      default_time_window_hours: 24,
      max_alerts_per_correlation: 50,
      runbook_max_steps: 20,
      anomaly_lookback_days: 30,
      incident_retention_days: 90,
    },
  },
  metadata: {
    version: '1.0.0',
    module: 'ops',
  },
};

export function mergeProfileWithOverlay(
  base: Profile,
  overlay: Partial<ProfileConfig>,
  id: string
): Profile {
  return {
    ...base,
    id,
    config: {
      thresholds: { ...base.config.thresholds, ...overlay.thresholds },
      features: { ...base.config.features, ...overlay.features },
      weights: { ...base.config.weights, ...overlay.weights },
      custom: { ...base.config.custom, ...overlay.custom },
    },
  };
}

export function getThreshold(
  profile: Profile,
  metric: string,
  level: 'warning' | 'critical'
): number | undefined {
  const threshold = profile.config.thresholds[metric];
  if (!threshold?.enabled) {
    return undefined;
  }
  return threshold[level];
}

export function exceedsThreshold(
  profile: Profile,
  metric: string,
  value: number
): { exceeded: boolean; level?: 'warning' | 'critical' } {
  const threshold = profile.config.thresholds[metric];
  if (!threshold?.enabled) {
    return { exceeded: false };
  }

  if (value >= threshold.critical) {
    return { exceeded: true, level: 'critical' };
  }
  if (value >= threshold.warning) {
    return { exceeded: true, level: 'warning' };
  }
  return { exceeded: false };
}

export function validateProfile(profile: Profile): { valid: boolean; errors?: string[] } {
  if (!profile.id || !profile.name || !profile.config) {
    return { valid: false, errors: ['Missing required profile fields'] };
  }
  return { valid: true };
}

export function serializeProfile(profile: Profile): string {
  return JSON.stringify(profile, null, 2);
}

// ============================================================================
// Base Ops Profile Overlay
// ============================================================================

const opsBaseOverlay: Partial<ProfileConfig> = {
  thresholds: {
    // Alert correlation
    alert_correlation_window_minutes: { warning: 10, critical: 5, enabled: true },
    error_rate_spike: { warning: 2.0, critical: 5.0, enabled: true },
    latency_p95_spike: { warning: 1.5, critical: 3.0, enabled: true },

    // Resource usage
    memory_usage_threshold: { warning: 80, critical: 95, enabled: true },
    cpu_usage_threshold: { warning: 70, critical: 90, enabled: true },
    disk_usage_threshold: { warning: 80, critical: 95, enabled: true },

    // Correlation
    min_alerts_for_correlation: { warning: 3, critical: 2, enabled: true },
    correlation_confidence_threshold: { warning: 0.6, critical: 0.8, enabled: true },

    // Reliability
    availability_threshold_percent: { warning: 99.0, critical: 99.9, enabled: true },
    mttr_target_minutes: { warning: 60, critical: 15, enabled: true },
    mtbf_target_hours: { warning: 168, critical: 720, enabled: true },
  },
  features: {
    auto_redact: true,
    include_evidence: true,
    generate_job_requests: true,
    require_approval: true,
    enable_alert_correlation: true,
    enable_runbook_generation: true,
    enable_anomaly_detection: true,
    enable_predictive_alerts: false,
    include_historical_context: true,
  },
  weights: {
    severity_weight: 1.0,
    blast_radius: 0.8,
    service_criticality: 0.9,
    historical_frequency: 0.6,
    customer_impact: 0.7,

    // Correlation weights
    temporal_proximity: 0.8,
    service_dependency: 0.9,
    metric_correlation: 0.7,
  },
  custom: {
    default_time_window_hours: 24,
    max_alerts_per_correlation: 50,
    runbook_max_steps: 20,
    anomaly_lookback_days: 30,
    incident_retention_days: 90,
  },
};

// ============================================================================
// Per-Service Overlays
// ============================================================================

const jobforgeOpsOverlay: Partial<ProfileConfig> = {
  thresholds: {
    alert_correlation_window_minutes: { warning: 5, critical: 2, enabled: true },
    error_rate_spike: { warning: 1.5, critical: 3.0, enabled: true },
    latency_p95_spike: { warning: 1.3, critical: 2.5, enabled: true },
    memory_usage_threshold: { warning: 75, critical: 90, enabled: true },
    availability_threshold_percent: { warning: 99.5, critical: 99.95, enabled: true },
  },
  features: {
    auto_redact: true,
    include_evidence: true,
    generate_job_requests: true,
    require_approval: true,
    enable_alert_correlation: true,
    enable_runbook_generation: true,
    enable_anomaly_detection: true,
    enable_predictive_alerts: true,
    include_historical_context: true,
  },
  weights: {
    severity_weight: 1.2,
    blast_radius: 1.0,
    service_criticality: 1.1,
  },
  custom: {
    default_time_window_hours: 12,
    max_alerts_per_correlation: 30,
  },
};

const settlerOpsOverlay: Partial<ProfileConfig> = {
  thresholds: {
    alert_correlation_window_minutes: { warning: 3, critical: 1, enabled: true },
    error_rate_spike: { warning: 1.0, critical: 2.5, enabled: true },
    payment_failure_rate: { warning: 0.08, critical: 0.15, enabled: true },
    latency_p95_spike: { warning: 1.2, critical: 2.0, enabled: true },
    availability_threshold_percent: { warning: 99.9, critical: 99.99, enabled: true },
  },
  features: {
    auto_redact: true,
    include_evidence: true,
    generate_job_requests: true,
    require_approval: true,
    enable_alert_correlation: true,
    enable_runbook_generation: true,
    enable_anomaly_detection: true,
    enable_predictive_alerts: true,
    include_historical_context: true,
  },
  weights: {
    severity_weight: 1.3,
    customer_impact: 1.2,
    service_criticality: 1.2,
  },
  custom: {
    default_time_window_hours: 6,
    max_alerts_per_correlation: 20,
  },
};

const readylayerOpsOverlay: Partial<ProfileConfig> = {
  thresholds: {
    alert_correlation_window_minutes: { warning: 5, critical: 2, enabled: true },
    error_rate_spike: { warning: 1.5, critical: 4.0, enabled: true },
    memory_usage_threshold: { warning: 70, critical: 85, enabled: true },
  },
  features: {
    auto_redact: true,
    include_evidence: true,
    generate_job_requests: true,
    require_approval: true,
    enable_alert_correlation: true,
    enable_runbook_generation: true,
    enable_anomaly_detection: true,
    enable_predictive_alerts: false,
    include_historical_context: true,
  },
  weights: {
    service_criticality: 1.0,
    historical_frequency: 0.8,
  },
};

const aiasOpsOverlay: Partial<ProfileConfig> = {
  thresholds: {
    alert_correlation_window_minutes: { warning: 8, critical: 4, enabled: true },
    error_rate_spike: { warning: 1.8, critical: 4.5, enabled: true },
    latency_p95_spike: { warning: 1.5, critical: 3.0, enabled: true },
  },
  features: {
    auto_redact: true,
    include_evidence: true,
    generate_job_requests: true,
    require_approval: true,
    enable_alert_correlation: true,
    enable_runbook_generation: true,
    enable_anomaly_detection: true,
    enable_predictive_alerts: false,
    include_historical_context: true,
  },
  weights: {
    customer_impact: 0.9,
    service_criticality: 1.1,
  },
};

const keysOpsOverlay: Partial<ProfileConfig> = {
  thresholds: {
    alert_correlation_window_minutes: { warning: 5, critical: 2, enabled: true },
    error_rate_spike: { warning: 1.3, critical: 3.5, enabled: true },
    availability_threshold_percent: { warning: 99.8, critical: 99.98, enabled: true },
  },
  features: {
    auto_redact: true,
    include_evidence: true,
    generate_job_requests: true,
    require_approval: true,
    enable_alert_correlation: true,
    enable_runbook_generation: true,
    enable_anomaly_detection: true,
    enable_predictive_alerts: true,
    include_historical_context: true,
  },
  weights: {
    severity_weight: 1.2,
    customer_impact: 1.1,
  },
};

// ============================================================================
// Pre-built Ops Profiles
// ============================================================================

export function createOpsBaseProfile(): Profile {
  return mergeProfileWithOverlay(
    { ...baseProfile, metadata: { ...baseProfile.metadata, module: 'ops' } },
    opsBaseOverlay,
    'base-ops-base'
  );
}

export function createJobforgeOpsProfile(): Profile {
  const baseOps = createOpsBaseProfile();
  return mergeProfileWithOverlay(baseOps, jobforgeOpsOverlay, 'jobforge-ops');
}

export function createSettlerOpsProfile(): Profile {
  const baseOps = createOpsBaseProfile();
  return mergeProfileWithOverlay(baseOps, settlerOpsOverlay, 'settler-ops');
}

export function createReadyLayerOpsProfile(): Profile {
  const baseOps = createOpsBaseProfile();
  return mergeProfileWithOverlay(baseOps, readylayerOpsOverlay, 'readylayer-ops');
}

export function createAIASOpsProfile(): Profile {
  const baseOps = createOpsBaseProfile();
  return mergeProfileWithOverlay(baseOps, aiasOpsOverlay, 'aias-ops');
}

export function createKeysOpsProfile(): Profile {
  const baseOps = createOpsBaseProfile();
  return mergeProfileWithOverlay(baseOps, keysOpsOverlay, 'keys-ops');
}

// ============================================================================
// Profile Management
// ============================================================================

export function getOpsProfile(id: string): Profile | undefined {
  const profiles: Record<string, Profile> = {
    'ops-base': createOpsBaseProfile(),
    'ops-jobforge': createJobforgeOpsProfile(),
    'ops-settler': createSettlerOpsProfile(),
    'ops-readylayer': createReadyLayerOpsProfile(),
    'ops-aias': createAIASOpsProfile(),
    'ops-keys': createKeysOpsProfile(),
    // Also support base profile IDs
    base: baseProfile,
    jobforge: createJobforgeOpsProfile(),
    settler: createSettlerOpsProfile(),
    readylayer: createReadyLayerOpsProfile(),
    aias: createAIASOpsProfile(),
    keys: createKeysOpsProfile(),
  };

  return profiles[id];
}

export function listOpsProfiles(): Profile[] {
  return [
    createOpsBaseProfile(),
    createJobforgeOpsProfile(),
    createSettlerOpsProfile(),
    createReadyLayerOpsProfile(),
    createAIASOpsProfile(),
    createKeysOpsProfile(),
  ];
}

export function getProfile(id: string): Profile | undefined {
  return getOpsProfile(id);
}

export function listProfiles(): Profile[] {
  return listOpsProfiles();
}

// ============================================================================
// Threshold Helpers
// ============================================================================

export function getOpsThreshold(
  profile: Profile,
  metric: keyof OpsThresholds,
  level: 'warning' | 'critical'
): number | undefined {
  return getThreshold(profile, metric, level);
}

export function checkOpsThreshold(
  profile: Profile,
  metric: keyof OpsThresholds,
  value: number
): { exceeded: boolean; level?: 'warning' | 'critical' } {
  return exceedsThreshold(profile, metric as string, value);
}
