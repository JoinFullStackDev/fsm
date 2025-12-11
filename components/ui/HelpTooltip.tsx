'use client';

import { Tooltip, IconButton } from '@mui/material';
import { HelpOutline as HelpIcon } from '@mui/icons-material';

interface HelpTooltipProps {
  title: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

export default function HelpTooltip({ title, placement = 'top' }: HelpTooltipProps) {
  return (
    <Tooltip
      title={title}
      placement={placement}
      arrow
      sx={{
        '& .MuiTooltip-tooltip': {
          backgroundColor: '#000',
          border: '1px solid rgba(0, 229, 255, 0.3)',
          borderRadius: 2,
          padding: 1.5,
          fontSize: '0.875rem',
          maxWidth: 300,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
        },
        '& .MuiTooltip-arrow': {
          color: '#000',
          '&::before': {
            border: '1px solid rgba(0, 229, 255, 0.3)',
          },
        },
      }}
    >
      <IconButton
        size="small"
        sx={{
          color: '#C9354A',
          padding: 0.5,
          '&:hover': {
            backgroundColor: 'rgba(0, 229, 255, 0.1)',
            color: '#C9354A',
          },
        }}
      >
        <HelpIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}

