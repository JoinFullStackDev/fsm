'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Paper, Box, Typography, Chip } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Schedule as ScheduleIcon } from '@mui/icons-material';
import type { ReactElement } from 'react';

export default function DelayNode(props: NodeProps): ReactElement {
  const { data, selected } = props;
  const theme = useTheme();
  const label = String(data?.label || 'Wait before continuing');
  const delayValue = Number(data?.delayValue || 1);
  const delayType = String(data?.delayType || 'hours');
  const isSelected = selected === true;

  const getDelayLabel = (): string => {
    if (delayValue && delayType) {
      return `${delayValue} ${delayType}`;
    }
    return 'Wait';
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
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: theme.palette.info.main,
          width: 10,
          height: 10,
        }}
      />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <ScheduleIcon sx={{ color: theme.palette.info.main, fontSize: 20 }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          Delay
        </Typography>
      </Box>
      
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        {label}
      </Typography>
      
      <Chip
        label={getDelayLabel()}
        size="small"
        sx={{
          height: 20,
          fontSize: '0.7rem',
          backgroundColor: theme.palette.info.main + '20',
          color: theme.palette.info.main,
        }}
      />

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: theme.palette.info.main,
          width: 10,
          height: 10,
        }}
      />
    </Paper>
  );
}
