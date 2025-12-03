/**
 * Overwork Detection Logic
 * Provides functions to detect if team members are overworked
 */

import type { UserWorkloadSummary } from '@/types/project';

export interface OverworkDetectionResult {
  is_overworked: boolean;
  reason: string;
  severity: 'warning' | 'error';
  metrics: {
    utilization_percentage: number;
    task_count: number;
    high_priority_tasks: number;
    allocation_utilization?: number;
  };
}

/**
 * Check if a member is overworked based on multiple criteria
 * 
 * @param workloadSummary - User workload summary from database
 * @param taskCount - Current number of active tasks
 * @param highPriorityTaskCount - Number of high-priority tasks (optional)
 * @param totalEstimatedHours - Total estimated hours for all assigned tasks (optional)
 * @param allocatedHoursPerWeek - Allocated hours per week for this project (optional)
 * @param weeksUntilDue - Average weeks until task due dates (optional, defaults to 4)
 * @returns Overwork detection result
 */
export function isMemberOverworked(
  workloadSummary?: UserWorkloadSummary,
  taskCount: number = 0,
  highPriorityTaskCount: number = 0,
  totalEstimatedHours?: number,
  allocatedHoursPerWeek?: number,
  weeksUntilDue: number = 4
): OverworkDetectionResult {
  const metrics = {
    utilization_percentage: workloadSummary?.utilization_percentage || 0,
    task_count: taskCount,
    high_priority_tasks: highPriorityTaskCount,
    total_estimated_hours: totalEstimatedHours || 0,
    allocated_hours_per_week: allocatedHoursPerWeek || 0,
  };

  // Criteria 1: Allocation-based overwork (estimated hours exceed allocated capacity)
  if (allocatedHoursPerWeek && totalEstimatedHours && totalEstimatedHours > 0) {
    const totalAllocatedHours = allocatedHoursPerWeek * Math.max(weeksUntilDue, 1);
    const allocationUtilization = (totalEstimatedHours / totalAllocatedHours) * 100;
    
    if (allocationUtilization > 100) {
      return {
        is_overworked: true,
        reason: `Task estimated hours (${totalEstimatedHours.toFixed(1)}h) exceed allocated capacity (${totalAllocatedHours.toFixed(1)}h over ${weeksUntilDue.toFixed(1)} weeks)`,
        severity: 'warning', // Warning, not error - don't block
        metrics: {
          ...metrics,
          allocation_utilization: allocationUtilization,
        },
      };
    }
  }

  // Criteria 2: Utilization >= 100% (over-allocated from workload summary)
  if (workloadSummary?.is_over_allocated || (workloadSummary?.utilization_percentage || 0) >= 100) {
    return {
      is_overworked: true,
      reason: `Member is over-allocated (${Math.round(workloadSummary?.utilization_percentage || 0)}% utilization)`,
      severity: 'warning', // Warning, not error - don't block
      metrics,
    };
  }

  // Criteria 3: Task count > threshold (e.g., 10+ active tasks)
  const TASK_COUNT_THRESHOLD = 10;
  if (taskCount > TASK_COUNT_THRESHOLD) {
    return {
      is_overworked: true,
      reason: `Member has ${taskCount} active tasks (threshold: ${TASK_COUNT_THRESHOLD})`,
      severity: 'warning', // Warning, not error - don't block
      metrics,
    };
  }

  // Criteria 4: Multiple high-priority tasks
  const HIGH_PRIORITY_THRESHOLD = 3;
  if (highPriorityTaskCount >= HIGH_PRIORITY_THRESHOLD) {
    return {
      is_overworked: true,
      reason: `Member has ${highPriorityTaskCount} high-priority tasks`,
      severity: 'warning',
      metrics,
    };
  }

  // Criteria 5: High utilization (80%+) even if not over-allocated
  if ((workloadSummary?.utilization_percentage || 0) >= 80) {
    return {
      is_overworked: true,
      reason: `Member is highly utilized (${Math.round(workloadSummary?.utilization_percentage || 0)}%)`,
      severity: 'warning',
      metrics,
    };
  }

  // Criteria 6: High allocation utilization (80%+) based on estimated hours
  if (allocatedHoursPerWeek && totalEstimatedHours && totalEstimatedHours > 0) {
    const totalAllocatedHours = allocatedHoursPerWeek * Math.max(weeksUntilDue, 1);
    const allocationUtilization = (totalEstimatedHours / totalAllocatedHours) * 100;
    
    if (allocationUtilization >= 80 && allocationUtilization <= 100) {
      return {
        is_overworked: false, // Not overworked yet, but getting close
        reason: `Member is ${Math.round(allocationUtilization)}% allocated based on task estimates`,
        severity: 'warning',
        metrics: {
          ...metrics,
          allocation_utilization: allocationUtilization,
        },
      };
    }
  }

  // Not overworked
  return {
    is_overworked: false,
    reason: 'Member workload is within acceptable limits',
    severity: 'warning',
    metrics,
  };
}

/**
 * Get overwork severity color for UI
 * 
 * @param result - Overwork detection result
 * @returns Color string for UI components
 */
export function getOverworkColor(result: OverworkDetectionResult): 'default' | 'warning' | 'error' {
  if (!result.is_overworked) {
    return 'default';
  }
  return result.severity === 'error' ? 'error' : 'warning';
}

