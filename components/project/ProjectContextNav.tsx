'use client';

import { useRouter } from 'next/navigation';
import {
  Box,
  Paper,
  Typography,
  Chip,
  Tooltip,
  Avatar,
  IconButton,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Article as ArticleIcon,
  Assignment as AssignmentIcon,
  WorkspacePremium as WorkspacePremiumIcon,
  Folder as FolderIcon,
  CloudUpload as CloudUploadIcon,
  Settings as SettingsIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useOrganization } from '@/components/providers/OrganizationProvider';

export type ProjectView = 'blueprint' | 'tasks' | 'workspace' | 'uploads';

interface ProjectContextNavProps {
  projectId: string;
  projectName: string;
  activeView: ProjectView;
  taskCount?: number;
  creator?: {
    name: string | null;
    email: string;
    avatar_url?: string | null;
  } | null;
  isActive?: boolean;
  isCompanyAdmin?: boolean;
  onDeleteClick?: () => void;
}

export default function ProjectContextNav({
  projectId,
  projectName,
  activeView,
  taskCount,
  creator,
  isActive,
  isCompanyAdmin,
  onDeleteClick,
}: ProjectContextNavProps) {
  const theme = useTheme();
  const router = useRouter();
  const { features } = useOrganization();

  const navItems = [
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
    {
      key: 'uploads' as ProjectView,
      label: 'Media',
      icon: <CloudUploadIcon sx={{ fontSize: 18 }} />,
      path: `/project/${projectId}/uploads`,
      badge: null,
    },
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
      {/* Project Name & Creator */}
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
        {(creator || isActive !== undefined) && (
          <Box
            sx={{
              display: { xs: 'none', md: 'flex' },
              alignItems: 'center',
              gap: 1,
              ml: 1,
              pl: 1.5,
              borderLeft: `1px solid ${theme.palette.divider}`,
            }}
          >
            {creator && (
              <Tooltip title={`Created by ${creator.name || creator.email}`} arrow>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                  }}
                >
                  <Avatar
                    src={creator.avatar_url || undefined}
                    sx={{
                      width: 20,
                      height: 20,
                      bgcolor: theme.palette.text.secondary,
                      fontSize: '0.65rem',
                    }}
                  >
                    {creator.name?.[0]?.toUpperCase() || creator.email[0]?.toUpperCase() || 'U'}
                  </Avatar>
                  <Typography
                    variant="body2"
                    sx={{
                      color: theme.palette.text.secondary,
                      fontSize: '0.8rem',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {creator.name || creator.email}
                  </Typography>
                </Box>
              </Tooltip>
            )}
            {isActive !== undefined && (
              <Chip
                size="small"
                label={isActive ? 'Active' : 'Draft'}
                sx={{
                  height: 20,
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  backgroundColor: isActive ? 'rgba(76, 175, 80, 0.15)' : theme.palette.action.hover,
                  color: isActive ? '#4CAF50' : theme.palette.text.secondary,
                  border: `1px solid ${isActive ? '#4CAF50' : theme.palette.divider}`,
                  '& .MuiChip-label': {
                    px: 1,
                  },
                }}
              />
            )}
          </Box>
        )}
      </Box>

      {/* Navigation Chips */}
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        {navItems.map((item) => {
          const isActiveItem = activeView === item.key;
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
                          backgroundColor: isActiveItem
                            ? theme.palette.background.paper
                            : theme.palette.action.hover,
                          color: isActiveItem
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
                variant={isActiveItem ? 'filled' : 'outlined'}
                sx={{
                  height: { xs: 36, sm: 32 },
                  px: 0.5,
                  cursor: 'pointer',
                  fontWeight: 500,
                  fontSize: { xs: '0.875rem', sm: '0.8125rem' },
                  transition: 'all 0.2s ease',
                  ...(isActiveItem
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

        {/* Action Buttons */}
        <Box
          sx={{
            display: 'flex',
            gap: 0.5,
            ml: 1,
            pl: 1,
            borderLeft: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Tooltip title="Settings" arrow>
            <IconButton
              size="small"
              onClick={() => router.push(`/project/${projectId}/settings`)}
              sx={{
                color: theme.palette.text.secondary,
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
                  color: theme.palette.text.primary,
                },
              }}
            >
              <SettingsIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Tooltip>
          {isCompanyAdmin && onDeleteClick && (
            <Tooltip title="Delete Project" arrow>
              <IconButton
                size="small"
                onClick={onDeleteClick}
                sx={{
                  color: theme.palette.text.secondary,
                  '&:hover': {
                    backgroundColor: theme.palette.error.main,
                    color: theme.palette.background.paper,
                  },
                }}
              >
                <DeleteIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>
    </Paper>
  );
}

