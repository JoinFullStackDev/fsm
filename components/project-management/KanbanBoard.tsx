'use client';

import { useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  Avatar,
  Tooltip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { ProjectTask, ProjectTaskExtended, TaskStatus } from '@/types/project';

interface KanbanBoardProps {
  tasks: (ProjectTask | ProjectTaskExtended)[];
  onTaskClick: (task: ProjectTask | ProjectTaskExtended) => void;
}

// Muted status colors that work well with monochrome theme
const STATUS_COLUMNS: { status: TaskStatus; label: string; color: string }[] = [
  { status: 'todo', label: 'To Do', color: '#8B8B8B' }, // Muted gray
  { status: 'in_progress', label: 'In Progress', color: '#7A8B8B' }, // Muted teal-gray
  { status: 'done', label: 'Done', color: '#7A8B7A' }, // Muted green-gray
  { status: 'archived', label: 'Archived', color: '#6B6B6B' }, // Darker muted gray
];

const PRIORITY_COLORS: Record<string, string> = {
  low: '#4CAF50',
  medium: '#FF9800',
  high: '#FF5722',
  critical: '#F44336',
};

// Muted phase colors matching GanttChart
const PHASE_COLORS: Record<number, string> = {
  1: '#8B7D8B', // Muted purple-gray
  2: '#7A8B8B', // Muted teal-gray
  3: '#8B8B7A', // Muted olive-gray
  4: '#7A7A8B', // Muted blue-gray
  5: '#8B7A7A', // Muted rose-gray
  6: '#7A8B7A', // Muted green-gray
};

export default function KanbanBoard({ tasks, onTaskClick }: KanbanBoardProps) {
  const theme = useTheme();
  // Group tasks by status
  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, (ProjectTask | ProjectTaskExtended)[]> = {
      todo: [],
      in_progress: [],
      done: [],
      archived: [],
    };

    tasks.forEach((task) => {
      if (grouped[task.status]) {
        grouped[task.status].push(task);
      }
    });

    return grouped;
  }, [tasks]);

  return (
    <Box sx={{ width: '100%', height: '100%', overflow: 'auto', p: { xs: 1, md: 2 } }}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          gap: { xs: 1.5, md: 2 },
          height: '100%',
          minHeight: 600,
          overflowX: 'auto',
          overflowY: { xs: 'visible', md: 'auto' },
          pb: { xs: 1, md: 0 },
        }}
      >
        {STATUS_COLUMNS.map((column) => {
          const columnTasks = tasksByStatus[column.status];

          return (
            <Box
              key={column.status}
              sx={{
                flex: { xs: 'none', md: 1 },
                minWidth: { xs: 280, md: 280 },
                width: { xs: 280, md: 'auto' },
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Column Header */}
              <Paper
                sx={{
                  p: { xs: 1.5, md: 2 },
                  mb: 2,
                  backgroundColor: theme.palette.background.paper,
                  borderLeft: `4px solid ${column.color}`,
                  border: `1px solid ${theme.palette.divider}`,
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography
                    variant="h6"
                    sx={{
                      color: theme.palette.text.primary,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      fontSize: { xs: '0.8rem', md: '0.9rem' },
                    }}
                  >
                    {column.label}
                  </Typography>
                  <Chip
                    label={columnTasks.length}
                    size="small"
                    sx={{
                      backgroundColor: theme.palette.action.hover,
                      color: theme.palette.text.primary,
                      border: `1px solid ${theme.palette.divider}`,
                      fontWeight: 'bold',
                    }}
                  />
                </Box>
              </Paper>

              {/* Tasks */}
              <Box
                sx={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.5,
                  overflowY: 'auto',
                  pr: 1,
                }}
              >
                {columnTasks.map((task) => {
                  const phaseColor = task.phase_number
                    ? PHASE_COLORS[task.phase_number] || theme.palette.text.secondary
                    : theme.palette.text.secondary;
                  const priorityColor = PRIORITY_COLORS[task.priority] || theme.palette.text.secondary;

                  return (
                    <Paper
                      key={task.id}
                      onClick={() => onTaskClick(task)}
                      sx={{
                        p: { xs: 1.5, md: 2 },
                        backgroundColor: theme.palette.background.paper,
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 2,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        '&:hover': {
                          borderColor: theme.palette.text.primary,
                          backgroundColor: theme.palette.action.hover,
                          transform: { xs: 'none', md: 'translateY(-2px)' },
                          boxShadow: { xs: 'none', md: `0 4px 12px ${theme.palette.text.primary}20` },
                        },
                      }}
                    >
                      {/* Task Title */}
                      <Typography
                        variant="subtitle1"
                        sx={{
                          color: theme.palette.text.primary,
                          fontWeight: 600,
                          mb: 1,
                          lineHeight: 1.3,
                          fontSize: { xs: '0.875rem', md: '1rem' },
                        }}
                      >
                        {task.title}
                      </Typography>

                      {/* Description Preview */}
                      {task.description && (
                        <Typography
                          variant="body2"
                          sx={{
                            color: theme.palette.text.secondary,
                            mb: 1.5,
                            fontSize: '0.85rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                          }}
                        >
                          {task.description}
                        </Typography>
                      )}

                      {/* Tags and Metadata */}
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
                        {task.tags && task.tags.length > 0 && (
                          <>
                            {task.tags.slice(0, 2).map((tag, index) => (
                              <Chip
                                key={index}
                                label={tag}
                                size="small"
                                sx={{
                                  backgroundColor: theme.palette.action.hover,
                                  color: theme.palette.text.primary,
                                  border: `1px solid ${theme.palette.divider}`,
                                  fontSize: '0.7rem',
                                  height: 20,
                                }}
                              />
                            ))}
                            {task.tags.length > 2 && (
                              <Chip
                                label={`+${task.tags.length - 2}`}
                                size="small"
                                sx={{
                                  backgroundColor: theme.palette.action.hover,
                                  color: theme.palette.text.primary,
                                  border: `1px solid ${theme.palette.divider}`,
                                  fontSize: '0.7rem',
                                  height: 20,
                                }}
                              />
                            )}
                          </>
                        )}
                      </Box>

                      {/* Footer */}
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          pt: 1,
                          borderTop: `1px solid ${theme.palette.divider}`,
                        }}
                      >
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          {/* Phase Indicator */}
                          {task.phase_number && (
                            <Tooltip title={`Phase ${task.phase_number}`}>
                              <Box
                                sx={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: '50%',
                                  backgroundColor: phaseColor,
                                }}
                              />
                            </Tooltip>
                          )}

                          {/* Priority Indicator */}
                          <Chip
                            label={task.priority}
                            size="small"
                            sx={{
                              backgroundColor: priorityColor,
                              color: '#fff',
                              fontSize: '0.65rem',
                              height: 18,
                              fontWeight: 'bold',
                            }}
                          />
                        </Box>

                        {/* Assignee */}
                        {(task as ProjectTaskExtended).assignee ? (
                          <Tooltip
                            title={
                              (task as ProjectTaskExtended).assignee?.name ||
                              (task as ProjectTaskExtended).assignee?.email ||
                              'Assigned'
                            }
                          >
                            <Avatar
                              src={(task as ProjectTaskExtended).assignee?.avatar_url || undefined}
                              sx={{
                                width: 24,
                                height: 24,
                                fontSize: '0.7rem',
                                backgroundColor: theme.palette.text.primary,
                                color: theme.palette.background.default,
                              }}
                            >
                              {(
                                (task as ProjectTaskExtended).assignee?.name ||
                                (task as ProjectTaskExtended).assignee?.email ||
                                'U'
                              )
                                .substring(0, 2)
                                .toUpperCase()}
                            </Avatar>
                          </Tooltip>
                        ) : (
                          <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                            Unassigned
                          </Typography>
                        )}
                      </Box>

                      {/* Due Date */}
                      {task.due_date && (
                        <Box sx={{ mt: 1 }}>
                          <Typography
                            variant="caption"
                            sx={{
                              color: theme.palette.text.secondary,
                              fontSize: '0.75rem',
                            }}
                          >
                            Due: {new Date(task.due_date).toLocaleDateString()}
                          </Typography>
                        </Box>
                      )}
                    </Paper>
                  );
                })}

                {columnTasks.length === 0 && (
                  <Box
                    sx={{
                      p: 3,
                      textAlign: 'center',
                      color: theme.palette.text.secondary,
                      border: `1px dashed ${theme.palette.divider}`,
                      borderRadius: 2,
                    }}
                  >
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>No tasks</Typography>
                  </Box>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

