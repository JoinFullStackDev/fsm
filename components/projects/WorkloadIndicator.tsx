'use client';

import { Box, Tooltip, LinearProgress, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { UserWorkloadSummary } from '@/types/project';

interface WorkloadIndicatorProps {
  workload?: UserWorkloadSummary | null;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
}

export default function WorkloadIndicator({ 
  workload, 
  size = 'medium',
  showLabel = false 
}: WorkloadIndicatorProps) {
  const theme = useTheme();

  if (!workload) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <LinearProgress 
          variant="determinate" 
          value={0} 
          sx={{ 
            width: size === 'small' ? 60 : size === 'medium' ? 80 : 100,
            height: size === 'small' ? 4 : size === 'medium' ? 6 : 8,
            borderRadius: 1,
            backgroundColor: theme.palette.grey[200],
          }} 
        />
        {showLabel && (
          <Typography variant="caption" color="text.secondary">
            N/A
          </Typography>
        )}
      </Box>
    );
  }

  const utilization = workload.utilization_percentage || 0;
  const isOverAllocated = workload.is_over_allocated || false;

  // Color based on utilization
  let color: 'success' | 'warning' | 'error' = 'success';
  if (isOverAllocated || utilization >= 100) {
    color = 'error';
  } else if (utilization >= 80) {
    color = 'warning';
  }

  const width = size === 'small' ? 60 : size === 'medium' ? 80 : 100;
  const height = size === 'small' ? 4 : size === 'medium' ? 6 : 8;

  return (
    <Tooltip
      title={
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
            Resource Utilization
          </Typography>
          <Typography variant="caption" display="block">
            {utilization.toFixed(1)}% utilized
          </Typography>
          <Typography variant="caption" display="block">
            {workload.allocated_hours_per_week.toFixed(1)} / {workload.max_hours_per_week} hours/week
          </Typography>
          {isOverAllocated && (
            <Typography variant="caption" color="error" display="block" sx={{ mt: 0.5 }}>
              Over-allocated!
            </Typography>
          )}
        </Box>
      }
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <LinearProgress
          variant="determinate"
          value={Math.min(utilization, 100)}
          color={color}
          sx={{
            width,
            height,
            borderRadius: 1,
            backgroundColor: theme.palette.grey[200],
            '& .MuiLinearProgress-bar': {
              borderRadius: 1,
            },
          }}
        />
        {showLabel && (
          <Typography 
            variant="caption" 
            color={isOverAllocated ? 'error' : 'text.secondary'}
            sx={{ fontWeight: isOverAllocated ? 'bold' : 'normal' }}
          >
            {utilization.toFixed(0)}%
          </Typography>
        )}
      </Box>
    </Tooltip>
  );
}

