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
import type { ProjectTask, ProjectTaskExtended, TaskStatus } from '@/types/project';

interface KanbanBoardProps {
  tasks: (ProjectTask | ProjectTaskExtended)[];
  onTaskClick: (task: ProjectTask | ProjectTaskExtended) => void;
}

const STATUS_COLUMNS: { status: TaskStatus; label: string; color: string }[] = [
  { status: 'todo', label: 'To Do', color: '#9E9E9E' },
  { status: 'in_progress', label: 'In Progress', color: '#2196F3' },
  { status: 'done', label: 'Done', color: '#4CAF50' },
  { status: 'archived', label: 'Archived', color: '#757575' },
];

const PRIORITY_COLORS: Record<string, string> = {
  low: '#4CAF50',
  medium: '#FF9800',
  high: '#FF5722',
  critical: '#F44336',
};

const PHASE_COLORS: Record<number, string> = {
  1: '#E91E63',
  2: '#9C27B0',
  3: '#673AB7',
  4: '#3F51B5',
  5: '#2196F3',
  6: '#00BCD4',
};

export default function KanbanBoard({ tasks, onTaskClick }: KanbanBoardProps) {
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
    <Box sx={{ width: '100%', height: '100%', overflow: 'auto', p: 2 }}>
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          height: '100%',
          minHeight: 600,
        }}
      >
        {STATUS_COLUMNS.map((column) => {
          const columnTasks = tasksByStatus[column.status];

          return (
            <Box
              key={column.status}
              sx={{
                flex: 1,
                minWidth: 280,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Column Header */}
              <Paper
                sx={{
                  p: 2,
                  mb: 2,
                  backgroundColor: '#1A1F3A',
                  borderLeft: `4px solid ${column.color}`,
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography
                    variant="h6"
                    sx={{
                      color: '#E0E0E0',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      fontSize: '0.9rem',
                    }}
                  >
                    {column.label}
                  </Typography>
                  <Chip
                    label={columnTasks.length}
                    size="small"
                    sx={{
                      backgroundColor: column.color,
                      color: '#fff',
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
                    ? PHASE_COLORS[task.phase_number] || '#00E5FF'
                    : '#00E5FF';
                  const priorityColor = PRIORITY_COLORS[task.priority] || '#00E5FF';

                  return (
                    <Paper
                      key={task.id}
                      onClick={() => onTaskClick(task)}
                      sx={{
                        p: 2,
                        backgroundColor: '#121633',
                        border: '1px solid rgba(0, 229, 255, 0.2)',
                        borderRadius: 2,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        '&:hover': {
                          borderColor: '#00E5FF',
                          backgroundColor: 'rgba(0, 229, 255, 0.05)',
                          transform: 'translateY(-2px)',
                          boxShadow: '0 4px 12px rgba(0, 229, 255, 0.2)',
                        },
                      }}
                    >
                      {/* Task Title */}
                      <Typography
                        variant="subtitle1"
                        sx={{
                          color: '#E0E0E0',
                          fontWeight: 600,
                          mb: 1,
                          lineHeight: 1.3,
                        }}
                      >
                        {task.title}
                      </Typography>

                      {/* Description Preview */}
                      {task.description && (
                        <Typography
                          variant="body2"
                          sx={{
                            color: '#B0B0B0',
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
                                  backgroundColor: 'rgba(0, 229, 255, 0.1)',
                                  color: '#00E5FF',
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
                                  backgroundColor: 'rgba(0, 229, 255, 0.1)',
                                  color: '#00E5FF',
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
                          borderTop: '1px solid rgba(0, 229, 255, 0.1)',
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
                                backgroundColor: '#00E5FF',
                                color: '#121633',
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
                          <Typography variant="caption" sx={{ color: '#666' }}>
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
                              color: '#B0B0B0',
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
                      color: '#666',
                      border: '2px dashed rgba(0, 229, 255, 0.2)',
                      borderRadius: 2,
                    }}
                  >
                    <Typography variant="body2">No tasks</Typography>
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

