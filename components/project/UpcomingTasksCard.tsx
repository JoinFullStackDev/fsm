'use client';

import { useRouter } from 'next/navigation';
import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
  Stack,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  ArrowForward as ArrowForwardIcon,
  Assignment as AssignmentIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { format, parseISO, isToday, isTomorrow, isPast } from 'date-fns';
import { PRIORITY_COLORS } from '@/lib/constants';

interface UpcomingTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  assignee?: {
    id: string;
    name: string | null;
    avatar_url: string | null;
  } | null;
}

interface UpcomingTasksCardProps {
  tasks: UpcomingTask[];
  projectId: string;
  onTaskClick?: (task: UpcomingTask) => void;
}

export default function UpcomingTasksCard({
  tasks,
  projectId,
  onTaskClick,
}: UpcomingTasksCardProps) {
  const theme = useTheme();
  const router = useRouter();

  const formatDueDate = (dateString: string | null) => {
    if (!dateString) return null;
    try {
      const date = parseISO(dateString);
      if (isToday(date)) return 'Today';
      if (isTomorrow(date)) return 'Tomorrow';
      return format(date, 'MMM d');
    } catch {
      return null;
    }
  };

  const isOverdue = (dateString: string | null, status: string) => {
    if (!dateString || status === 'done') return false;
    try {
      return isPast(parseISO(dateString));
    } catch {
      return false;
    }
  };

  const handleTaskClick = (task: UpcomingTask) => {
    if (onTaskClick) {
      onTaskClick(task);
    } else {
      // Navigate to task detail in project management
      router.push(`/project-management/${projectId}?taskId=${task.id}`);
    }
  };

  const handleViewAll = () => {
    router.push(`/project-management/${projectId}`);
  };

  // Don't render if no tasks
  if (tasks.length === 0) {
    return null;
  }

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, md: 3 },
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 3,
        backgroundColor: theme.palette.background.paper,
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography
            variant="h6"
            sx={{
              color: theme.palette.text.primary,
              fontWeight: 600,
              fontSize: { xs: '1rem', md: '1.25rem' },
            }}
          >
            Upcoming Tasks
          </Typography>
          <Chip
            label={tasks.length}
            size="small"
            sx={{
              backgroundColor: theme.palette.action.hover,
              color: theme.palette.text.primary,
              fontWeight: 700,
              fontSize: '0.75rem',
              minWidth: 28,
            }}
          />
        </Box>
        <Button
          size="small"
          endIcon={<ArrowForwardIcon />}
          onClick={handleViewAll}
          sx={{
            color: theme.palette.text.primary,
            textTransform: 'none',
            '&:hover': {
              backgroundColor: theme.palette.action.hover,
            },
          }}
        >
          View All
        </Button>
      </Box>

      {/* Task List */}
      <Stack spacing={1}>
        {tasks.map((task) => {
          const dueLabel = formatDueDate(task.due_date);
          const overdue = isOverdue(task.due_date, task.status);
          const priorityColor =
            PRIORITY_COLORS[task.priority as keyof typeof PRIORITY_COLORS] ||
            PRIORITY_COLORS.medium;

          return (
            <Box
              key={task.id}
              onClick={() => handleTaskClick(task)}
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1.5,
                p: 1.5,
                borderRadius: 1.5,
                cursor: 'pointer',
                border: `1px solid transparent`,
                transition: 'all 0.15s ease',
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
                  borderColor: theme.palette.divider,
                },
              }}
            >
              {/* Priority Indicator */}
              <Box
                sx={{
                  width: 4,
                  height: '100%',
                  minHeight: 32,
                  borderRadius: 2,
                  backgroundColor: priorityColor,
                  flexShrink: 0,
                }}
              />

              {/* Task Content */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 500,
                    color: theme.palette.text.primary,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    mb: 0.5,
                  }}
                >
                  {task.title}
                </Typography>

                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    flexWrap: 'wrap',
                  }}
                >
                  {/* Status Chip */}
                  <Chip
                    label={task.status === 'in_progress' ? 'In Progress' : 'To Do'}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.65rem',
                      fontWeight: 500,
                      backgroundColor:
                        task.status === 'in_progress'
                          ? `${theme.palette.info.main}20`
                          : theme.palette.action.hover,
                      color:
                        task.status === 'in_progress'
                          ? theme.palette.info.main
                          : theme.palette.text.secondary,
                      border: 'none',
                    }}
                  />

                  {/* Due Date */}
                  {dueLabel && (
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                      }}
                    >
                      <ScheduleIcon
                        sx={{
                          fontSize: 12,
                          color: overdue
                            ? theme.palette.error.main
                            : theme.palette.text.secondary,
                        }}
                      />
                      <Typography
                        variant="caption"
                        sx={{
                          color: overdue
                            ? theme.palette.error.main
                            : theme.palette.text.secondary,
                          fontWeight: overdue ? 600 : 400,
                          fontSize: '0.7rem',
                        }}
                      >
                        {overdue ? 'Overdue' : dueLabel}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            </Box>
          );
        })}
      </Stack>

      {/* Empty state message if needed */}
      {tasks.length === 0 && (
        <Box
          sx={{
            py: 3,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <AssignmentIcon
            sx={{ fontSize: 32, color: theme.palette.text.secondary, opacity: 0.5 }}
          />
          <Typography variant="body2" color="text.secondary">
            No upcoming tasks
          </Typography>
        </Box>
      )}
    </Paper>
  );
}

