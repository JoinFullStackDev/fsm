'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Container,
  Box,
  Typography,
  Button,
  Chip,
  Alert,
  Skeleton,
  LinearProgress,
} from '@mui/material';
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
  const router = useRouter();
  const supabase = createSupabaseClient();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initiating, setInitiating] = useState<string | null>(null);

  useEffect(() => {
    const loadProjects = async () => {
      setLoading(true);
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        setError(sessionError.message);
        setLoading(false);
        return;
      }

      if (!session) {
        setError('Session not found. Please try signing in again.');
        setLoading(false);
        return;
      }

      // Get user record
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, role')
        .eq('auth_id', session.user.id)
        .single();

      if (userError || !userData) {
        setError('Failed to load user data');
        setLoading(false);
        return;
      }

      // Get projects where user is owner
      const { data: ownedProjects, error: ownedError } = await supabase
        .from('projects')
        .select('*')
        .eq('owner_id', userData.id)
        .order('updated_at', { ascending: false });

      // Get projects where user is a member
      const { data: memberProjects, error: memberError } = await supabase
        .from('project_members')
        .select('project_id, projects(*)')
        .eq('user_id', userData.id);

      if (ownedError || memberError) {
        setError(ownedError?.message || memberError?.message || 'Failed to load projects');
        setLoading(false);
        return;
      }

      // Combine owned projects and member projects
      const owned = ownedProjects || [];
      const member = (memberProjects || []).map((mp: any) => mp.projects).filter(Boolean);
      const allProjects = [...owned, ...member];

      // Remove duplicates
      const uniqueProjects = Array.from(
        new Map(allProjects.map((p: any) => [p.id, p])).values()
      ) as Project[];

      setProjects(uniqueProjects);
      setLoading(false);
    };

    loadProjects();
  }, [supabase]);

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
              const completed = tasks.filter((t) => t.status === 'done').length;
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
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Skeleton variant="text" width="300px" height={48} />
        </Box>
        <LoadingSkeleton variant="dashboard" count={6} />
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ pt: 4, pb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography
          variant="h3"
          component="h1"
          sx={{
            fontWeight: 700,
            background: '#00E5FF',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Project Management
        </Typography>
      </Box>

      {error && (
        <Alert
          severity="error"
          sx={{
            mb: 3,
            backgroundColor: 'rgba(255, 23, 68, 0.1)',
            border: '1px solid rgba(255, 23, 68, 0.3)',
            color: '#FF1744',
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
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#00E5FF' }}>
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
                    backgroundColor: 'rgba(0, 255, 136, 0.15)',
                    color: '#00FF88',
                    border: '1px solid rgba(0, 255, 136, 0.3)',
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
                    <Typography variant="body2" sx={{ color: '#B0B0B0' }}>
                      Not initiated
                    </Typography>
                  );
                }
                const progress = projectProgress[project.id] || 0;
                return (
                  <Box sx={{ minWidth: 150 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ color: '#B0B0B0' }}>
                        {progress}%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={progress}
                      sx={{
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: '#00E5FF',
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
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<AssignmentIcon />}
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/project-management/${project.id}`);
                      }}
                      sx={{
                        backgroundColor: '#00E5FF',
                        color: '#000',
                        fontWeight: 600,
                        '&:hover': {
                          backgroundColor: '#00B2CC',
                        },
                      }}
                    >
                      Manage Tasks
                    </Button>
                  ) : (
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<PlayArrowIcon />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleInitiateProject(project.id);
                      }}
                      disabled={initiating === project.id}
                      sx={{
                        backgroundColor: '#E91E63',
                        color: '#FFF',
                        fontWeight: 600,
                        '&:hover': {
                          backgroundColor: '#C2185B',
                        },
                        '&:disabled': {
                          backgroundColor: 'rgba(233, 30, 99, 0.5)',
                        },
                      }}
                    >
                      {initiating === project.id ? 'Initiating...' : 'Initiate Project'}
                    </Button>
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
    </Container>
  );
}

