'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  Chip,
  Skeleton,
  Alert,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useRouter } from 'next/navigation';
import { format, isPast, isToday } from 'date-fns';
import type { ProjectTask } from '@/types/project';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

interface TaskWithProject extends ProjectTask {
  project?: {
    id: string;
    name: string;
    organization_id?: string;
  } | Array<{
    id: string;
    name: string;
    organization_id?: string;
  }> | null;
}

interface UserTasksCardProps {
  initialUpcomingTasks?: TaskWithProject[];
  initialOverdueTasks?: TaskWithProject[];
  initialCompletedTasks?: TaskWithProject[];
}

/**
 * UserTasksCard Component
 * Displays user's tasks with tabs for Upcoming, Overdue, and Completed
 */
export default function UserTasksCard({
  initialUpcomingTasks,
  initialOverdueTasks,
  initialCompletedTasks,
}: UserTasksCardProps) {
  const theme = useTheme();
  const router = useRouter();
  const [tabValue, setTabValue] = useState(0);
  const [upcomingTasks, setUpcomingTasks] = useState<TaskWithProject[]>(initialUpcomingTasks || []);
  const [overdueTasks, setOverdueTasks] = useState<TaskWithProject[]>(initialOverdueTasks || []);
  const [completedTasks, setCompletedTasks] = useState<TaskWithProject[]>(initialCompletedTasks || []);
  const [loading, setLoading] = useState(!initialUpcomingTasks);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If initial data is provided, don't fetch
    if (initialUpcomingTasks && initialOverdueTasks && initialCompletedTasks) {
      return;
    }

    const fetchTasks = async () => {
      try {
        setLoading(true);
        // Fetch all task types in parallel
        const [upcomingRes, overdueRes, completedRes] = await Promise.all([
          fetch('/api/my-tasks?status=todo,in_progress&due_date_filter=next_2_weeks&limit=10'),
          fetch('/api/my-tasks?due_date_filter=overdue&limit=10'),
          fetch('/api/my-tasks?status=done&limit=10'),
        ]);

        if (upcomingRes.ok) {
          const data = await upcomingRes.json();
          setUpcomingTasks(data.tasks || []);
        }

        if (overdueRes.ok) {
          const data = await overdueRes.json();
          setOverdueTasks(data.tasks || []);
        }

        if (completedRes.ok) {
          const data = await completedRes.json();
          setCompletedTasks(data.tasks || []);
        }
      } catch (err) {
        setError('Failed to load tasks');
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, [initialUpcomingTasks, initialOverdueTasks, initialCompletedTasks]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleTaskClick = (task: TaskWithProject) => {
    const projectData = Array.isArray(task.project) ? task.project[0] : task.project;
    const projectId = projectData?.id || task.project_id;
    if (projectId) {
      router.push(`/project-management/${projectId}?taskId=${task.id}`);
    }
  };

  const getPriorityColor = (priority: string | undefined) => {
    switch (priority) {
      case 'critical':
        return theme.palette.error.main;
      case 'high':
        return theme.palette.warning.main;
      case 'medium':
        return theme.palette.info.main;
      default:
        return theme.palette.text.secondary;
    }
  };

  const formatDueDate = (dueDate: string | null | undefined) => {
    if (!dueDate) return null;
    const date = new Date(dueDate);
    if (isToday(date)) return 'Today';
    return format(date, 'MMM d');
  };

  const renderTaskList = (tasks: TaskWithProject[], emptyMessage: string) => {
    if (tasks.length === 0) {
      return (
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {emptyMessage}
          </Typography>
        </Box>
      );
    }

    return (
      <List disablePadding>
        {tasks.map((task) => {
          const projectData = Array.isArray(task.project) ? task.project[0] : task.project;
          const isOverdue = task.due_date && isPast(new Date(task.due_date)) && task.status !== 'done';

          return (
            <ListItem
              key={task.id}
              onClick={() => handleTaskClick(task)}
              sx={{
                px: 0,
                py: 1.5,
                cursor: 'pointer',
                borderBottom: `1px solid ${theme.palette.divider}`,
                '&:last-child': { borderBottom: 'none' },
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
                  mx: -2,
                  px: 2,
                },
              }}
            >
              <ListItemText
                primary={
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 500,
                      color: theme.palette.text.primary,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {task.title}
                  </Typography>
                }
                secondary={
                  <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                    {projectData?.name && (
                      <Typography component="span" variant="caption" color="text.secondary">
                        {projectData.name}
                      </Typography>
                    )}
                    {task.due_date && (
                      <Chip
                        label={formatDueDate(task.due_date)}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.65rem',
                          backgroundColor: isOverdue
                            ? theme.palette.error.main + '20'
                            : theme.palette.action.hover,
                          color: isOverdue ? theme.palette.error.main : theme.palette.text.secondary,
                        }}
                      />
                    )}
                  </Box>
                }
                secondaryTypographyProps={{ component: 'div' }}
              />
              {task.priority && task.priority !== 'low' && (
                <Chip
                  label={task.priority}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.65rem',
                    backgroundColor: getPriorityColor(task.priority) + '20',
                    color: getPriorityColor(task.priority),
                    textTransform: 'capitalize',
                  }}
                />
              )}
            </ListItem>
          );
        })}
      </List>
    );
  };

  if (loading) {
    return (
      <Paper
        sx={{
          p: 3,
          backgroundColor: theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`,
          height: '100%',
        }}
      >
        <Skeleton variant="text" width={120} height={32} />
        <Skeleton variant="rectangular" height={40} sx={{ mt: 2 }} />
        <Box sx={{ mt: 2 }}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rectangular" height={60} sx={{ mb: 1 }} />
          ))}
        </Box>
      </Paper>
    );
  }

  if (error) {
    return (
      <Paper
        sx={{
          p: 3,
          backgroundColor: theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`,
          height: '100%',
        }}
      >
        <Alert severity="error">{error}</Alert>
      </Paper>
    );
  }

  return (
    <Paper
      sx={{
        p: 3,
        backgroundColor: theme.palette.background.paper,
        border: `1px solid ${theme.palette.divider}`,
        height: '100%',
      }}
    >
      <Typography
        variant="h6"
        sx={{
          fontWeight: 600,
          color: theme.palette.text.primary,
          mb: 2,
        }}
      >
        My Tasks
      </Typography>

      <Tabs
        value={tabValue}
        onChange={handleTabChange}
        sx={{
          minHeight: 36,
          '& .MuiTab-root': {
            minHeight: 36,
            py: 0,
            px: 2,
            fontSize: '0.8rem',
            textTransform: 'none',
          },
        }}
      >
        <Tab
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              Upcoming
              {upcomingTasks.length > 0 && (
                <Chip
                  label={upcomingTasks.length}
                  size="small"
                  sx={{ height: 18, fontSize: '0.65rem', ml: 0.5 }}
                />
              )}
            </Box>
          }
        />
        <Tab
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              Overdue
              {overdueTasks.length > 0 && (
                <Chip
                  label={overdueTasks.length}
                  size="small"
                  color="error"
                  sx={{ height: 18, fontSize: '0.65rem', ml: 0.5 }}
                />
              )}
            </Box>
          }
        />
        <Tab
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              Completed
              {completedTasks.length > 0 && (
                <Chip
                  label={completedTasks.length}
                  size="small"
                  sx={{ height: 18, fontSize: '0.65rem', ml: 0.5 }}
                />
              )}
            </Box>
          }
        />
      </Tabs>

      <TabPanel value={tabValue} index={0}>
        {renderTaskList(upcomingTasks, 'No upcoming tasks')}
      </TabPanel>
      <TabPanel value={tabValue} index={1}>
        {renderTaskList(overdueTasks, 'No overdue tasks - great job!')}
      </TabPanel>
      <TabPanel value={tabValue} index={2}>
        {renderTaskList(completedTasks, 'No completed tasks yet')}
      </TabPanel>
    </Paper>
  );
}

