'use client';

import { ToggleButton, ToggleButtonGroup, Tooltip, Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  TableChart as TableChartIcon,
  Timeline as TimelineIcon,
  ViewKanban as ViewKanbanIcon,
  Description as DescriptionIcon,
  Assessment as AssessmentIcon,
  People as PeopleIcon,
  Dashboard as DashboardIcon,
} from '@mui/icons-material';

export type ViewType = 'table' | 'gantt' | 'kanban' | 'assignee-kanban' | 'dashboard' | 'reports' | 'generate-report';

interface ViewToggleProps {
  view: ViewType;
  onChange: (view: ViewType) => void;
}

export default function ViewToggle({ view, onChange }: ViewToggleProps) {
  const theme = useTheme();
  const commonButtonStyles = {
    height: { xs: '40px', md: '32px' },
    minHeight: { xs: '40px', md: '32px' },
    width: { xs: '40px', md: '32px' },
    minWidth: { xs: '40px', md: '32px' },
    padding: 0,
    color: theme.palette.text.secondary,
    borderColor: theme.palette.divider,
    backgroundColor: 'transparent',
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
      color: theme.palette.text.primary,
      borderColor: theme.palette.text.primary,
      borderLeft: `1px solid ${theme.palette.text.primary} !important`,
      borderRight: `1px solid ${theme.palette.text.primary} !important`,
      borderTop: `1px solid ${theme.palette.text.primary} !important`,
      borderBottom: `1px solid ${theme.palette.text.primary} !important`,
    },
    '&:focus': {
      borderLeft: `1px solid ${theme.palette.text.primary} !important`,
      borderRight: `1px solid ${theme.palette.text.primary} !important`,
      borderTop: `1px solid ${theme.palette.text.primary} !important`,
      borderBottom: `1px solid ${theme.palette.text.primary} !important`,
    },
    '&:active': {
      borderLeft: `1px solid ${theme.palette.text.primary} !important`,
      borderRight: `1px solid ${theme.palette.text.primary} !important`,
      borderTop: `1px solid ${theme.palette.text.primary} !important`,
      borderBottom: `1px solid ${theme.palette.text.primary} !important`,
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
              backgroundColor: theme.palette.action.hover,
              color: theme.palette.text.primary,
              borderColor: theme.palette.text.primary,
              borderLeft: `1px solid ${theme.palette.text.primary}`,
              borderRight: `1px solid ${theme.palette.text.primary}`,
              borderTop: `1px solid ${theme.palette.text.primary}`,
              borderBottom: `1px solid ${theme.palette.text.primary}`,
              '&:hover': {
                backgroundColor: theme.palette.action.hover,
                borderColor: theme.palette.text.primary,
                borderLeft: `1px solid ${theme.palette.text.primary}`,
                borderRight: `1px solid ${theme.palette.text.primary}`,
                borderTop: `1px solid ${theme.palette.text.primary}`,
                borderBottom: `1px solid ${theme.palette.text.primary}`,
              },
            },
          },
        }}
      >
        <ToggleButton value="table">
          <Tooltip title="Table View">
            <TableChartIcon sx={{ fontSize: { xs: 22, md: 18 } }} />
          </Tooltip>
        </ToggleButton>
        <ToggleButton value="gantt">
          <Tooltip title="Gantt Chart View">
            <TimelineIcon sx={{ fontSize: { xs: 22, md: 18 } }} />
          </Tooltip>
        </ToggleButton>
        <ToggleButton value="kanban" sx={{ borderRight: 'none' }}>
          <Tooltip title="Kanban Board View">
            <ViewKanbanIcon sx={{ fontSize: { xs: 22, md: 18 } }} />
          </Tooltip>
        </ToggleButton>
        <ToggleButton value="assignee-kanban" sx={{ borderRight: 'none' }}>
          <Tooltip title="Assignee Kanban View">
            <PeopleIcon sx={{ fontSize: { xs: 22, md: 18 } }} />
          </Tooltip>
        </ToggleButton>
        <ToggleButton value="dashboard" sx={{ borderRight: 'none' }}>
          <Tooltip title="Dashboard">
            <DashboardIcon sx={{ fontSize: { xs: 22, md: 18 } }} />
          </Tooltip>
        </ToggleButton>
        <ToggleButton value="reports" sx={{ borderRight: 'none' }}>
          <Tooltip title="View Reports">
            <DescriptionIcon sx={{ fontSize: { xs: 22, md: 18 } }} />
          </Tooltip>
        </ToggleButton>
        <ToggleButton value="generate-report" sx={{ borderRight: `1px solid ${theme.palette.divider}` }}>
          <Tooltip title="Generate Report">
            <AssessmentIcon sx={{ fontSize: { xs: 22, md: 18 } }} />
          </Tooltip>
        </ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );
}

