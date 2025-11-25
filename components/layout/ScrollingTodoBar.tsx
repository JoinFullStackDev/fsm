'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Chip,
  Tooltip,
  CircularProgress,
  keyframes,
} from '@mui/material';
import {
  Assignment as TaskIcon,
  FolderOpen as PhaseIcon,
  PriorityHigh as CriticalIcon,
  TrendingUp as HighIcon,
  Remove as MediumIcon,
  ArrowDownward as LowIcon,
} from '@mui/icons-material';
import { format, isToday, isTomorrow, isPast, parseISO } from 'date-fns';

interface TodoItem {
  id: string;
  type: 'task' | 'phase';
  title: string;
  description?: string | null;
  project_id: string;
  project_name: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  due_date?: string | null;
  status?: 'todo' | 'in_progress' | 'done' | 'archived';
  phase_number?: number;
  phase_name?: string;
  url: string;
  created_at: string;
}

const priorityConfig = {
  critical: { icon: CriticalIcon, color: '#ff1744', label: 'Critical' },
  high: { icon: HighIcon, color: '#ff6f00', label: 'High' },
  medium: { icon: MediumIcon, color: '#ffa726', label: 'Medium' },
  low: { icon: LowIcon, color: '#66bb6a', label: 'Low' },
};

export default function ScrollingTodoBar() {
  const router = useRouter();
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(0);

  useEffect(() => {
    loadTodos();
  }, []);

  useEffect(() => {
    if (contentRef.current && todos.length > 0) {
      // Measure the width of one set of items (since we duplicate)
      const width = contentRef.current.scrollWidth / 2;
      setContentWidth(width);
    }
  }, [todos]);

  // Create keyframe animation for scrolling
  const scrollAnimation = contentWidth > 0
    ? keyframes`
        from {
          transform: translateX(0);
        }
        to {
          transform: translateX(-${contentWidth}px);
        }
      `
    : null;

  const loadTodos = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/users/todos');
      if (!response.ok) {
        throw new Error('Failed to load todos');
      }
      const data = await response.json();
      // Duplicate items for seamless loop
      setTodos([...(data.todos || []), ...(data.todos || [])]);
    } catch (err) {
      console.error('Error loading todos:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTodoClick = (todo: TodoItem) => {
    router.push(todo.url);
  };

  const getDueDateLabel = (dueDate: string | null | undefined): string | null => {
    if (!dueDate) return null;
    try {
      const date = parseISO(dueDate);
      if (isPast(date) && !isToday(date)) {
        return `Overdue`;
      }
      if (isToday(date)) {
        return 'Today';
      }
      if (isTomorrow(date)) {
        return 'Tomorrow';
      }
      return format(date, 'MMM d');
    } catch {
      return null;
    }
  };

  const isOverdue = (dueDate: string | null | undefined): boolean => {
    if (!dueDate) return false;
    try {
      const date = parseISO(dueDate);
      return isPast(date) && !isToday(date);
    } catch {
      return false;
    }
  };

  const getPriorityIcon = (priority?: 'low' | 'medium' | 'high' | 'critical') => {
    const config = priorityConfig[priority || 'medium'];
    const Icon = config.icon;
    return <Icon sx={{ fontSize: 14, color: config.color }} />;
  };

  if (loading) {
    return (
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          px: 2,
        }}
      >
        <CircularProgress size={20} sx={{ color: 'primary.main' }} />
      </Box>
    );
  }

  if (todos.length === 0) {
    return (
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          px: 2,
        }}
      >
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          All caught up! No tasks or phases need attention.
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      sx={{
        flex: 1,
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
      }}
    >
      <Box
        ref={contentRef}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 2,
          whiteSpace: 'nowrap',
          px: 2,
          ...(scrollAnimation && !isHovered && {
            animation: `${scrollAnimation} ${Math.max(contentWidth / 30, 20)}s linear infinite`,
          }),
        }}
      >
        {todos.map((todo, index) => (
          <Tooltip
            key={`${todo.id}-${index}`}
            title={
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {todo.title}
                </Typography>
                {todo.description && (
                  <Typography variant="caption">{todo.description}</Typography>
                )}
                <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                  {todo.project_name}
                </Typography>
              </Box>
            }
            arrow
          >
            <Box
              onClick={() => handleTodoClick(todo)}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 1,
                px: 2,
                py: 1,
                borderRadius: 1,
                backgroundColor: 'rgba(0, 229, 255, 0.05)',
                border: '1px solid',
                borderColor: 'rgba(0, 229, 255, 0.2)',
                transition: 'all 0.2s',
                '&:hover': {
                  backgroundColor: 'rgba(0, 229, 255, 0.1)',
                  borderColor: 'primary.main',
                  transform: 'scale(1.02)',
                },
              }}
            >
              {todo.type === 'task' ? (
                <TaskIcon sx={{ color: 'primary.main', fontSize: 18 }} />
              ) : (
                <PhaseIcon sx={{ color: 'primary.main', fontSize: 18 }} />
              )}
              <Typography
                variant="body2"
                sx={{
                  color: 'text.primary',
                  fontWeight: 500,
                  maxWidth: 200,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {todo.title}
              </Typography>
              {todo.priority && (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  {getPriorityIcon(todo.priority)}
                </Box>
              )}
              {todo.due_date && (
                <Chip
                  label={getDueDateLabel(todo.due_date) || 'Due soon'}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.65rem',
                    backgroundColor: isOverdue(todo.due_date)
                      ? 'error.main'
                      : 'rgba(0, 229, 255, 0.2)',
                    color: isOverdue(todo.due_date) ? '#fff' : 'primary.main',
                    '& .MuiChip-label': {
                      px: 1,
                    },
                  }}
                />
              )}
              {todo.status === 'in_progress' && (
                <Chip
                  label="In Progress"
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.65rem',
                    backgroundColor: 'rgba(0, 229, 255, 0.2)',
                    color: 'primary.main',
                    '& .MuiChip-label': {
                      px: 1,
                    },
                  }}
                />
              )}
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  ml: 0.5,
                }}
              >
                {todo.project_name}
              </Typography>
            </Box>
          </Tooltip>
        ))}
      </Box>
    </Box>
  );
}

