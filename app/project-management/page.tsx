'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Button,
  Chip,
  Alert,
  Skeleton,
  LinearProgress,
  IconButton,
  Tooltip,
  Pagination,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  PlayArrow as PlayArrowIcon,
  Assignment as AssignmentIcon,
} from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import EmptyState from '@/components/ui/EmptyState';
import { FolderOpen as FolderIcon } from '@mui/icons-material';
import SortableTable from '@/components/dashboard/SortableTable';
import type { Project } from '@/types/project';

export default function ProjectManagementPage() {
  const theme = useTheme();
  const router = useRouter();
  const supabase = createSupabaseClient();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initiating, setInitiating] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const offset = (page - 1) * pageSize;
      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: offset.toString(),
      });

      const response = await fetch(`/api/projects?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load projects');
      }

      setProjects(data.data || []);
      setTotal(data.total || 0);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load projects';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleInitiateProject = async (projectId: string) => {
    setInitiating(projectId);
    try {
      const response = await fetch(`/api/projects/${projectId}/analyze`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to initiate project');
      }

      // Reload projects to get updated initiated_at
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: userData } = await supabase
          .from('users')
          .select('id')
          .eq('auth_id', session.user.id)
          .single();

        if (userData) {
          const { data: project } = await supabase
            .from('projects')
            .select('*')
            .eq('id', projectId)
            .single();

          if (project) {
            setProjects((prev) =>
              prev.map((p) => (p.id === projectId ? (project as Project) : p))
            );
          }
        }
      }

      // Navigate to task management page
      router.push(`/project-management/${projectId}`);
    } catch (error) {
      console.error('Failed to initiate project:', error);
      setError(error instanceof Error ? error.message : 'Failed to initiate project');
    } finally {
      setInitiating(null);
    }
  };

  const [projectProgress, setProjectProgress] = useState<Record<string, number>>({});

  useEffect(() => {
    const loadProgress = async () => {
      const progressMap: Record<string, number> = {};
      for (const project of projects) {
        if (project.initiated_at) {
          try {
            const { data: tasks } = await supabase
              .from('project_tasks')
              .select('status')
              .eq('project_id', project.id);

            if (tasks && tasks.length > 0) {
              const completed = tasks.filter((t: any) => t.status === 'done').length;
              progressMap[project.id] = Math.round((completed / tasks.length) * 100);
            } else {
              progressMap[project.id] = 0;
            }
          } catch {
            progressMap[project.id] = 0;
          }
        }
      }
      setProjectProgress(progressMap);
    };

    if (projects.length > 0) {
      loadProgress();
    }
  }, [projects, supabase]);

  if (loading) {
    return (
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Skeleton variant="text" width="300px" height={48} />
        </Box>
        <LoadingSkeleton variant="dashboard" count={6} />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography
            variant="h4"
            component="h1"
            sx={{
              fontWeight: 600,
              color: theme.palette.text.primary,
              fontSize: '1.5rem',
            }}
          >
            Project Management
          </Typography>
          {!loading && (
            <Chip
              label={total}
              size="small"
              sx={{
                backgroundColor: theme.palette.action.hover,
                color: theme.palette.text.primary,
                border: `1px solid ${theme.palette.divider}`,
                fontWeight: 500,
                height: 24,
              }}
            />
          )}
        </Box>
      </Box>

      {error && (
        <Alert
          severity="error"
          sx={{
            mb: 3,
            backgroundColor: theme.palette.action.hover,
            border: `1px solid ${theme.palette.divider}`,
            color: theme.palette.text.primary,
          }}
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      {projects.length === 0 ? (
        <EmptyState
          icon={<FolderIcon sx={{ fontSize: 64 }} />}
          title="No projects yet"
          description="Create a project to get started with project management and task tracking."
          actionLabel="Create Project"
          onAction={() => router.push('/project/new')}
        />
      ) : (
        <SortableTable
          data={projects}
          columns={[
            {
              key: 'name',
              label: 'Project Name',
              sortable: true,
              render: (value) => (
                <Typography variant="body2" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
                  {value}
                </Typography>
              ),
            },
            {
              key: 'status',
              label: 'Status',
              sortable: true,
              render: (value) => (
                <Chip
                  label={String(value).replace('_', ' ')}
                  size="small"
                  sx={{
                    backgroundColor: theme.palette.action.hover,
                    color: theme.palette.text.primary,
                    border: `1px solid ${theme.palette.divider}`,
                    fontWeight: 500,
                  }}
                />
              ),
            },
            {
              key: 'initiated_at',
              label: 'Progress',
              sortable: true,
              render: (value, project) => {
                if (!value) {
                  return (
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                      Not initiated
                    </Typography>
                  );
                }
                const progress = projectProgress[project.id] || 0;
                return (
                  <Box sx={{ minWidth: 150 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                        {progress}%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={progress}
                      sx={{
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: theme.palette.action.hover,
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: '#4CAF50',
                        },
                      }}
                    />
                  </Box>
                );
              },
            },
            {
              key: 'actions',
              label: 'Actions',
              sortable: false,
              align: 'right',
              render: (_, project) => (
                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                  {project.initiated_at ? (
                    <Tooltip title="Manage Tasks">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/project-management/${project.id}`);
                        }}
                        sx={{
                          color: theme.palette.text.primary,
                          '&:hover': {
                            backgroundColor: theme.palette.action.hover,
                          },
                        }}
                      >
                        <AssignmentIcon />
                      </IconButton>
                    </Tooltip>
                  ) : (
                    <Tooltip title={initiating === project.id ? 'Initiating...' : 'Initiate Project'}>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInitiateProject(project.id);
                        }}
                        disabled={initiating === project.id}
                        sx={{
                          color: theme.palette.text.primary,
                          '&:hover': {
                            backgroundColor: theme.palette.action.hover,
                          },
                          '&:disabled': {
                            color: theme.palette.text.secondary,
                          },
                        }}
                      >
                        <PlayArrowIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              ),
            },
          ]}
          onRowClick={(project) => {
            if (project.initiated_at) {
              router.push(`/project-management/${project.id}`);
            }
          }}
          emptyMessage="No projects found"
        />
      )}

      {/* Pagination */}
      {total > 10 && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mt: 3,
            pt: 3,
            borderTop: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
              Showing {Math.min((page - 1) * pageSize + 1, total)} - {Math.min(page * pageSize, total)} of {total}
            </Typography>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel sx={{ color: theme.palette.text.secondary }}>Per Page</InputLabel>
              <Select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                label="Per Page"
                sx={{
                  color: theme.palette.text.primary,
                  backgroundColor: theme.palette.action.hover,
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: theme.palette.divider,
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: theme.palette.text.secondary,
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: theme.palette.text.primary,
                  },
                  '& .MuiSvgIcon-root': {
                    color: theme.palette.text.primary,
                  },
                }}
              >
                <MenuItem value={10}>10</MenuItem>
                <MenuItem value={25}>25</MenuItem>
                <MenuItem value={50}>50</MenuItem>
                <MenuItem value={75}>75</MenuItem>
                <MenuItem value={100}>100</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <Pagination
            count={Math.ceil(total / pageSize)}
            page={page}
            onChange={(_, value) => setPage(value)}
            color="primary"
            sx={{
              '& .MuiPaginationItem-root': {
                color: theme.palette.text.primary,
                '&.Mui-selected': {
                  backgroundColor: theme.palette.action.hover,
                  color: theme.palette.text.primary,
                },
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
                },
              },
            }}
          />
        </Box>
      )}
    </Box>
  );
}

