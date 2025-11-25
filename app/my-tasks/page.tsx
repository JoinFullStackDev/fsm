'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
  Container,
} from '@mui/material';
import { format, parseISO, addDays, isBefore, isAfter, startOfDay } from 'date-fns';
import { createSupabaseClient } from '@/lib/supabaseClient';
import { PRIORITY_COLORS } from '@/lib/constants';
import type { ProjectTask } from '@/types/project';
import type { Project } from '@/types/project';

export default function MyTasksPage() {
  const router = useRouter();
  const supabase = createSupabaseClient();
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calculate date range: today to 14 days from today
  const dateRange = useMemo(() => {
    const today = startOfDay(new Date());
    const twoWeeksFromNow = addDays(today, 14);
    return { start: today, end: twoWeeksFromNow };
  }, []);

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current user
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('You must be logged in to view your tasks');
        setLoading(false);
        return;
      }

      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', session.user.id)
        .single();

      if (!userData) {
        setError('User not found');
        setLoading(false);
        return;
      }

      // Get all projects user is a member of
      const { data: ownedProjects } = await supabase
        .from('projects')
        .select('id, name')
        .eq('owner_id', userData.id);

      const { data: memberProjects } = await supabase
        .from('project_members')
        .select('project_id, projects(id, name)')
        .eq('user_id', userData.id);

      const allProjectIds = new Set<string>();
      const projectMap = new Map<string, { id: string; name: string }>();

      (ownedProjects || []).forEach((p: { id: string; name: string }) => {
        allProjectIds.add(p.id);
        projectMap.set(p.id, p);
      });

      (memberProjects || []).forEach((mp: any) => {
        if (mp.projects) {
          allProjectIds.add(mp.projects.id);
          projectMap.set(mp.projects.id, mp.projects);
        }
      });

      setProjects(Array.from(projectMap.values()));

      if (allProjectIds.size === 0) {
        setTasks([]);
        setLoading(false);
        return;
      }

      // Get tasks assigned to user with due dates in the next 2 weeks
      const { data: tasksData, error: tasksError } = await supabase
        .from('project_tasks')
        .select('*')
        .in('project_id', Array.from(allProjectIds))
        .eq('assignee_id', userData.id)
        .in('status', ['todo', 'in_progress'])
        .not('due_date', 'is', null)
        .order('due_date', { ascending: true })
        .order('priority', { ascending: false });

      if (tasksError) {
        setError(tasksError.message);
        setLoading(false);
        return;
      }

      // Filter tasks to only include those with due dates in the next 2 weeks
      const filteredTasks = (tasksData || []).filter((task) => {
        if (!task.due_date) return false;
        const dueDate = startOfDay(parseISO(task.due_date));
        return (
          !isBefore(dueDate, dateRange.start) &&
          !isAfter(dueDate, dateRange.end)
        );
      });

      setTasks(filteredTasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [supabase, dateRange]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done':
        return '#00FF88';
      case 'in_progress':
        return '#00E5FF';
      case 'todo':
        return '#B0B0B0';
      default:
        return '#B0B0B0';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'done':
        return 'Completed';
      case 'in_progress':
        return 'In Progress';
      case 'todo':
        return 'To Do';
      default:
        return status;
    }
  };

  const handleTaskClick = (task: ProjectTask) => {
    router.push(`/project-management/${task.project_id}?taskId=${task.id}`);
  };

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Paper
        sx={{
          backgroundColor: '#000',
          border: '2px solid rgba(0, 229, 255, 0.2)',
          borderRadius: 2,
          p: 3,
        }}
      >
        <Box sx={{ mb: 3 }}>
          <Typography
            variant="h5"
            sx={{
              color: '#00E5FF',
              fontWeight: 600,
              mb: 1,
            }}
          >
            My Tasks - Next 2 Weeks
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: '#B0B0B0',
            }}
          >
            Tasks due between {format(dateRange.start, 'MMM d')} and {format(dateRange.end, 'MMM d, yyyy')}
          </Typography>
        </Box>

        {tasks.length === 0 ? (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <Typography variant="body1" sx={{ color: '#B0B0B0' }}>
              No tasks due in the next 2 weeks. You&apos;re all caught up!
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead sx={{ backgroundColor: '#000' }}>
                <TableRow>
                  <TableCell sx={{ backgroundColor: '#000', color: '#00E5FF', fontWeight: 600, borderBottom: '2px solid rgba(0, 229, 255, 0.2)' }}>
                    Task
                  </TableCell>
                  <TableCell sx={{ backgroundColor: '#000', color: '#00E5FF', fontWeight: 600, borderBottom: '2px solid rgba(0, 229, 255, 0.2)' }}>
                    Project
                  </TableCell>
                  <TableCell sx={{ backgroundColor: '#000', color: '#00E5FF', fontWeight: 600, borderBottom: '2px solid rgba(0, 229, 255, 0.2)', textAlign: 'center' }}>
                    Status
                  </TableCell>
                  <TableCell sx={{ backgroundColor: '#000', color: '#00E5FF', fontWeight: 600, borderBottom: '2px solid rgba(0, 229, 255, 0.2)', textAlign: 'center' }}>
                    Priority
                  </TableCell>
                  <TableCell sx={{ backgroundColor: '#000', color: '#00E5FF', fontWeight: 600, borderBottom: '2px solid rgba(0, 229, 255, 0.2)' }}>
                    Due Date
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tasks.map((task) => {
                  const project = projects.find((p) => p.id === task.project_id);
                  const dueDate = task.due_date ? parseISO(task.due_date) : null;
                  const isOverdue = dueDate && isBefore(dueDate, new Date()) && task.status !== 'done';

                  return (
                    <TableRow
                      key={task.id}
                      onClick={() => handleTaskClick(task)}
                      sx={{
                        cursor: 'pointer',
                        '&:hover': {
                          backgroundColor: 'rgba(0, 229, 255, 0.05)',
                        },
                      }}
                    >
                      <TableCell sx={{ color: '#E0E0E0' }}>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {task.title}
                        </Typography>
                        {task.description && (
                          <Typography variant="caption" sx={{ color: '#B0B0B0', display: 'block', mt: 0.5 }}>
                            {task.description.length > 100
                              ? `${task.description.substring(0, 100)}...`
                              : task.description}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ color: '#E0E0E0' }}>
                        {project?.name || 'Unknown Project'}
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={getStatusLabel(task.status || 'todo')}
                          size="small"
                          sx={{
                            backgroundColor: `${getStatusColor(task.status || 'todo')}20`,
                            color: getStatusColor(task.status || 'todo'),
                            border: `1px solid ${getStatusColor(task.status || 'todo')}40`,
                            fontWeight: 600,
                          }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={task.priority || 'Medium'}
                          size="small"
                          sx={{
                            backgroundColor: `${PRIORITY_COLORS[task.priority as keyof typeof PRIORITY_COLORS] || '#00E5FF'}20`,
                            color: PRIORITY_COLORS[task.priority as keyof typeof PRIORITY_COLORS] || '#00E5FF',
                            border: `1px solid ${PRIORITY_COLORS[task.priority as keyof typeof PRIORITY_COLORS] || '#00E5FF'}40`,
                            fontWeight: 600,
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ color: isOverdue ? '#FF1744' : '#E0E0E0', fontWeight: isOverdue ? 600 : 400 }}>
                        {dueDate ? format(dueDate, 'MMM d, yyyy') : '-'}
                        {isOverdue && (
                          <Typography variant="caption" sx={{ color: '#FF1744', display: 'block', mt: 0.5 }}>
                            Overdue
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Container>
  );
}

