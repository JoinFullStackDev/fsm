'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { format, parseISO, addDays, isBefore, isAfter, startOfDay } from 'date-fns';
import { createSupabaseClient } from '@/lib/supabaseClient';
import { PRIORITY_COLORS } from '@/lib/constants';
import SortableTable from '@/components/dashboard/SortableTable';
import type { ProjectTask } from '@/types/project';
import type { Project } from '@/types/project';

export default function MyTasksPage() {
  const theme = useTheme();
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

  const columns = [
    {
      key: 'title',
      label: 'Task',
      sortable: true,
      render: (value: string, row: ProjectTask) => {
        const project = projects.find((p) => p.id === row.project_id);
        return (
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
              {value}
            </Typography>
            {row.description && (
              <Typography variant="caption" sx={{ color: theme.palette.text.secondary, display: 'block', mt: 0.5 }}>
                {row.description.length > 100
                  ? `${row.description.substring(0, 100)}...`
                  : row.description}
              </Typography>
            )}
          </Box>
        );
      },
    },
    {
      key: 'project_id',
      label: 'Project',
      sortable: false,
      render: (value: string) => {
        const project = projects.find((p) => p.id === value);
        return (
          <Typography variant="body2" sx={{ color: theme.palette.text.primary }}>
            {project?.name || 'Unknown Project'}
          </Typography>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      align: 'center' as const,
      render: (value: string) => (
        <Chip
          label={getStatusLabel(value || 'todo')}
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
      key: 'priority',
      label: 'Priority',
      sortable: true,
      align: 'center' as const,
      render: (value: string) => {
        const priorityColor = PRIORITY_COLORS[value as keyof typeof PRIORITY_COLORS] || '#00E5FF';
        return (
          <Chip
            label={value || 'Medium'}
            size="small"
            sx={{
              backgroundColor: `${priorityColor}20`,
              color: priorityColor,
              border: `1px solid ${priorityColor}40`,
              fontWeight: 600,
            }}
          />
        );
      },
    },
    {
      key: 'due_date',
      label: 'Due Date',
      sortable: true,
      render: (value: string, row: ProjectTask) => {
        if (!value) return <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>-</Typography>;
        const dueDate = parseISO(value);
        const isOverdue = isBefore(dueDate, new Date()) && row.status !== 'done';
        return (
          <Box>
            <Typography 
              variant="body2" 
              sx={{ 
                color: isOverdue ? theme.palette.error.main : theme.palette.text.secondary, 
                fontWeight: isOverdue ? 600 : 400 
              }}
            >
              {format(dueDate, 'MMM d, yyyy')}
            </Typography>
            {isOverdue && (
              <Typography variant="caption" sx={{ color: theme.palette.error.main, display: 'block', mt: 0.5 }}>
                Overdue
              </Typography>
            )}
          </Box>
        );
      },
    },
  ];

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress sx={{ color: theme.palette.text.primary }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ mt: 4 }}>
        <Alert 
          severity="error"
          sx={{
            backgroundColor: theme.palette.action.hover,
            border: `1px solid ${theme.palette.divider}`,
            color: theme.palette.text.primary,
          }}
        >
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h4"
          component="h1"
          sx={{
            fontSize: '1.5rem',
            fontWeight: 600,
            color: theme.palette.text.primary,
            mb: 1,
          }}
        >
          My Tasks - Next 2 Weeks
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: theme.palette.text.secondary,
          }}
        >
          Tasks due between {format(dateRange.start, 'MMM d')} and {format(dateRange.end, 'MMM d, yyyy')}
        </Typography>
      </Box>

      {tasks.length === 0 ? (
        <Box sx={{ py: 8, textAlign: 'center' }}>
          <Typography variant="body1" sx={{ color: theme.palette.text.secondary }}>
            No tasks due in the next 2 weeks. You&apos;re all caught up!
          </Typography>
        </Box>
      ) : (
        <SortableTable
          data={tasks}
          columns={columns}
          onRowClick={handleTaskClick}
          emptyMessage="No tasks found"
        />
      )}
    </Box>
  );
}

