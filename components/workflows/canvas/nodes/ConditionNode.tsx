'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Paper, Box, Typography, Chip } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { CallSplit as CallSplitIcon } from '@mui/icons-material';
import type { ReactElement } from 'react';

export default function ConditionNode(props: NodeProps): ReactElement {
  const { data, selected } = props;
  const theme = useTheme();
  const label = String(data?.label || 'If / Else');
  const field = String(data?.field || '');
  const operator = String(data?.operator || '');
  const isSelected = selected === true;

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
          background: theme.palette.warning.main,
          width: 10,
          height: 10,
        }}
      />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <CallSplitIcon sx={{ color: theme.palette.warning.main, fontSize: 20 }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          Condition
        </Typography>
      </Box>
      
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        {label}
      </Typography>
      
      {field && (
        <Chip
          label={`${field} ${operator}`.trim()}
          size="small"
          sx={{
            height: 20,
            fontSize: '0.7rem',
            backgroundColor: theme.palette.warning.main + '20',
            color: theme.palette.warning.main,
          }}
        />
      )}

      {/* Output handles - True (left) and False (right) */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="true"
        style={{
          background: theme.palette.success.main,
          width: 10,
          height: 10,
          left: '30%',
        }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        style={{
          background: theme.palette.error.main,
          width: 10,
          height: 10,
          left: '70%',
        }}
      />
      
      {/* Labels for true/false */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, px: 1 }}>
        <Typography variant="caption" sx={{ fontSize: '0.65rem', color: theme.palette.success.main }}>
          True
        </Typography>
        <Typography variant="caption" sx={{ fontSize: '0.65rem', color: theme.palette.error.main }}>
          False
        </Typography>
      </Box>
    </Paper>
  );
}
