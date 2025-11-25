'use client';

import { ToggleButton, ToggleButtonGroup, Tooltip, Box } from '@mui/material';
import {
  TableChart as TableChartIcon,
  Timeline as TimelineIcon,
  ViewKanban as ViewKanbanIcon,
  Description as DescriptionIcon,
  Assessment as AssessmentIcon,
} from '@mui/icons-material';

export type ViewType = 'table' | 'gantt' | 'kanban' | 'reports' | 'generate-report';

interface ViewToggleProps {
  view: ViewType;
  onChange: (view: ViewType) => void;
}

export default function ViewToggle({ view, onChange }: ViewToggleProps) {
  const commonButtonStyles = {
    height: '32px',
    minHeight: '32px',
    width: '32px',
    minWidth: '32px',
    padding: 0,
    color: '#B0B0B0',
    borderColor: 'rgba(0, 229, 255, 0.3)',
    backgroundColor: 'transparent',
    '&:hover': {
      backgroundColor: 'rgba(0, 229, 255, 0.05)',
      color: '#00E5FF',
      borderColor: '#00E5FF',
      borderLeft: '1px solid #00E5FF !important',
      borderRight: '1px solid #00E5FF !important',
      borderTop: '1px solid #00E5FF !important',
      borderBottom: '1px solid #00E5FF !important',
    },
    '&:focus': {
      borderLeft: '1px solid #00E5FF !important',
      borderRight: '1px solid #00E5FF !important',
      borderTop: '1px solid #00E5FF !important',
      borderBottom: '1px solid #00E5FF !important',
    },
    '&:active': {
      borderLeft: '1px solid #00E5FF !important',
      borderRight: '1px solid #00E5FF !important',
      borderTop: '1px solid #00E5FF !important',
      borderBottom: '1px solid #00E5FF !important',
    },
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0 }}>
      <ToggleButtonGroup
        value={view}
        exclusive
        onChange={(_, newView) => {
          if (newView !== null) {
            onChange(newView);
          }
        }}
        size="small"
        sx={{
          '& .MuiToggleButton-root': {
            ...commonButtonStyles,
            borderRadius: 0,
            borderRight: 'none',
            '&:first-of-type': {
              borderRadius: '4px 0 0 4px',
            },
            '&:last-of-type': {
              borderRadius: '0 4px 4px 0',
            },
            '&.Mui-selected': {
              backgroundColor: 'rgba(0, 229, 255, 0.1)',
              color: '#00E5FF',
              borderColor: '#00E5FF',
              borderLeft: '1px solid #00E5FF',
              borderRight: '1px solid #00E5FF',
              borderTop: '1px solid #00E5FF',
              borderBottom: '1px solid #00E5FF',
              '&:hover': {
                backgroundColor: 'rgba(0, 229, 255, 0.15)',
                borderColor: '#00E5FF',
                borderLeft: '1px solid #00E5FF',
                borderRight: '1px solid #00E5FF',
                borderTop: '1px solid #00E5FF',
                borderBottom: '1px solid #00E5FF',
              },
            },
          },
        }}
      >
        <ToggleButton value="table">
          <Tooltip title="Table View">
            <TableChartIcon fontSize="small" />
          </Tooltip>
        </ToggleButton>
        <ToggleButton value="gantt">
          <Tooltip title="Gantt Chart View">
            <TimelineIcon fontSize="small" />
          </Tooltip>
        </ToggleButton>
        <ToggleButton value="kanban" sx={{ borderRight: 'none' }}>
          <Tooltip title="Kanban Board View">
            <ViewKanbanIcon fontSize="small" />
          </Tooltip>
        </ToggleButton>
        <ToggleButton value="reports" sx={{ borderRight: 'none' }}>
          <Tooltip title="View Reports">
            <DescriptionIcon fontSize="small" />
          </Tooltip>
        </ToggleButton>
        <ToggleButton value="generate-report" sx={{ borderRight: '1px solid rgba(0, 229, 255, 0.3)' }}>
          <Tooltip title="Generate Report">
            <AssessmentIcon fontSize="small" />
          </Tooltip>
        </ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );
}

