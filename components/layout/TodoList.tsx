'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  IconButton,
  Popover,
  Paper,
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Chip,
  CircularProgress,
  Divider,
  Tooltip,
} from '@mui/material';
import {
  CheckCircleOutline as CheckIcon,
  Assignment as TaskIcon,
  FolderOpen as PhaseIcon,
  Today as TodayIcon,
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

interface TodoItemProps {
  todo: TodoItem;
  index: number;
  totalTodos: number;
  onClick: (todo: TodoItem) => void;
  getDueDateLabel: (dueDate: string | null | undefined) => string | null;
  isOverdue: (dueDate: string) => boolean;
  getPriorityIcon: (priority: 'low' | 'medium' | 'high' | 'critical') => React.ReactNode;
  isSelected?: boolean;
  itemRef?: (el: HTMLLIElement | null) => void;
}

const TodoItemComponent = React.memo(function TodoItemComponent({
  todo,
  index,
  totalTodos,
  onClick,
  getDueDateLabel,
  isOverdue,
  getPriorityIcon,
  isSelected = false,
  itemRef,
}: TodoItemProps) {
  return (
    <Box>
      <ListItem disablePadding ref={itemRef}>
        <ListItemButton
          onClick={() => onClick(todo)}
          sx={{
            py: 1.5,
            px: 2,
            backgroundColor: isSelected ? 'rgba(0, 229, 255, 0.2)' : 'transparent',
            '&:hover': {
              backgroundColor: isSelected ? 'rgba(0, 229, 255, 0.3)' : 'rgba(0, 229, 255, 0.1)',
            },
            '&:focus': {
              backgroundColor: isSelected ? 'rgba(0, 229, 255, 0.2)' : 'rgba(0, 229, 255, 0.1)',
              outline: '2px solid',
              outlineColor: 'primary.main',
              outlineOffset: -2,
            },
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              width: '100%',
            }}
          >
            {todo.type === 'task' ? (
              <TaskIcon sx={{ color: 'primary.main', fontSize: 20 }} />
            ) : (
              <PhaseIcon sx={{ color: 'primary.main', fontSize: 20 }} />
            )}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.primary',
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {todo.title}
                </Typography>
                {todo.priority && (
                  <Tooltip title={priorityConfig[todo.priority].label}>
                    <span>{getPriorityIcon(todo.priority)}</span>
                  </Tooltip>
                )}
              </Box>
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  display: 'block',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {todo.project_name}
              </Typography>
              {todo.description && (
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                    display: 'block',
                    mt: 0.5,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {todo.description}
                </Typography>
              )}
              <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
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
                      color: isOverdue(todo.due_date)
                        ? '#fff'
                        : 'primary.main',
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
                    }}
                  />
                )}
              </Box>
            </Box>
          </Box>
        </ListItemButton>
      </ListItem>
      {index < totalTodos - 1 && (
        <Divider sx={{ borderColor: 'rgba(0, 229, 255, 0.1)' }} />
      )}
    </Box>
  );
});

export default function TodoList() {
  const router = useRouter();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);

  const open = Boolean(anchorEl);

  const loadTodos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/users/todos');
      if (!response.ok) {
        throw new Error('Failed to load todos');
      }
      const data = await response.json();
      setTodos(data.todos || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load todos');
      // Error is already handled via setError state
    } finally {
      setLoading(false);
    }
  }, []);

  const handleTodoClick = useCallback((todo: TodoItem) => {
    handleClose();
    router.push(todo.url);
  }, [router]);

  useEffect(() => {
    if (open) {
      loadTodos();
      setSelectedIndex(0);
    }
  }, [open, loadTodos]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!open || todos.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < todos.length - 1 ? prev + 1 : prev));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === 'Enter' && selectedIndex >= 0 && selectedIndex < todos.length) {
        e.preventDefault();
        handleTodoClick(todos[selectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, todos, selectedIndex, handleTodoClick]);

  // Scroll selected item into view
  useEffect(() => {
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedIndex]);

  useEffect(() => {
    const timeout = timeoutRef.current;
    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, []);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
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
    return <Icon sx={{ fontSize: 16, color: config.color }} />;
  };

  const getPriorityColor = (priority?: 'low' | 'medium' | 'high' | 'critical') => {
    return priorityConfig[priority || 'medium'].color;
  };

  const todoCount = todos.length;

  return (
    <>
      <Tooltip title="Daily Todo List">
        <IconButton
          onClick={handleClick}
          sx={{
            color: 'primary.main',
            position: 'relative',
            '&:hover': {
              backgroundColor: 'rgba(0, 229, 255, 0.1)',
            },
          }}
          aria-label="todo list"
        >
          <TodayIcon />
          {todoCount > 0 && (
            <Box
              sx={{
                position: 'absolute',
                top: 4,
                right: 4,
                width: 18,
                height: 18,
                borderRadius: '50%',
                backgroundColor: 'error.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.7rem',
                fontWeight: 600,
                color: '#fff',
                border: '2px solid #121633',
              }}
            >
              {todoCount > 9 ? '9+' : todoCount}
            </Box>
          )}
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: {
            mt: 1,
            width: 400,
            maxHeight: 600,
            backgroundColor: '#121633',
            border: '1px solid',
            borderColor: 'primary.main',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <TodayIcon sx={{ color: 'primary.main' }} />
            <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 600 }}>
              Daily Todo List
            </Typography>
            {todoCount > 0 && (
              <Chip
                label={todoCount}
                size="small"
                sx={{
                  backgroundColor: 'primary.main',
                  color: '#000',
                  fontWeight: 600,
                }}
              />
            )}
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={32} sx={{ color: 'primary.main' }} />
            </Box>
          ) : error ? (
            <Box sx={{ py: 2 }}>
              <Typography variant="body2" sx={{ color: 'error.main' }}>
                {error}
              </Typography>
            </Box>
          ) : todos.length === 0 ? (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <CheckIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                All caught up! No tasks or phases need attention.
              </Typography>
            </Box>
          ) : (
            <List sx={{ p: 0, maxHeight: 500, overflow: 'auto' }} ref={listRef}>
              {todos.map((todo, index) => (
                <TodoItemComponent
                  key={todo.id}
                  todo={todo}
                  index={index}
                  totalTodos={todos.length}
                  onClick={handleTodoClick}
                  getDueDateLabel={getDueDateLabel}
                  isOverdue={isOverdue}
                  getPriorityIcon={getPriorityIcon}
                  isSelected={selectedIndex === index}
                  itemRef={(el) => {
                    itemRefs.current[index] = el;
                  }}
                />
              ))}
            </List>
          )}
        </Box>
      </Popover>
    </>
  );
}

