'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Box,
  Typography,
  Paper,
  Grid,
  CircularProgress,
  Alert,
  Avatar,
  Chip,
  IconButton,
  LinearProgress,
  Tooltip,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Divider,
  Tabs,
  Tab,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  ArrowBack as ArrowBackIcon,
  Groups as GroupsIcon,
  Assignment as TaskIcon,
  Folder as ProjectIcon,
  Schedule as ScheduleIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Dashboard as DashboardIcon,
  ViewKanban as KanbanIcon,
} from '@mui/icons-material';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import WorkloadIndicator from '@/components/projects/WorkloadIndicator';
import TeamKanbanBoard from '@/components/teams/TeamKanbanBoard';
import TaskDetailSheet from '@/components/project-management/TaskDetailSheet';
import type { ProjectTask, ProjectTaskExtended, User } from '@/types/project';

interface TeamTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  assignee_id: string | null;
  project_id: string;
  phase_number?: number | null;
  parent_task_id?: string | null;
  tags?: string[];
  estimated_hours?: number | null;
  project?: {
    id: string;
    name: string;
  };
  assignee?: {
    id: string;
    name: string | null;
    email: string;
    avatar_url?: string | null;
  } | null;
}

interface TeamMember {
  id: string;
  user_id: string;
  user: { id: string; name: string | null; email: string } | null;
}

interface TeamBoardData {
  team: {
    id: string;
    name: string;
    description: string | null;
    color: string;
    members: TeamMember[];
    member_count: number;
  };
  tasks: TeamTask[];
  tasks_by_status: {
    todo: number;
    in_progress: number;
    review: number;
    blocked: number;
  };
  tasks_due_soon: TeamTask[];
  projects: Array<{
    id: string;
    name: string;
    status: string;
  }>;
  workloads: Array<{
    user_id: string;
    max_hours_per_week: number;
    default_hours_per_week: number;
    allocated_hours_per_week: number;
    available_hours_per_week: number;
    utilization_percentage: number;
    is_over_allocated: boolean;
    start_date: string;
    end_date: string;
  }>;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`team-tabpanel-${index}`}
      aria-labelledby={`team-tab-${index}`}
      {...other}
    >
      {value === index && <Box>{children}</Box>}
    </div>
  );
}

export default function TeamBoardPage() {
  const router = useRouter();
  const params = useParams();
  const teamId = params.id as string;
  const theme = useTheme();
  const [boardData, setBoardData] = useState<TeamBoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  
  // Task detail sheet state
  const [selectedTask, setSelectedTask] = useState<TeamTask | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [projectMembers, setProjectMembers] = useState<User[]>([]);
  const [projectTasks, setProjectTasks] = useState<(ProjectTask | ProjectTaskExtended)[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  const loadBoardData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/teams/${teamId}/board?include_done=true`);
      if (!response.ok) throw new Error('Failed to load team board');
      const data = await response.json();
      setBoardData(data);
      setError(null);
    } catch (err) {
      setError('Failed to load team board');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  // Get current user ID
  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const data = await response.json();
          setCurrentUserId(data.user?.id || '');
        }
      } catch (err) {
        console.error('Failed to get current user:', err);
      }
    };
    getCurrentUser();
  }, []);

  useEffect(() => {
    loadBoardData();
  }, [loadBoardData]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // Handle task click - load project members and open sheet
  const handleTaskClick = async (task: TeamTask) => {
    setSelectedTask(task);
    
    // Load project members for the task's project
    try {
      const response = await fetch(`/api/projects/${task.project_id}/members`);
      if (response.ok) {
        const data = await response.json();
        // Transform members to User format
        const members: User[] = (data.members || []).map((m: any) => ({
          id: m.user?.id || m.user_id,
          auth_id: '',
          email: m.user?.email || '',
          name: m.user?.name || null,
          role: 'pm' as const,
          avatar_url: m.user?.avatar_url || null,
          created_at: '',
        }));
        setProjectMembers(members);
      }
      
      // Load project tasks for parent task selection
      const tasksResponse = await fetch(`/api/projects/${task.project_id}/tasks`);
      if (tasksResponse.ok) {
        const tasksData = await tasksResponse.json();
        setProjectTasks(tasksData || []);
      }
    } catch (err) {
      console.error('Failed to load project data:', err);
    }
    
    setSheetOpen(true);
  };

  const handleSheetClose = () => {
    setSheetOpen(false);
    setSelectedTask(null);
    setProjectMembers([]);
    setProjectTasks([]);
  };

  const handleTaskSave = async (updatedTask: Partial<ProjectTask>) => {
    if (!selectedTask) return;
    
    try {
      const response = await fetch(`/api/projects/${selectedTask.project_id}/tasks/${selectedTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedTask),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update task');
      }
      
      // Reload board data to reflect changes
      await loadBoardData();
      handleSheetClose();
    } catch (err) {
      console.error('Failed to save task:', err);
      throw err;
    }
  };

  const handleTaskDelete = async (taskId: string) => {
    if (!selectedTask) return;
    
    try {
      const response = await fetch(`/api/projects/${selectedTask.project_id}/tasks/${taskId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete task');
      }
      
      // Reload board data
      await loadBoardData();
      handleSheetClose();
    } catch (err) {
      console.error('Failed to delete task:', err);
      throw err;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'todo':
        return theme.palette.grey[500];
      case 'in_progress':
        return theme.palette.info.main;
      case 'review':
        return theme.palette.warning.main;
      case 'blocked':
        return theme.palette.error.main;
      case 'done':
        return theme.palette.success.main;
      default:
        return theme.palette.grey[500];
    }
  };

  const getMemberName = (userId: string) => {
    const member = boardData?.team.members.find((m) => m.user_id === userId);
    return member?.user?.name || member?.user?.email || 'Unknown';
  };

  const getMemberWorkload = (userId: string) => {
    return boardData?.workloads.find((w) => w.user_id === userId);
  };

  // Convert TeamTask to ProjectTaskExtended for TaskDetailSheet
  const convertToProjectTask = (task: TeamTask): ProjectTaskExtended => {
    return {
      id: task.id,
      project_id: task.project_id,
      title: task.title,
      description: task.description,
      status: task.status as any,
      priority: task.priority as any,
      due_date: task.due_date,
      start_date: null,
      assignee_id: task.assignee_id,
      phase_number: task.phase_number || null,
      parent_task_id: task.parent_task_id || null,
      tags: task.tags || [],
      notes: null,
      dependencies: [],
      ai_generated: false,
      ai_analysis_id: null,
      estimated_hours: task.estimated_hours || null,
      created_at: '',
      updated_at: '',
      assignee: task.assignee ? {
        id: task.assignee.id,
        name: task.assignee.name,
        email: task.assignee.email,
        avatar_url: task.assignee.avatar_url || null,
      } : undefined,
    };
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !boardData) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error || 'Team not found'}</Alert>
      </Box>
    );
  }

  const { team, tasks, tasks_by_status, tasks_due_soon, projects, workloads } = boardData;
  const totalActiveTasks = tasks_by_status.todo + tasks_by_status.in_progress + tasks_by_status.review + tasks_by_status.blocked;
  const avgUtilization = workloads.length > 0
    ? workloads.reduce((sum, w) => sum + w.utilization_percentage, 0) / workloads.length
    : 0;
  const overAllocatedCount = workloads.filter((w) => w.is_over_allocated).length;

  return (
    <Box sx={{ backgroundColor: theme.palette.background.default, minHeight: '100vh', pb: 4 }}>
      <Box sx={{ maxWidth: 1600, mx: 'auto', px: 3, pt: 4 }}>
        <Breadcrumbs
          items={[
            { label: 'Teams', href: '/teams' },
            { label: team.name },
          ]}
        />

        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <IconButton
            onClick={() => router.push('/teams')}
            sx={{
              color: theme.palette.text.primary,
              border: `1px solid ${theme.palette.divider}`,
              '&:hover': { backgroundColor: theme.palette.action.hover },
            }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              backgroundColor: team.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <GroupsIcon sx={{ color: '#fff', fontSize: 28 }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h4" sx={{ fontWeight: 700, color: theme.palette.text.primary }}>
              {team.name}
            </Typography>
            {team.description && (
              <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                {team.description}
              </Typography>
            )}
          </Box>
          <Chip
            label={`${team.member_count} member${team.member_count !== 1 ? 's' : ''}`}
            sx={{ backgroundColor: team.color, color: '#fff' }}
          />
        </Box>

        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange}
            sx={{
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 500,
                minHeight: 48,
              },
            }}
          >
            <Tab 
              icon={<DashboardIcon />} 
              iconPosition="start" 
              label="Overview" 
              id="team-tab-0"
              aria-controls="team-tabpanel-0"
            />
            <Tab 
              icon={<KanbanIcon />} 
              iconPosition="start" 
              label="Kanban Board" 
              id="team-tab-1"
              aria-controls="team-tabpanel-1"
            />
          </Tabs>
        </Box>

        {/* Overview Tab */}
        <TabPanel value={tabValue} index={0}>
          {/* Stats Cards */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 3, border: `1px solid ${theme.palette.divider}`, borderRadius: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <TaskIcon sx={{ color: theme.palette.primary.main, fontSize: 32 }} />
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>{totalActiveTasks}</Typography>
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>Active Tasks</Typography>
                  </Box>
                </Box>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 3, border: `1px solid ${theme.palette.divider}`, borderRadius: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <ProjectIcon sx={{ color: theme.palette.info.main, fontSize: 32 }} />
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>{projects.length}</Typography>
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>Projects</Typography>
                  </Box>
                </Box>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 3, border: `1px solid ${theme.palette.divider}`, borderRadius: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <ScheduleIcon sx={{ color: theme.palette.warning.main, fontSize: 32 }} />
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>{tasks_due_soon.length}</Typography>
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>Due This Week</Typography>
                  </Box>
                </Box>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 3, border: `1px solid ${theme.palette.divider}`, borderRadius: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  {overAllocatedCount > 0 ? (
                    <WarningIcon sx={{ color: theme.palette.error.main, fontSize: 32 }} />
                  ) : (
                    <CheckCircleIcon sx={{ color: theme.palette.success.main, fontSize: 32 }} />
                  )}
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>{avgUtilization.toFixed(0)}%</Typography>
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                      Avg Utilization
                      {overAllocatedCount > 0 && (
                        <Chip label={`${overAllocatedCount} over`} size="small" color="error" sx={{ ml: 1, height: 18 }} />
                      )}
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            </Grid>
          </Grid>

          <Grid container spacing={3}>
            {/* Team Members */}
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 3, border: `1px solid ${theme.palette.divider}`, borderRadius: 2, height: '100%' }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Team Members</Typography>
                <List>
                  {team.members.map((member, index) => {
                    const workload = getMemberWorkload(member.user_id);
                    return (
                      <Box key={member.id}>
                        {index > 0 && <Divider />}
                        <ListItem sx={{ px: 0 }}>
                          <ListItemAvatar>
                            <Avatar sx={{ bgcolor: team.color }}>
                              {(member.user?.name || member.user?.email || '?')[0].toUpperCase()}
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={member.user?.name || 'Unnamed'}
                            secondary={member.user?.email}
                            primaryTypographyProps={{ fontWeight: 500 }}
                          />
                          <WorkloadIndicator workload={workload} size="small" />
                        </ListItem>
                      </Box>
                    );
                  })}
                </List>
              </Paper>
            </Grid>

            {/* Task Status Breakdown */}
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 3, border: `1px solid ${theme.palette.divider}`, borderRadius: 2, height: '100%' }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Task Status</Typography>
                {[
                  { label: 'To Do', count: tasks_by_status.todo, color: theme.palette.grey[500] },
                  { label: 'In Progress', count: tasks_by_status.in_progress, color: theme.palette.info.main },
                  { label: 'In Review', count: tasks_by_status.review, color: theme.palette.warning.main },
                  { label: 'Blocked', count: tasks_by_status.blocked, color: theme.palette.error.main },
                ].map((item) => (
                  <Box key={item.label} sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2">{item.label}</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{item.count}</Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={totalActiveTasks > 0 ? (item.count / totalActiveTasks) * 100 : 0}
                      sx={{
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: theme.palette.action.hover,
                        '& .MuiLinearProgress-bar': { backgroundColor: item.color, borderRadius: 4 },
                      }}
                    />
                  </Box>
                ))}
              </Paper>
            </Grid>

            {/* Projects */}
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 3, border: `1px solid ${theme.palette.divider}`, borderRadius: 2, height: '100%' }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Active Projects</Typography>
                {projects.length === 0 ? (
                  <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                    No active projects
                  </Typography>
                ) : (
                  <List>
                    {projects.map((project, index) => (
                      <Box key={project.id}>
                        {index > 0 && <Divider />}
                        <ListItem
                          sx={{ px: 0, cursor: 'pointer' }}
                          onClick={() => router.push(`/project/${project.id}`)}
                        >
                          <ListItemAvatar>
                            <Avatar sx={{ bgcolor: theme.palette.info.main }}>
                              <ProjectIcon />
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={project.name}
                            secondary={project.status.replace('_', ' ')}
                            primaryTypographyProps={{ fontWeight: 500 }}
                          />
                        </ListItem>
                      </Box>
                    ))}
                  </List>
                )}
              </Paper>
            </Grid>

            {/* Recent Tasks */}
            <Grid item xs={12}>
              <Paper sx={{ p: 3, border: `1px solid ${theme.palette.divider}`, borderRadius: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Recent Tasks</Typography>
                {tasks.length === 0 ? (
                  <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                    No active tasks assigned to team members
                  </Typography>
                ) : (
                  <Grid container spacing={2}>
                    {tasks.slice(0, 9).map((task) => (
                      <Grid item xs={12} sm={6} md={4} key={task.id}>
                        <Card
                          variant="outlined"
                          sx={{
                            cursor: 'pointer',
                            '&:hover': { borderColor: theme.palette.primary.main },
                          }}
                          onClick={() => handleTaskClick(task)}
                        >
                          <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                              <Typography
                                variant="body2"
                                sx={{
                                  fontWeight: 600,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  flex: 1,
                                }}
                              >
                                {task.title}
                              </Typography>
                              <Chip
                                label={task.status.replace('_', ' ')}
                                size="small"
                                sx={{
                                  height: 20,
                                  fontSize: '0.65rem',
                                  ml: 1,
                                  backgroundColor: getStatusColor(task.status),
                                  color: '#fff',
                                }}
                              />
                            </Box>
                            <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                              {task.project?.name || 'Unknown project'}
                            </Typography>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                              <Tooltip title={task.assignee_id ? getMemberName(task.assignee_id) : 'Unassigned'}>
                                <Avatar sx={{ width: 24, height: 24, fontSize: '0.7rem', bgcolor: team.color }}>
                                  {task.assignee_id ? getMemberName(task.assignee_id)[0].toUpperCase() : '?'}
                                </Avatar>
                              </Tooltip>
                              {task.due_date && (
                                <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                                  Due {new Date(task.due_date).toLocaleDateString()}
                                </Typography>
                              )}
                            </Box>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                )}
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Kanban Tab */}
        <TabPanel value={tabValue} index={1}>
          <Paper sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 2, overflow: 'hidden' }}>
            <TeamKanbanBoard
              tasks={tasks}
              teamMembers={team.members}
              projects={projects}
              teamColor={team.color}
              onTaskClick={handleTaskClick}
            />
          </Paper>
        </TabPanel>
      </Box>

      {/* Task Detail Sheet */}
      {selectedTask && (
        <TaskDetailSheet
          open={sheetOpen}
          task={convertToProjectTask(selectedTask)}
          projectId={selectedTask.project_id}
          projectMembers={projectMembers}
          allTasks={projectTasks}
          currentUserId={currentUserId}
          onClose={handleSheetClose}
          onSave={handleTaskSave}
          onDelete={handleTaskDelete}
        />
      )}
    </Box>
  );
}
