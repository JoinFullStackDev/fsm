'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Paper, Box, Typography, Chip } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { BoltOutlined as BoltIcon } from '@mui/icons-material';
import type { ReactElement } from 'react';

export default function ActionNode(props: NodeProps): ReactElement {
  const { data, selected } = props;
  const theme = useTheme();
  const label = String(data?.label || 'Execute Action');
  const actionType = String(data?.actionType || '');
  const stepData = (data?.stepData || {}) as { config?: Record<string, unknown> };
  const isSelected = selected === true;
  
  const config = stepData.config || {};
  const emailTo = config.to ? String(config.to) : '';
  const notificationTitle = config.title ? String(config.title) : '';
  const taskTitle = config.title ? String(config.title) : '';

  const formatActionType = (type: string): string => {
    return type
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
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
          background: theme.palette.primary.main,
          width: 10,
          height: 10,
        }}
      />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <BoltIcon sx={{ color: theme.palette.primary.main, fontSize: 20 }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          Action
        </Typography>
      </Box>
      
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        {label}
      </Typography>
      
      {actionType && (
        <Chip
          label={formatActionType(actionType)}
          size="small"
          sx={{
            height: 20,
            fontSize: '0.7rem',
            backgroundColor: theme.palette.primary.main + '20',
            color: theme.palette.primary.main,
          }}
        />
      )}

      {/* Show key config details */}
      {(emailTo || notificationTitle || taskTitle) && (
        <Box sx={{ mt: 1 }}>
          {actionType === 'send_email' && emailTo && (
            <Typography variant="caption" sx={{ fontSize: '0.65rem', color: theme.palette.text.secondary, display: 'block' }}>
              To: {emailTo.substring(0, 25)}{emailTo.length > 25 ? '...' : ''}
            </Typography>
          )}
          {actionType === 'send_notification' && notificationTitle && (
            <Typography variant="caption" sx={{ fontSize: '0.65rem', color: theme.palette.text.secondary, display: 'block' }}>
              {notificationTitle.substring(0, 30)}{notificationTitle.length > 30 ? '...' : ''}
            </Typography>
          )}
          {actionType === 'create_task' && taskTitle && (
            <Typography variant="caption" sx={{ fontSize: '0.65rem', color: theme.palette.text.secondary, display: 'block' }}>
              {taskTitle.substring(0, 30)}{taskTitle.length > 30 ? '...' : ''}
            </Typography>
          )}
        </Box>
      )}

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: theme.palette.primary.main,
          width: 10,
          height: 10,
        }}
      />
    </Paper>
  );
}
