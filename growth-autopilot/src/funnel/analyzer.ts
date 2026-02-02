import * as fs from 'fs/promises';
import type {
  FunnelMetrics,
  FunnelStage,
  TenantContext,
  Evidence,
} from '../contracts/index.js';
import { FunnelMetricsSchema } from '../contracts/index.js';
import { now, deepClone } from '../utils/index.js';

/**
 * Event data structure for funnel analysis
 */
export interface FunnelEvent {
  user_id: string;
  event_name: string;
  timestamp: string;
  properties?: Record<string, unknown>;
}

/**
 * Funnel configuration
 */
export interface FunnelConfig {
  tenant_context: TenantContext;
  funnel_name: string;
  stages: string[]; // Ordered list of event names representing funnel stages
  time_window_days?: number;
}

/**
 * Analyze event data to compute funnel metrics
 * Pure deterministic analysis - no LLM required
 */
export async function analyzeFunnel(
  events: FunnelEvent[],
  config: FunnelConfig
): Promise<FunnelMetrics> {
  // Validate we have events
  if (events.length === 0) {
    throw new Error('No events provided for funnel analysis');
  }

  // Calculate time window
  const timestamps = events.map((e) => new Date(e.timestamp).getTime());
  const minTime = Math.min(...timestamps);
  const maxTime = Math.max(...timestamps);

  // Group events by user
  const userEvents = groupEventsByUser(events);

  // Calculate funnel stages
  const stages = calculateFunnelStages(
    userEvents,
    config.stages,
    maxTime
  );

  // Find biggest drop-off
  let biggestDropOffStage: string | null = null;
  let biggestDropOffRate: number | null = null;

  for (const stage of stages) {
    if (stage.drop_off_rate > (biggestDropOffRate ?? 0)) {
      biggestDropOffStage = stage.name;
      biggestDropOffRate = stage.drop_off_rate;
    }
  }

  // Calculate overall conversion
  const totalUsersEntered = stages[0]?.unique_users ?? 0;
  const totalUsersCompleted = stages[stages.length - 1]?.unique_users ?? 0;
  const overallConversionRate =
    totalUsersEntered > 0
      ? (totalUsersCompleted / totalUsersEntered) * 100
      : 0;

  // Build evidence
  const evidence: Evidence[] = [
    {
      signal: 'funnel_stage_dropoff',
      location: `stage:${biggestDropOffStage ?? 'none'}`,
      severity: biggestDropOffRate && biggestDropOffRate > 50 ? 'critical' : 'warning',
      raw_value: biggestDropOffRate,
    },
    {
      signal: 'time_window',
      location: 'analysis_period',
      severity: 'info',
      raw_value: {
        start: new Date(minTime).toISOString(),
        end: new Date(maxTime).toISOString(),
        days: Math.round((maxTime - minTime) / (1000 * 60 * 60 * 24)),
      },
    },
  ];

  // Build metrics
  const metrics: FunnelMetrics = {
    tenant_context: config.tenant_context,
    computed_at: now(),
    funnel_name: config.funnel_name,
    stages,
    overall_conversion_rate: Math.round(overallConversionRate * 100) / 100,
    total_users_entered: totalUsersEntered,
    total_users_completed: totalUsersCompleted,
    biggest_drop_off_stage: biggestDropOffStage,
    biggest_drop_off_rate: biggestDropOffRate
      ? Math.round(biggestDropOffRate * 100) / 100
      : null,
    time_window: {
      start: new Date(minTime).toISOString(),
      end: new Date(maxTime).toISOString(),
    },
    evidence,
  };

  // Validate output
  const validated = FunnelMetricsSchema.parse(metrics);
  return validated;
}

/**
 * Load events from JSON file
 */
export async function loadEventsFromFile(filePath: string): Promise<FunnelEvent[]> {
  const content = await fs.readFile(filePath, 'utf-8');
  const data = JSON.parse(content);

  if (!Array.isArray(data)) {
    throw new Error('Events file must contain an array of events');
  }

  return data as FunnelEvent[];
}

/**
 * Group events by user ID
 */
function groupEventsByUser(
  events: FunnelEvent[]
): Map<string, FunnelEvent[]> {
  const userEvents = new Map<string, FunnelEvent[]>();

  for (const event of events) {
    const userId = event.user_id;
    if (!userEvents.has(userId)) {
      userEvents.set(userId, []);
    }
    userEvents.get(userId)?.push(event);
  }

  // Sort each user's events by timestamp
  for (const [, userEventList] of userEvents) {
    userEventList.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  return userEvents;
}

/**
 * Calculate funnel stages from user events
 */
function calculateFunnelStages(
  userEvents: Map<string, FunnelEvent[]>,
  stageNames: string[],
  maxTimestamp: number
): FunnelStage[] {
  const stages: FunnelStage[] = [];
  let previousStageUsers = new Set<string>();

  for (let i = 0; i < stageNames.length; i++) {
    const stageName = stageNames[i];
    const eventName = stageName;

    // Find users who reached this stage
    const stageUsers = new Map<
      string,
      { firstEvent: FunnelEvent; allEvents: FunnelEvent[] }
    >();

    for (const [userId, events] of userEvents) {
      const stageEvents = events.filter((e) => e.event_name === eventName);
      if (stageEvents.length > 0) {
        // Use first occurrence for timing
        stageUsers.set(userId, {
          firstEvent: stageEvents[0],
          allEvents: stageEvents,
        });
      }
    }

    // Calculate metrics
    const uniqueUsers = stageUsers.size;
    const totalEvents = Array.from(stageUsers.values()).reduce(
      (sum, u) => sum + u.allEvents.length,
      0
    );

    // Calculate conversion from previous stage
    let conversionRateFromPrevious: number | null = null;
    if (i > 0 && previousStageUsers.size > 0) {
      const convertedUsers = Array.from(stageUsers.keys()).filter((uid) =>
        previousStageUsers.has(uid)
      );
      conversionRateFromPrevious =
        (convertedUsers.length / previousStageUsers.size) * 100;
    }

    // Calculate conversion from start
    const firstStageUsers = stages[0]?.unique_users ?? uniqueUsers;
    const conversionRateFromStart =
      firstStageUsers > 0 ? (uniqueUsers / firstStageUsers) * 100 : 0;

    // Calculate drop-off
    let dropOffCount = 0;
    let dropOffRate = 0;
    if (i > 0 && previousStageUsers.size > 0) {
      const convertedUsers = Array.from(stageUsers.keys()).filter((uid) =>
        previousStageUsers.has(uid)
      );
      dropOffCount = previousStageUsers.size - convertedUsers.length;
      dropOffRate = (dropOffCount / previousStageUsers.size) * 100;
    }

    // Calculate average time to convert
    let avgTimeToConvert: number | null = null;
    if (i > 0) {
      const conversionTimes: number[] = [];
      for (const [userId, stageData] of stageUsers) {
        const previousStage = stages[i - 1];
        if (previousStage) {
          const userPrevEvents = userEvents.get(userId);
          if (userPrevEvents) {
            const prevEvent = userPrevEvents.find(
              (e) => e.event_name === stageNames[i - 1]
            );
            if (prevEvent) {
              const timeDiff =
                new Date(stageData.firstEvent.timestamp).getTime() -
                new Date(prevEvent.timestamp).getTime();
              conversionTimes.push(timeDiff / 1000); // Convert to seconds
            }
          }
        }
      }

      if (conversionTimes.length > 0) {
        avgTimeToConvert =
          conversionTimes.reduce((sum, t) => sum + t, 0) /
          conversionTimes.length;
      }
    }

    const stage: FunnelStage = {
      name: stageName,
      event_name: eventName,
      unique_users: uniqueUsers,
      total_events: totalEvents,
      conversion_rate_from_previous: conversionRateFromPrevious
        ? Math.round(conversionRateFromPrevious * 100) / 100
        : null,
      conversion_rate_from_start:
        Math.round(conversionRateFromStart * 100) / 100,
      avg_time_to_convert_seconds: avgTimeToConvert
        ? Math.round(avgTimeToConvert)
        : null,
      drop_off_count: dropOffCount,
      drop_off_rate: Math.round(dropOffRate * 100) / 100,
    };

    stages.push(stage);
    previousStageUsers = new Set(stageUsers.keys());
  }

  return stages;
}

/**
 * Detect common funnel patterns and anomalies
 */
export function detectFunnelPatterns(
  metrics: FunnelMetrics
): Array<{ pattern: string; description: string; severity: string }> {
  const patterns: Array<{ pattern: string; description: string; severity: string }> = [];

  // Check for steep drop-offs
  for (const stage of metrics.stages) {
    if (stage.drop_off_rate > 70) {
      patterns.push({
        pattern: 'steep_dropoff',
        description: `${stage.name} has a ${stage.drop_off_rate.toFixed(1)}% drop-off rate`,
        severity: 'critical',
      });
    } else if (stage.drop_off_rate > 40) {
      patterns.push({
        pattern: 'moderate_dropoff',
        description: `${stage.name} has a ${stage.drop_off_rate.toFixed(1)}% drop-off rate`,
        severity: 'warning',
      });
    }
  }

  // Check for time anomalies
  const stagesWithTime = metrics.stages.filter(
    (s) => s.avg_time_to_convert_seconds !== null
  );
  if (stagesWithTime.length > 0) {
    const avgTimes = stagesWithTime.map((s) => s.avg_time_to_convert_seconds!);
    const maxTime = Math.max(...avgTimes);
    const avgTime = avgTimes.reduce((sum, t) => sum + t, 0) / avgTimes.length;

    if (maxTime > avgTime * 3) {
      const slowStage = stagesWithTime.find(
        (s) => s.avg_time_to_convert_seconds === maxTime
      );
      patterns.push({
        pattern: 'slow_conversion',
        description: `${slowStage?.name} takes ${(maxTime / 60).toFixed(1)} minutes on average`,
        severity: 'warning',
      });
    }
  }

  // Check for healthy stages
  const healthyStages = metrics.stages.filter(
    (s) => s.conversion_rate_from_previous !== null && s.conversion_rate_from_previous > 80
  );
  if (healthyStages.length > 0) {
    patterns.push({
      pattern: 'healthy_conversion',
      description: `${healthyStages.length} stages have >80% conversion rates`,
      severity: 'info',
    });
  }

  return patterns;
}
