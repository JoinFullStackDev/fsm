'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Button,
  Paper,
  Grid,
  Chip,
  Alert,
  CircularProgress,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Add as AddIcon,
  FolderOpen as FolderIcon,
  TrendingUp as TrendingUpIcon,
  CheckCircle as CheckCircleIcon,
  Assignment as AssignmentIcon,
  People as PeopleIcon,
  Schedule as ScheduleIcon,
  Assessment as AssessmentIcon,
  Business as BusinessIcon,
  Contacts as ContactsIcon,
  Work as WorkIcon,
} from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import WelcomeTour from '@/components/ui/WelcomeTour';
import logger from '@/lib/utils/logger';
import SortableTable from '@/components/dashboard/SortableTable';
import ProjectsMultiLineChart from '@/components/dashboard/ProjectsMultiLineChart';
import EmployeeProjectMapping from '@/components/dashboard/EmployeeProjectMapping';
import { format } from 'date-fns';
import type { Project } from '@/types/project';
import type { ProjectTask } from '@/types/project';
import type { User } from '@/types/project';

export default function DashboardPage() {
  const theme = useTheme();
  const router = useRouter();
  const supabase = createSupabaseClient();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [projectMembers, setProjectMembers] = useState<Array<{ project_id: string; user_id: string; user: User; role?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showWelcomeTour, setShowWelcomeTour] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<'admin' | 'pm' | 'designer' | 'engineer' | null>(null);

  useEffect(() => {
    // Check if user has seen the welcome tour (show first 3 times)
    const tourViewCount = parseInt(localStorage.getItem('welcomeTourViewCount') || '0', 10);
    if (tourViewCount < 3) {
      // Show tour after a short delay to let the page load
      setTimeout(() => {
        setShowWelcomeTour(true);
      }, 1000);
    }

    const loadProjects = async () => {
      // Log debug info from sign-in if available
      const debugInfo = localStorage.getItem('signin_debug');
      if (debugInfo) {
        logger.debug('Sign-in debug info:', JSON.parse(debugInfo));
        localStorage.removeItem('signin_debug');
      }

      // Wait a bit for session to be fully established (especially after redirect)
      await new Promise(resolve => setTimeout(resolve, 200));

      // Single session check to avoid rate limiting
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const session = sessionData?.session;
      
      logger.debug('Dashboard session check:', { 
        hasSession: !!session, 
        userId: session?.user?.id,
        sessionError: sessionError?.message 
      });

      if (!session) {
        logger.error('No session in dashboard, redirecting to sign-in');
        // Check for rate limiting error
        if (sessionError?.message?.includes('rate limit') || sessionError?.status === 429) {
          setError('Too many requests. Please wait a moment and refresh the page.');
        } else {
          setError('Session not found. Please try signing in again.');
        }
        setLoading(false);
        return;
      }

      // Get user record
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, role')
        .eq('auth_id', session.user.id)
        .single();

      logger.debug('User record lookup:', { userData, userError: userError?.message });

      if (userError || !userData) {
        setError('Failed to load user data');
        setLoading(false);
        return;
      }

      // Store current user info
      setCurrentUserId(userData.id);
      setCurrentUserRole(userData.role as 'admin' | 'pm' | 'designer' | 'engineer' | null);

      // Use API route to get projects (handles organization filtering and RLS properly)
      try {
        const response = await fetch('/api/projects?limit=100');
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Failed to load projects' }));
          logger.error('[Dashboard] Failed to load projects:', errorData);
          setError(errorData.message || errorData.error || 'Failed to load projects');
          setLoading(false);
          return;
        }

        const projectsData = await response.json();
        logger.debug('[Dashboard] Projects API response:', { 
          hasData: !!projectsData.data, 
          dataLength: projectsData.data?.length,
          total: projectsData.total 
        });
        const allProjects = projectsData.data || [];
        
        if (allProjects.length === 0) {
          logger.debug('[Dashboard] No projects found for user');
        }

      // Remove duplicates
      const uniqueProjects = Array.from(
        new Map(allProjects.map((p: any) => [p.id, p])).values()
      ) as Project[];
      
      setProjects(uniqueProjects);

      // Load all tasks for user's projects
      const projectIds = uniqueProjects.map((p) => p.id);
      if (projectIds.length > 0) {
        // Use API route or filter by project IDs - tasks inherit org through projects
        const { data: tasksData, error: tasksError } = await supabase
          .from('project_tasks')
          .select('*')
          .in('project_id', projectIds);

        if (tasksError) {
          logger.error('[Dashboard] Error loading tasks:', tasksError);
          setTasks([]);
        } else {
          setTasks((tasksData || []) as ProjectTask[]);
          logger.debug('[Dashboard] Loaded tasks:', { count: tasksData?.length || 0 });
        }
      } else {
        setTasks([]);
      }

      // Load project members
      const { data: membersData, error: membersError } = await supabase
        .from('project_members')
        .select('project_id, user_id, role, users(*)')
        .in('project_id', projectIds.length > 0 ? projectIds : ['']);

      if (!membersError && membersData) {
        const members = membersData.map((m: any) => ({
          project_id: m.project_id,
          user_id: m.user_id,
          role: m.role,
          user: m.users,
        }));
        setProjectMembers(members);

        // Extract unique users
        const uniqueUsers = Array.from(
          new Map(members.map((m: any) => [m.user.id, m.user])).values()
        ) as User[];
        setUsers(uniqueUsers);
      }

      setLoading(false);
      } catch (fetchError) {
        logger.error('[Dashboard] Error fetching projects:', fetchError);
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load projects');
        setLoading(false);
      }
    };

    // Set up auth state listener to handle session initialization after redirect
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string, session: any) => {
      if (event === 'SIGNED_IN' && session) {
        logger.debug('Auth state changed to SIGNED_IN, reloading projects');
        loadProjects();
      }
    });

    loadProjects();

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]); // supabase is a singleton, don't include it in deps

  const handleCreateProject = () => {
    router.push('/project/new');
  };

  const handleViewProjects = () => {
    router.push('/projects');
  };

  // Calculate stats
  const stats = {
    total: projects.length,
    inProgress: projects.filter(p => p.status === 'in_progress').length,
    blueprintReady: projects.filter(p => p.status === 'blueprint_ready').length,
    totalTasks: tasks.length,
    completedTasks: tasks.filter(t => t.status === 'done').length,
    inProgressTasks: tasks.filter(t => t.status === 'in_progress').length,
    todoTasks: tasks.filter(t => t.status === 'todo').length,
    teamMembers: users.length,
    recent: projects.slice(0, 10), // Most recent 10 projects for table
  };

  const completionRate = stats.totalTasks > 0 
    ? Math.round((stats.completedTasks / stats.totalTasks) * 100) 
    : 0;

  if (loading) {
    return (
      <Box>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <Box sx={{ backgroundColor: theme.palette.background.default, minHeight: '100vh', p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Typography
            variant="h4"
            component="h1"
            sx={{
              fontWeight: 700,
              color: theme.palette.text.primary,
            }}
          >
            Dashboard
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateProject}
            sx={{
              backgroundColor: theme.palette.text.primary,
              color: theme.palette.background.default,
              fontWeight: 600,
              '&:hover': {
                backgroundColor: theme.palette.action.hover,
                transform: 'translateY(-2px)',
              },
            }}
          >
            Create Project
          </Button>
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
          >
            {error}
          </Alert>
        )}

        {!error && !loading && projects.length === 0 && (
          <Alert
            severity="info"
            sx={{
              mb: 3,
              backgroundColor: theme.palette.action.hover,
              border: `1px solid ${theme.palette.divider}`,
              color: theme.palette.text.primary,
            }}
          >
            No projects found. Create your first project to get started!
          </Alert>
        )}

        {/* Stats Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Paper
              sx={{
                p: 2,
                backgroundColor: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
                Total Projects
              </Typography>
              <Typography variant="h4" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
                {stats.total}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper
              sx={{
                p: 2,
                backgroundColor: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
                Total Tasks
              </Typography>
              <Typography variant="h4" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
                {stats.totalTasks}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper
              sx={{
                p: 2,
                backgroundColor: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
                Completion Rate
              </Typography>
              <Typography variant="h5" sx={{ color: '#4CAF50', fontWeight: 600 }}>
                {completionRate}%
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper
              sx={{
                p: 2,
                backgroundColor: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
                Team Members
              </Typography>
              <Typography variant="h4" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
                {stats.teamMembers}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper
              sx={{
                p: 2,
                backgroundColor: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
                In Progress Tasks
              </Typography>
              <Typography variant="h4" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
                {stats.inProgressTasks}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper
              sx={{
                p: 2,
                backgroundColor: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
                Completed Tasks
              </Typography>
              <Typography variant="h5" sx={{ color: '#4CAF50', fontWeight: 600 }}>
                {stats.completedTasks}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper
              sx={{
                p: 2,
                backgroundColor: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
                To Do Tasks
              </Typography>
              <Typography variant="h4" sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>
                {stats.todoTasks}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper
              sx={{
                p: 2,
                backgroundColor: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Button
                fullWidth
                variant="outlined"
                onClick={handleViewProjects}
                sx={{
                  borderColor: theme.palette.text.primary,
                  color: theme.palette.text.primary,
                  py: 1.5,
                  '&:hover': {
                    borderColor: theme.palette.text.primary,
                    backgroundColor: theme.palette.action.hover,
                  },
                }}
              >
                View All Projects
              </Button>
            </Paper>
          </Grid>
        </Grid>

        {/* Ops Tool Quick Links */}
        <Box sx={{ mb: 4 }}>
          <Typography
            variant="h6"
            sx={{
              color: theme.palette.text.primary,
              fontWeight: 600,
              mb: 2,
            }}
          >
            Ops Tool
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={4}>
              <Paper
                sx={{
                  p: 2,
                  backgroundColor: theme.palette.background.paper,
                  border: `1px solid ${theme.palette.divider}`,
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  '&:hover': {
                    borderColor: theme.palette.text.primary,
                    backgroundColor: theme.palette.action.hover,
                  },
                }}
                onClick={() => router.push('/ops/companies')}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <BusinessIcon sx={{ fontSize: 32, color: theme.palette.text.primary }} />
                  <Box>
                    <Typography variant="h6" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
                      Companies
                    </Typography>
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                      Manage companies and clients
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Paper
                sx={{
                  p: 2,
                  backgroundColor: theme.palette.background.paper,
                  border: `1px solid ${theme.palette.divider}`,
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  '&:hover': {
                    borderColor: theme.palette.text.primary,
                    backgroundColor: theme.palette.action.hover,
                  },
                }}
                onClick={() => router.push('/ops/opportunities')}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <WorkIcon sx={{ fontSize: 32, color: theme.palette.text.primary }} />
                  <Box>
                    <Typography variant="h6" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
                      Opportunities
                    </Typography>
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                      Track sales opportunities
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Paper
                sx={{
                  p: 2,
                  backgroundColor: theme.palette.background.paper,
                  border: `1px solid ${theme.palette.divider}`,
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  '&:hover': {
                    borderColor: theme.palette.text.primary,
                    backgroundColor: theme.palette.action.hover,
                  },
                }}
                onClick={() => router.push('/ops/contacts')}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <ContactsIcon sx={{ fontSize: 32, color: theme.palette.text.primary }} />
                  <Box>
                    <Typography variant="h6" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
                      Contacts
                    </Typography>
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                      Manage company contacts
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </Box>

        {/* Projects Multi-Line Chart */}
        {projects.length > 0 && (
          <Box sx={{ mb: 4 }}>
            <ProjectsMultiLineChart projects={projects} tasks={tasks} />
          </Box>
        )}

        {/* Employee Project Mapping */}
        {users.length > 0 && (
          <Box sx={{ mb: 4 }}>
            <EmployeeProjectMapping
              projects={projects}
              tasks={tasks}
              users={users}
              projectMembers={projectMembers}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
            />
          </Box>
        )}

        {/* Recent Projects Table */}
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
              Recent Projects
            </Typography>
            {stats.recent.length > 0 && (
              <Button
                size="small"
                onClick={handleViewProjects}
                sx={{ color: theme.palette.text.primary }}
              >
                View All
              </Button>
            )}
          </Box>
          {stats.recent.length > 0 ? (
            <SortableTable
              data={stats.recent}
              columns={[
                {
                  key: 'name',
                  label: 'Project Name',
                  sortable: true,
                  render: (value, row) => (
                    <Typography
                      sx={{
                        color: theme.palette.text.primary,
                        fontWeight: 600,
                        cursor: 'pointer',
                        '&:hover': {
                          textDecoration: 'underline',
                        },
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/project/${row.id}`);
                      }}
                    >
                      {value}
                    </Typography>
                  ),
                },
                {
                  key: 'description',
                  label: 'Description',
                  sortable: true,
                  render: (value) => (
                    <Typography
                      variant="body2"
                      sx={{
                        color: theme.palette.text.secondary,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        maxWidth: 400,
                      }}
                    >
                      {value || 'No description'}
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
                  key: 'updated_at',
                  label: 'Last Updated',
                  sortable: true,
                  render: (value) => (
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                      {value ? format(new Date(value), 'MMM d, yyyy') : 'Never'}
                    </Typography>
                  ),
                },
              ]}
              onRowClick={(row) => router.push(`/project/${row.id}`)}
              emptyMessage="No recent projects"
            />
          ) : (
            <Paper
              sx={{
                p: 4,
                textAlign: 'center',
                backgroundColor: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              <Typography variant="body1" sx={{ color: theme.palette.text.secondary, mb: 2 }}>
                No projects yet. Create your first project to get started!
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleCreateProject}
                sx={{
                  backgroundColor: theme.palette.text.primary,
                  color: theme.palette.background.default,
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover,
                  },
                }}
              >
                Create Project
              </Button>
            </Paper>
          )}
        </Box>
      </Box>
      <WelcomeTour
        open={showWelcomeTour}
        onClose={() => setShowWelcomeTour(false)}
        onComplete={() => {
          // Increment tour view count (show first 3 times)
          const currentCount = parseInt(localStorage.getItem('welcomeTourViewCount') || '0', 10);
          localStorage.setItem('welcomeTourViewCount', String(currentCount + 1));
          setShowWelcomeTour(false);
        }}
      />
    </>
  );
}

