'use client';

import { Box, Button, Grid, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useRouter } from 'next/navigation';
import {
  Add as AddIcon,
  FolderOpen as FolderIcon,
  People as PeopleIcon,
  Assessment as AssessmentIcon,
  MenuBook as MenuBookIcon,
  Assignment as AssignmentIcon,
} from '@mui/icons-material';

interface QuickAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

/**
 * QuickActionsRow Component
 * Displays a row of quick action buttons for common dashboard actions
 */
export default function QuickActionsRow() {
  const theme = useTheme();
  const router = useRouter();

  const actions: QuickAction[] = [
    {
      label: 'Create Template',
      icon: <AddIcon />,
      onClick: () => router.push('/templates'),
    },
    {
      label: 'Task Management',
      icon: <AssignmentIcon />,
      onClick: () => router.push('/projects'),
    },
    {
      label: 'View Projects',
      icon: <FolderIcon />,
      onClick: () => router.push('/projects'),
    },
    {
      label: 'View Teams',
      icon: <PeopleIcon />,
      onClick: () => router.push('/teams'),
    },
    {
      label: 'View Reports',
      icon: <AssessmentIcon />,
      onClick: () => router.push('/reports'),
    },
    {
      label: 'Knowledge Base',
      icon: <MenuBookIcon />,
      onClick: () => router.push('/kb'),
    },
  ];

  return (
    <Box sx={{ mb: 4 }}>
      <Typography
        variant="subtitle2"
        sx={{
          color: theme.palette.text.secondary,
          fontWeight: 600,
          mb: 2,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontSize: '0.75rem',
        }}
      >
        Quick Actions
      </Typography>
      <Grid container spacing={2}>
        {actions.map((action) => (
          <Grid item xs={6} sm={4} md={2} key={action.label}>
            <Button
              fullWidth
              onClick={action.onClick}
              variant="outlined"
              sx={{
                py: 1.5,
                px: 2,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0.5,
                borderRadius: 2,
                textTransform: 'none',
                borderColor: theme.palette.divider,
                color: theme.palette.text.primary,
                backgroundColor: theme.palette.background.paper,
                '&:hover': {
                  borderColor: theme.palette.text.primary,
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              {action.icon}
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 500,
                  fontSize: { xs: '0.65rem', sm: '0.75rem' },
                  lineHeight: 1.2,
                  textAlign: 'center',
                }}
              >
                {action.label}
              </Typography>
            </Button>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

