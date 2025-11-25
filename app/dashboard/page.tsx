'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  FolderOpen as FolderIcon,
  TrendingUp as TrendingUpIcon,
  CheckCircle as CheckCircleIcon,
  Assignment as AssignmentIcon,
  People as PeopleIcon,
  Schedule as ScheduleIcon,
  Assessment as AssessmentIcon,
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
    // Check if user has seen the welcome tour
    const hasSeenTour = localStorage.getItem('hasSeenWelcomeTour');
    if (!hasSeenTour) {
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

      // Try multiple times to get session (in case of timing issues)
      let session = null;
      let attempts = 0;
      while (!session && attempts < 5) {
        const { data, error: sessionError } = await supabase.auth.getSession();
        session = data.session;
        
        logger.debug(`Dashboard session check (attempt ${attempts + 1}):`, { 
          hasSession: !!session, 
          userId: session?.user?.id,
          sessionError: sessionError?.message 
        });

        if (!session && attempts < 4) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        attempts++;
      }

      if (!session) {
        logger.error('No session in dashboard after multiple attempts, redirecting to sign-in');
        // Don't redirect immediately - let user see the error
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

      logger.debug('User record lookup:', { userData, userError: userError?.message });

      if (userError || !userData) {
        setError('Failed to load user data');
        setLoading(false);
        return;
      }

      // Store current user info
      setCurrentUserId(userData.id);
      setCurrentUserRole(userData.role as 'admin' | 'pm' | 'designer' | 'engineer' | null);

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

      // Load all tasks for user's projects
      const projectIds = uniqueProjects.map((p) => p.id);
      if (projectIds.length > 0) {
        const { data: tasksData, error: tasksError } = await supabase
          .from('project_tasks')
          .select('*')
          .in('project_id', projectIds);

        if (!tasksError && tasksData) {
          setTasks(tasksData as ProjectTask[]);
        }
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
    };

    // Set up auth state listener to handle session initialization after redirect
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
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
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Typography
            variant="h4"
            component="h1"
            sx={{
              fontWeight: 700,
              background: 'linear-gradient(135deg, #00E5FF 0%, #E91E63 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Dashboard
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateProject}
            sx={{
              backgroundColor: '#00E5FF',
              color: '#000',
              fontWeight: 600,
              '&:hover': {
                backgroundColor: '#00B2CC',
                boxShadow: '0 6px 25px rgba(0, 229, 255, 0.5)',
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
              backgroundColor: 'rgba(255, 23, 68, 0.1)',
              border: '1px solid rgba(255, 23, 68, 0.3)',
              color: '#FF1744',
            }}
          >
            {error}
          </Alert>
        )}

        {/* Stats Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card
              sx={{
                backgroundColor: '#121633',
                border: '1px solid rgba(0, 229, 255, 0.2)',
                borderRadius: 2,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1 }}>
                  <Box>
                    <Typography variant="body2" sx={{ color: '#B0B0B0', mb: 1 }}>
                      Total Projects
                    </Typography>
                    <Typography variant="h4" sx={{ color: '#00E5FF', fontWeight: 700 }}>
                      {stats.total}
                    </Typography>
                  </Box>
                  <FolderIcon sx={{ fontSize: 40, color: '#00E5FF', opacity: 0.5 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card
              sx={{
                backgroundColor: '#121633',
                border: '1px solid rgba(0, 229, 255, 0.2)',
                borderRadius: 2,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1 }}>
                  <Box>
                    <Typography variant="body2" sx={{ color: '#B0B0B0', mb: 1 }}>
                      Total Tasks
                    </Typography>
                    <Typography variant="h4" sx={{ color: '#00E5FF', fontWeight: 700 }}>
                      {stats.totalTasks}
                    </Typography>
                  </Box>
                  <AssignmentIcon sx={{ fontSize: 40, color: '#00E5FF', opacity: 0.5 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card
              sx={{
                backgroundColor: '#121633',
                border: '1px solid rgba(0, 229, 255, 0.2)',
                borderRadius: 2,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1 }}>
                  <Box>
                    <Typography variant="body2" sx={{ color: '#B0B0B0', mb: 1 }}>
                      Completion Rate
                    </Typography>
                    <Typography variant="h4" sx={{ color: '#00FF88', fontWeight: 700 }}>
                      {completionRate}%
                    </Typography>
                  </Box>
                  <CheckCircleIcon sx={{ fontSize: 40, color: '#00FF88', opacity: 0.5 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card
              sx={{
                backgroundColor: '#121633',
                border: '1px solid rgba(0, 229, 255, 0.2)',
                borderRadius: 2,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1 }}>
                  <Box>
                    <Typography variant="body2" sx={{ color: '#B0B0B0', mb: 1 }}>
                      Team Members
                    </Typography>
                    <Typography variant="h4" sx={{ color: '#00E5FF', fontWeight: 700 }}>
                      {stats.teamMembers}
                    </Typography>
                  </Box>
                  <PeopleIcon sx={{ fontSize: 40, color: '#00E5FF', opacity: 0.5 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card
              sx={{
                backgroundColor: '#121633',
                border: '1px solid rgba(0, 229, 255, 0.2)',
                borderRadius: 2,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1 }}>
                  <Box>
                    <Typography variant="body2" sx={{ color: '#B0B0B0', mb: 1 }}>
                      In Progress Tasks
                    </Typography>
                    <Typography variant="h4" sx={{ color: '#00E5FF', fontWeight: 700 }}>
                      {stats.inProgressTasks}
                    </Typography>
                  </Box>
                  <TrendingUpIcon sx={{ fontSize: 40, color: '#00E5FF', opacity: 0.5 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card
              sx={{
                backgroundColor: '#121633',
                border: '1px solid rgba(0, 229, 255, 0.2)',
                borderRadius: 2,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1 }}>
                  <Box>
                    <Typography variant="body2" sx={{ color: '#B0B0B0', mb: 1 }}>
                      Completed Tasks
                    </Typography>
                    <Typography variant="h4" sx={{ color: '#00FF88', fontWeight: 700 }}>
                      {stats.completedTasks}
                    </Typography>
                  </Box>
                  <CheckCircleIcon sx={{ fontSize: 40, color: '#00FF88', opacity: 0.5 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card
              sx={{
                backgroundColor: '#121633',
                border: '1px solid rgba(0, 229, 255, 0.2)',
                borderRadius: 2,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1 }}>
                  <Box>
                    <Typography variant="body2" sx={{ color: '#B0B0B0', mb: 1 }}>
                      To Do Tasks
                    </Typography>
                    <Typography variant="h4" sx={{ color: '#B0B0B0', fontWeight: 700 }}>
                      {stats.todoTasks}
                    </Typography>
                  </Box>
                  <ScheduleIcon sx={{ fontSize: 40, color: '#B0B0B0', opacity: 0.5 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card
              sx={{
                backgroundColor: '#121633',
                border: '1px solid rgba(0, 229, 255, 0.2)',
                borderRadius: 2,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={handleViewProjects}
                  sx={{
                    borderColor: '#00E5FF',
                    color: '#00E5FF',
                    py: 2,
                    '&:hover': {
                      borderColor: '#00E5FF',
                      backgroundColor: 'rgba(0, 229, 255, 0.1)',
                    },
                  }}
                >
                  View All Projects
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Projects Multi-Line Chart */}
        {projects.length > 0 && tasks.length > 0 && (
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
        {stats.recent.length > 0 && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ color: '#E0E0E0', fontWeight: 600 }}>
                Recent Projects
              </Typography>
              <Button
                size="small"
                onClick={handleViewProjects}
                sx={{ color: '#00E5FF' }}
              >
                View All
              </Button>
            </Box>
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
                        color: '#00E5FF',
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
                        color: '#B0B0B0',
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
                        backgroundColor:
                          value === 'blueprint_ready'
                            ? 'rgba(0, 255, 136, 0.15)'
                            : value === 'in_progress'
                            ? 'rgba(0, 229, 255, 0.15)'
                            : 'rgba(176, 176, 176, 0.15)',
                        color:
                          value === 'blueprint_ready'
                            ? '#00FF88'
                            : value === 'in_progress'
                            ? '#00E5FF'
                            : '#B0B0B0',
                        border: `1px solid ${
                          value === 'blueprint_ready'
                            ? 'rgba(0, 255, 136, 0.3)'
                            : value === 'in_progress'
                            ? 'rgba(0, 229, 255, 0.3)'
                            : 'rgba(176, 176, 176, 0.3)'
                        }`,
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
                    <Typography variant="body2" sx={{ color: '#B0B0B0' }}>
                      {value ? format(new Date(value), 'MMM d, yyyy') : 'Never'}
                    </Typography>
                  ),
                },
              ]}
              onRowClick={(row) => router.push(`/project/${row.id}`)}
              emptyMessage="No recent projects"
            />
          </Box>
        )}
      </Box>
      <WelcomeTour
        open={showWelcomeTour}
        onClose={() => setShowWelcomeTour(false)}
        onComplete={() => {
          localStorage.setItem('hasSeenWelcomeTour', 'true');
          setShowWelcomeTour(false);
        }}
      />
    </>
  );
}

