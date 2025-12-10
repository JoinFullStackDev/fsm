'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Paper, Box, Typography, Chip } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { PlayArrow as PlayArrowIcon } from '@mui/icons-material';
import type { ReactElement } from 'react';

export default function TriggerNode(props: NodeProps): ReactElement {
  const { data, selected } = props;
  const theme = useTheme();
  const label = String(data?.label || 'Start Workflow');
  const triggerType = String(data?.triggerType || 'event');
  const triggerConfig = (data?.triggerConfig as Record<string, unknown>) || {};
  const isSelected = selected === true;
  
  const eventTypes = triggerConfig.event_types as string[] | undefined;
  const scheduleType = triggerConfig.schedule_type as string | undefined;
  const scheduleTime = triggerConfig.time as string | undefined;

  const getTriggerLabel = (): string => {
    if (triggerType === 'event') return 'Event';
    if (triggerType === 'schedule') return 'Schedule';
    if (triggerType === 'webhook') return 'Webhook';
    if (triggerType === 'manual') return 'Manual';
    return 'Event';
  };

  return (
    <Paper
      elevation={isSelected ? 8 : 2}
      sx={{
        p: 2,
        minWidth: 200,
        border: isSelected ? `2px solid ${theme.palette.primary.main}` : `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        '&:hover': {
          boxShadow: theme.shadows[4],
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <PlayArrowIcon sx={{ color: theme.palette.success.main, fontSize: 20 }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          Trigger
        </Typography>
      </Box>
      
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        {label}
      </Typography>
      
      <Chip
        label={getTriggerLabel()}
        size="small"
        sx={{
          height: 20,
          fontSize: '0.7rem',
          backgroundColor: theme.palette.success.main + '20',
          color: theme.palette.success.main,
          textTransform: 'capitalize',
        }}
      />

      {/* Show event types if configured */}
      {triggerType === 'event' && eventTypes && Array.isArray(eventTypes) && eventTypes.length > 0 && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" sx={{ fontSize: '0.65rem', color: theme.palette.text.secondary, display: 'block' }}>
            Events:
          </Typography>
          <Typography variant="caption" sx={{ fontSize: '0.65rem', color: theme.palette.text.primary }}>
            {eventTypes.slice(0, 2).join(', ')}
            {eventTypes.length > 2 ? '...' : ''}
          </Typography>
        </Box>
      )}

      {/* Show schedule info if configured */}
      {triggerType === 'schedule' && scheduleType && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" sx={{ fontSize: '0.65rem', color: theme.palette.text.primary }}>
            {scheduleType} at {scheduleTime || '09:00'}
          </Typography>
        </Box>
      )}

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: theme.palette.success.main,
          width: 10,
          height: 10,
        }}
      />
    </Paper>
  );
}
