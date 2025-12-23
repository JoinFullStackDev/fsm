'use client';

import { useRouter } from 'next/navigation';
import {
  Box,
  Paper,
  Typography,
  Chip,
  Tooltip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Article as ArticleIcon,
  Assignment as AssignmentIcon,
  WorkspacePremium as WorkspacePremiumIcon,
  Folder as FolderIcon,
} from '@mui/icons-material';
import { useOrganization } from '@/components/providers/OrganizationProvider';

export type ProjectView = 'blueprint' | 'tasks' | 'workspace';

interface ProjectContextNavProps {
  projectId: string;
  projectName: string;
  activeView: ProjectView;
  taskCount?: number;
}

export default function ProjectContextNav({
  projectId,
  projectName,
  activeView,
  taskCount,
}: ProjectContextNavProps) {
  const theme = useTheme();
  const router = useRouter();
  const { features } = useOrganization();

  const navItems = [
    {
      key: 'blueprint' as ProjectView,
      label: 'Blueprint',
      icon: <ArticleIcon sx={{ fontSize: 18 }} />,
      path: `/project/${projectId}`,
      badge: null,
    },
    {
      key: 'tasks' as ProjectView,
      label: 'Tasks',
      icon: <AssignmentIcon sx={{ fontSize: 18 }} />,
      path: `/project-management/${projectId}`,
      badge: taskCount !== undefined && taskCount > 0 ? taskCount : null,
    },
    ...(features?.product_workspace_enabled
      ? [
          {
            key: 'workspace' as ProjectView,
            label: 'Workspace',
            icon: <WorkspacePremiumIcon sx={{ fontSize: 18 }} />,
            path: `/workspace/${projectId}`,
            badge: null,
          },
        ]
      : []),
  ];

  const handleNavClick = (path: string) => {
    router.push(path);
  };

  return (
    <Paper
      elevation={0}
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { xs: 'stretch', sm: 'center' },
        gap: { xs: 1.5, sm: 2 },
        p: { xs: 1.5, sm: 2 },
        mb: 3,
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 2,
        backgroundColor: theme.palette.background.paper,
      }}
    >
      {/* Project Name */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          flex: { xs: 'none', sm: 1 },
          minWidth: 0,
        }}
      >
        <FolderIcon
          sx={{
            fontSize: 20,
            color: theme.palette.text.secondary,
            flexShrink: 0,
          }}
        />
        <Typography
          variant="subtitle1"
          sx={{
            fontWeight: 600,
            color: theme.palette.text.primary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {projectName}
        </Typography>
      </Box>

      {/* Navigation Chips */}
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          flexWrap: 'wrap',
        }}
      >
        {navItems.map((item) => {
          const isActive = activeView === item.key;
          return (
            <Tooltip key={item.key} title={item.label} arrow placement="top">
              <Chip
                icon={item.icon}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {item.label}
                    {item.badge !== null && (
                      <Box
                        component="span"
                        sx={{
                          backgroundColor: isActive
                            ? theme.palette.background.paper
                            : theme.palette.action.hover,
                          color: isActive
                            ? theme.palette.text.primary
                            : theme.palette.text.secondary,
                          borderRadius: '10px',
                          px: 0.75,
                          py: 0.125,
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          minWidth: 20,
                          textAlign: 'center',
                        }}
                      >
                        {item.badge}
                      </Box>
                    )}
                  </Box>
                }
                onClick={() => handleNavClick(item.path)}
                variant={isActive ? 'filled' : 'outlined'}
                sx={{
                  height: { xs: 36, sm: 32 },
                  px: 0.5,
                  cursor: 'pointer',
                  fontWeight: 500,
                  fontSize: { xs: '0.875rem', sm: '0.8125rem' },
                  transition: 'all 0.2s ease',
                  ...(isActive
                    ? {
                        backgroundColor: theme.palette.text.primary,
                        color: theme.palette.background.default,
                        borderColor: theme.palette.text.primary,
                        '& .MuiChip-icon': {
                          color: theme.palette.background.default,
                        },
                        '&:hover': {
                          backgroundColor: theme.palette.text.primary,
                          opacity: 0.9,
                        },
                      }
                    : {
                        backgroundColor: 'transparent',
                        color: theme.palette.text.primary,
                        borderColor: theme.palette.divider,
                        '& .MuiChip-icon': {
                          color: theme.palette.text.secondary,
                        },
                        '&:hover': {
                          backgroundColor: theme.palette.action.hover,
                          borderColor: theme.palette.text.primary,
                        },
                      }),
                }}
              />
            </Tooltip>
          );
        })}
      </Box>
    </Paper>
  );
}

