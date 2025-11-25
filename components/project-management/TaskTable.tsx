'use client';

import { useState, useMemo, useCallback } from 'react';
import { useDebounce } from '@/lib/hooks/useDebounce';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Avatar,
  Typography,
  Checkbox,
  Tooltip,
  Menu,
  MenuItem,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  Button,
  CircularProgress,
} from '@mui/material';
import { format, parseISO } from 'date-fns';
import {
  MoreVert as MoreVertIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
  ViewColumn as ViewColumnIcon,
  Add as AddIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import type { ProjectTask, ProjectTaskExtended, TaskStatus, TaskPriority, User } from '@/types/project';
import { DEFAULT_PHASE_NAMES, STATUS_COLORS, PRIORITY_COLORS } from '@/lib/constants';

interface TaskTableProps {
  tasks: (ProjectTask | ProjectTaskExtended)[];
  loading?: boolean;
  onTaskClick: (task: ProjectTask | ProjectTaskExtended) => void;
  onTaskUpdate?: (taskId: string, updates: Partial<ProjectTask>) => void;
  onTaskDelete?: (taskId: string) => void;
  projectId: string;
  projectMembers?: User[];
  phaseNames?: Record<number, string>;
}

export default function TaskTable({
  tasks,
  loading = false,
  onTaskClick,
  onTaskUpdate,
  onTaskDelete,
  projectId,
  projectMembers = [],
  phaseNames = {},
}: TaskTableProps) {
  // Merge provided phase names with defaults
  const getPhaseName = (phaseNumber: number | null): string => {
    if (!phaseNumber) return 'Unassigned';
    return phaseNames[phaseNumber] || DEFAULT_PHASE_NAMES[phaseNumber] || `Phase ${phaseNumber}`;
  };
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [phaseFilter, setPhaseFilter] = useState<number | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all');
  const [visibleColumns, setVisibleColumns] = useState({
    status: true,
    title: true,
    phase: true,
    priority: true,
    assignee: true,
    startDate: true,
    dueDate: true,
  });
  const [columnMenuAnchor, setColumnMenuAnchor] = useState<HTMLElement | null>(null);
  const [actionMenuAnchor, setActionMenuAnchor] = useState<HTMLElement | null>(null);
  const [selectedTaskForAction, setSelectedTaskForAction] = useState<(ProjectTask | ProjectTaskExtended) | null>(null);
  
  // Inline editing state
  const [editingField, setEditingField] = useState<{
    taskId: string;
    field: 'assignee' | 'start_date' | 'due_date' | 'priority' | 'status';
  } | null>(null);
  
  // Local state for date fields while editing
  const [editingDateValue, setEditingDateValue] = useState<string>('');
  
  // Sorting state
  type SortField = 'phase' | 'start_date' | 'due_date' | 'assignee' | 'priority' | 'status';
  type SortDirection = 'asc' | 'desc' | null;
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const filteredAndSortedTasks = useMemo(() => {
    let result = tasks.filter((task) => {
      const matchesSearch =
        task.title.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        (task.description || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
      const matchesPhase = phaseFilter === 'all' || task.phase_number === phaseFilter;
      const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
      return matchesSearch && matchesStatus && matchesPhase && matchesPriority;
    });

    // Apply sorting
    if (sortField && sortDirection) {
      result = [...result].sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortField) {
          case 'phase':
            aValue = a.phase_number ?? 999;
            bValue = b.phase_number ?? 999;
            break;
          case 'start_date':
            aValue = a.start_date ? new Date(a.start_date).getTime() : Infinity;
            bValue = b.start_date ? new Date(b.start_date).getTime() : Infinity;
            break;
          case 'due_date':
            aValue = a.due_date ? new Date(a.due_date).getTime() : Infinity;
            bValue = b.due_date ? new Date(b.due_date).getTime() : Infinity;
            break;
          case 'assignee':
            const aAssignee = (a as ProjectTaskExtended).assignee?.name || (a as ProjectTaskExtended).assignee?.email || '';
            const bAssignee = (b as ProjectTaskExtended).assignee?.name || (b as ProjectTaskExtended).assignee?.email || '';
            aValue = aAssignee.toLowerCase();
            bValue = bAssignee.toLowerCase();
            break;
          case 'priority':
            const priorityOrder: Record<TaskPriority, number> = { low: 1, medium: 2, high: 3, critical: 4 };
            aValue = priorityOrder[a.priority];
            bValue = priorityOrder[b.priority];
            break;
          case 'status':
            const statusOrder: Record<TaskStatus, number> = { todo: 1, in_progress: 2, done: 3, archived: 4 };
            aValue = statusOrder[a.status];
            bValue = statusOrder[b.status];
            break;
          default:
            return 0;
        }

        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [tasks, debouncedSearchTerm, statusFilter, phaseFilter, priorityFilter, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Cycle through: asc -> desc -> null
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortField(null);
        setSortDirection(null);
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortableHeader = ({ field, label }: { field: SortField; label: string }) => {
    const isActive = sortField === field;
    const direction = isActive ? sortDirection : null;
    
    return (
      <TableCell
        sx={{
          backgroundColor: '#0A0E27',
          color: '#00E5FF',
          fontWeight: 600,
          cursor: 'pointer',
          userSelect: 'none',
          '&:hover': {
            backgroundColor: 'rgba(0, 229, 255, 0.1)',
          },
        }}
        onClick={() => handleSort(field)}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {label}
          <Box sx={{ display: 'flex', flexDirection: 'column', ml: 0.5 }}>
            <ArrowUpwardIcon
              sx={{
                fontSize: 14,
                color: isActive && direction === 'asc' ? '#00E5FF' : 'rgba(176, 176, 176, 0.3)',
                opacity: isActive && direction === 'asc' ? 1 : 0.5,
              }}
            />
            <ArrowDownwardIcon
              sx={{
                fontSize: 14,
                color: isActive && direction === 'desc' ? '#00E5FF' : 'rgba(176, 176, 176, 0.3)',
                opacity: isActive && direction === 'desc' ? 1 : 0.5,
                mt: -0.5,
              }}
            />
          </Box>
        </Box>
      </TableCell>
    );
  };

  const handleStatusChange = useCallback(async (taskId: string, newStatus: TaskStatus) => {
    if (onTaskUpdate) {
      await onTaskUpdate(taskId, { status: newStatus });
    }
    setEditingField(null);
  }, [onTaskUpdate]);

  const handleQuickStatusToggle = useCallback((task: ProjectTask) => {
    const statusOrder: TaskStatus[] = ['todo', 'in_progress', 'done'];
    const currentIndex = statusOrder.indexOf(task.status);
    const nextStatus = currentIndex < statusOrder.length - 1 ? statusOrder[currentIndex + 1] : 'todo';
    handleStatusChange(task.id, nextStatus);
  }, [handleStatusChange]);

  const handleFieldUpdate = useCallback(async (
    taskId: string,
    field: 'assignee' | 'start_date' | 'due_date' | 'priority' | 'status',
    value: any
  ) => {
    if (!onTaskUpdate) return;

    const updates: Partial<ProjectTask> = {};
    if (field === 'assignee') {
      updates.assignee_id = value || null;
    } else if (field === 'start_date') {
      updates.start_date = value || null;
    } else if (field === 'due_date') {
      updates.due_date = value || null;
    } else if (field === 'priority') {
      updates.priority = value;
    } else if (field === 'status') {
      updates.status = value;
    }

    await onTaskUpdate(taskId, updates);
    setEditingField(null);
    setEditingDateValue('');
  }, [onTaskUpdate]);

  const formatDateForInput = useCallback((dateString: string | null): string => {
    if (!dateString) return '';
    try {
      return format(parseISO(dateString), 'yyyy-MM-dd');
    } catch {
      return '';
    }
  }, []);

  const handleDateFieldStart = useCallback((taskId: string, field: 'start_date' | 'due_date', currentValue: string | null) => {
    setEditingField({ taskId, field });
    setEditingDateValue(formatDateForInput(currentValue));
  }, [formatDateForInput]);

  const handleDateFieldSave = useCallback(async (taskId: string, field: 'start_date' | 'due_date') => {
    await handleFieldUpdate(taskId, field, editingDateValue || null);
  }, [handleFieldUpdate, editingDateValue]);

  const handleActionMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>, task: ProjectTask | ProjectTaskExtended) => {
    event.stopPropagation();
    setActionMenuAnchor(event.currentTarget);
    setSelectedTaskForAction(task);
  }, []);

  const handleActionMenuClose = useCallback(() => {
    setActionMenuAnchor(null);
    setSelectedTaskForAction(null);
  }, []);

  const handleDeleteTask = useCallback(async () => {
    if (selectedTaskForAction && onTaskDelete) {
      await onTaskDelete(selectedTaskForAction.id);
      handleActionMenuClose();
    }
  }, [selectedTaskForAction, onTaskDelete, handleActionMenuClose]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Toolbar */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Box sx={{ display: 'flex', gap: 2, flex: 1, minWidth: 0 }}>
          <TextField
            size="small"
            placeholder="Search tasks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: '#00E5FF' }} />
                </InputAdornment>
              ),
            }}
            sx={{
              flex: { xs: '1 1 100%', sm: '0 0 300px' },
              '& .MuiOutlinedInput-root': {
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                color: '#E0E0E0',
                '& fieldset': {
                  borderColor: 'rgba(0, 229, 255, 0.3)',
                },
                '&:hover fieldset': {
                  borderColor: 'rgba(0, 229, 255, 0.5)',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#00E5FF',
                },
              },
            }}
          />
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel sx={{ color: '#B0B0B0' }}>Status</InputLabel>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as TaskStatus | 'all')}
              label="Status"
              sx={{
                color: '#E0E0E0',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(0, 229, 255, 0.3)',
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(0, 229, 255, 0.5)',
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#00E5FF',
                },
                '& .MuiSvgIcon-root': {
                  color: '#00E5FF',
                },
              }}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="todo">To Do</MenuItem>
              <MenuItem value="in_progress">In Progress</MenuItem>
              <MenuItem value="done">Done</MenuItem>
              <MenuItem value="archived">Archived</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel sx={{ color: '#B0B0B0' }}>Phase</InputLabel>
            <Select
              value={phaseFilter}
              onChange={(e) => setPhaseFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              label="Phase"
              sx={{
                color: '#E0E0E0',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(0, 229, 255, 0.3)',
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(0, 229, 255, 0.5)',
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#00E5FF',
                },
                '& .MuiSvgIcon-root': {
                  color: '#00E5FF',
                },
              }}
            >
              <MenuItem value="all">All</MenuItem>
              {Array.from(new Set(tasks.map(t => t.phase_number).filter(Boolean) as number[]))
                .sort((a, b) => a - b)
                .map((phase) => (
                  <MenuItem key={phase} value={phase}>
                    {getPhaseName(phase)}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel sx={{ color: '#B0B0B0' }}>Priority</InputLabel>
            <Select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as TaskPriority | 'all')}
              label="Priority"
              sx={{
                color: '#E0E0E0',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(0, 229, 255, 0.3)',
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(0, 229, 255, 0.5)',
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#00E5FF',
                },
                '& .MuiSvgIcon-root': {
                  color: '#00E5FF',
                },
              }}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="low">Low</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="high">High</MenuItem>
              <MenuItem value="critical">Critical</MenuItem>
            </Select>
          </FormControl>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Column visibility">
            <IconButton
              onClick={(e) => setColumnMenuAnchor(e.currentTarget)}
              sx={{ color: '#00E5FF' }}
              aria-label="Toggle column visibility"
            >
              <ViewColumnIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => onTaskClick({} as ProjectTask)}
            sx={{
              backgroundColor: '#00E5FF',
              color: '#000',
              fontWeight: 600,
              '&:hover': {
                backgroundColor: '#00B2CC',
              },
            }}
          >
            Add Task
          </Button>
        </Box>
      </Box>

      {/* Column Visibility Menu */}
      <Menu
        anchorEl={columnMenuAnchor}
        open={Boolean(columnMenuAnchor)}
        onClose={() => setColumnMenuAnchor(null)}
      >
        {Object.entries(visibleColumns).map(([key, visible]) => (
          <MenuItem
            key={key}
            onClick={() => setVisibleColumns({ ...visibleColumns, [key]: !visible })}
          >
            <Checkbox checked={visible} />
            {key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}
          </MenuItem>
        ))}
      </Menu>

      {/* Task Actions Menu */}
      <Menu
        anchorEl={actionMenuAnchor}
        open={Boolean(actionMenuAnchor)}
        onClose={handleActionMenuClose}
        PaperProps={{
          sx: {
            backgroundColor: '#121633',
            border: '1px solid rgba(0, 229, 255, 0.2)',
          },
        }}
      >
        <MenuItem
          onClick={() => {
            if (selectedTaskForAction) {
              onTaskClick(selectedTaskForAction);
            }
            handleActionMenuClose();
          }}
          sx={{
            color: '#E0E0E0',
            '&:hover': {
              backgroundColor: 'rgba(0, 229, 255, 0.1)',
            },
          }}
        >
          View Details
        </MenuItem>
        {onTaskDelete && (
          <MenuItem
            onClick={handleDeleteTask}
            sx={{
              color: '#FF6B6B',
              '&:hover': {
                backgroundColor: 'rgba(255, 107, 107, 0.1)',
              },
            }}
          >
            <DeleteIcon sx={{ mr: 1, fontSize: 18 }} />
            Delete Task
          </MenuItem>
        )}
      </Menu>

      {/* Table */}
      <TableContainer
        component={Paper}
        sx={{
          backgroundColor: '#121633',
          border: '1px solid rgba(0, 229, 255, 0.2)',
          borderRadius: 2,
          maxHeight: 'calc(100vh - 300px)',
          overflow: 'auto',
        }}
      >
        <Table stickyHeader size="small">
          <TableHead sx={{ backgroundColor: '#0A0E27' }}>
            <TableRow>
              {visibleColumns.status && (
                <SortableHeader field="status" label="Status" />
              )}
              {visibleColumns.title && (
                <TableCell sx={{ backgroundColor: '#0A0E27', color: '#00E5FF', fontWeight: 600, minWidth: 300 }}>
                  Title
                </TableCell>
              )}
              {visibleColumns.phase && (
                <SortableHeader field="phase" label="Phase" />
              )}
              {visibleColumns.priority && (
                <SortableHeader field="priority" label="Priority" />
              )}
              {visibleColumns.assignee && (
                <SortableHeader field="assignee" label="Assignee" />
              )}
              {visibleColumns.startDate && (
                <SortableHeader field="start_date" label="Start Date" />
              )}
              {visibleColumns.dueDate && (
                <SortableHeader field="due_date" label="Due Date" />
              )}
              <TableCell sx={{ backgroundColor: '#0A0E27', color: '#00E5FF', fontWeight: 600, width: 50 }}>
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredAndSortedTasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={Object.values(visibleColumns).filter(Boolean).length + 1} align="center" sx={{ py: 4 }}>
                  {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                      <CircularProgress />
                    </Box>
                  ) : (
                    <Box sx={{ py: 4, textAlign: 'center' }}>
                      <Typography variant="body1" sx={{ color: 'text.secondary', mb: 1 }}>
                        No tasks found
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {tasks.length === 0 
                          ? 'Get started by initiating project management or creating a task manually.'
                          : 'Try adjusting your filters to see more tasks.'}
                      </Typography>
                    </Box>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedTasks.map((task) => (
                <TableRow
                  key={task.id}
                  onClick={() => onTaskClick(task)}
                  sx={{
                    cursor: 'pointer',
                    '&:hover': {
                      backgroundColor: 'rgba(0, 229, 255, 0.05)',
                    },
                  }}
                >
                  {visibleColumns.status && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {editingField?.taskId === task.id && editingField?.field === 'status' ? (
                        <FormControl size="small" sx={{ minWidth: 120 }}>
                          <Select
                            value={task.status}
                            onChange={(e) => handleFieldUpdate(task.id, 'status', e.target.value)}
                            onBlur={() => setEditingField(null)}
                            autoFocus
                            sx={{
                              color: '#E0E0E0',
                              backgroundColor: 'rgba(255, 255, 255, 0.05)',
                              '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: '#00E5FF',
                              },
                              '& .MuiSvgIcon-root': {
                                color: '#00E5FF',
                              },
                            }}
                          >
                            <MenuItem value="todo">To Do</MenuItem>
                            <MenuItem value="in_progress">In Progress</MenuItem>
                            <MenuItem value="done">Done</MenuItem>
                            <MenuItem value="archived">Archived</MenuItem>
                          </Select>
                        </FormControl>
                      ) : (
                        <Chip
                          label={task.status.replace('_', ' ')}
                          size="small"
                          sx={{
                            backgroundColor: `${STATUS_COLORS[task.status]}20`,
                            color: STATUS_COLORS[task.status],
                            border: `1px solid ${STATUS_COLORS[task.status]}40`,
                            fontWeight: 500,
                            cursor: 'pointer',
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingField({ taskId: task.id, field: 'status' });
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            handleQuickStatusToggle(task);
                          }}
                        />
                      )}
                    </TableCell>
                  )}
                  {visibleColumns.title && (
                    <TableCell>
                      <Typography variant="body2" sx={{ color: '#E0E0E0', fontWeight: 500 }}>
                        {task.title}
                      </Typography>
                      {task.description && (
                        <Typography variant="caption" sx={{ color: '#B0B0B0', display: 'block', mt: 0.5 }}>
                          {task.description.substring(0, 60)}
                          {task.description.length > 60 ? '...' : ''}
                        </Typography>
                      )}
                    </TableCell>
                  )}
                  {visibleColumns.phase && (
                    <TableCell>
                      {task.phase_number ? (
                        <Chip
                          label={getPhaseName(task.phase_number)}
                          size="small"
                          sx={{
                            backgroundColor: 'rgba(0, 229, 255, 0.15)',
                            color: '#00E5FF',
                            border: '1px solid rgba(0, 229, 255, 0.3)',
                          }}
                        />
                      ) : (
                        <Typography variant="body2" sx={{ color: '#B0B0B0' }}>
                          -
                        </Typography>
                      )}
                    </TableCell>
                  )}
                  {visibleColumns.priority && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {editingField?.taskId === task.id && editingField?.field === 'priority' ? (
                        <FormControl size="small" sx={{ minWidth: 120 }}>
                          <Select
                            value={task.priority}
                            onChange={(e) => handleFieldUpdate(task.id, 'priority', e.target.value)}
                            onBlur={() => setEditingField(null)}
                            autoFocus
                            sx={{
                              color: '#E0E0E0',
                              backgroundColor: 'rgba(255, 255, 255, 0.05)',
                              '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: '#00E5FF',
                              },
                              '& .MuiSvgIcon-root': {
                                color: '#00E5FF',
                              },
                            }}
                          >
                            <MenuItem value="low">Low</MenuItem>
                            <MenuItem value="medium">Medium</MenuItem>
                            <MenuItem value="high">High</MenuItem>
                            <MenuItem value="critical">Critical</MenuItem>
                          </Select>
                        </FormControl>
                      ) : (
                        <Chip
                          label={task.priority}
                          size="small"
                          sx={{
                            backgroundColor: `${PRIORITY_COLORS[task.priority]}20`,
                            color: PRIORITY_COLORS[task.priority],
                            border: `1px solid ${PRIORITY_COLORS[task.priority]}40`,
                            fontWeight: 500,
                            cursor: 'pointer',
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingField({ taskId: task.id, field: 'priority' });
                          }}
                        />
                      )}
                    </TableCell>
                  )}
                  {visibleColumns.assignee && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {editingField?.taskId === task.id && editingField?.field === 'assignee' ? (
                        <FormControl size="small" sx={{ minWidth: 150 }}>
                          <Select
                            value={task.assignee_id || ''}
                            onChange={(e) => handleFieldUpdate(task.id, 'assignee', e.target.value)}
                            onBlur={() => setEditingField(null)}
                            autoFocus
                            displayEmpty
                            sx={{
                              color: '#E0E0E0',
                              backgroundColor: 'rgba(255, 255, 255, 0.05)',
                              '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: '#00E5FF',
                              },
                              '& .MuiSvgIcon-root': {
                                color: '#00E5FF',
                              },
                            }}
                          >
                            <MenuItem value="">
                              <em>Unassigned</em>
                            </MenuItem>
                            {projectMembers.map((member) => (
                              <MenuItem key={member.id} value={member.id}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Avatar
                                    src={member.avatar_url || undefined}
                                    sx={{ width: 20, height: 20, fontSize: '0.7rem' }}
                                  >
                                    {(member.name || member.email || 'U').substring(0, 2).toUpperCase()}
                                  </Avatar>
                                  <Typography variant="body2">
                                    {member.name || member.email}
                                  </Typography>
                                </Box>
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      ) : (
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            cursor: 'pointer',
                            '&:hover': {
                              opacity: 0.8,
                            },
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingField({ taskId: task.id, field: 'assignee' });
                          }}
                        >
                          {(task as ProjectTaskExtended).assignee ? (
                            <>
                              <Avatar 
                                src={(task as ProjectTaskExtended).assignee?.avatar_url || undefined}
                                sx={{ width: 24, height: 24, fontSize: '0.75rem' }}
                              >
                                {((task as ProjectTaskExtended).assignee?.name || (task as ProjectTaskExtended).assignee?.email || 'U').substring(0, 2).toUpperCase()}
                              </Avatar>
                              <Typography variant="body2" sx={{ color: '#E0E0E0' }}>
                                {(task as ProjectTaskExtended).assignee?.name || (task as ProjectTaskExtended).assignee?.email || 'Unknown'}
                              </Typography>
                            </>
                          ) : task.assignee_id ? (
                            <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem' }}>
                              {task.assignee_id.substring(0, 2).toUpperCase()}
                            </Avatar>
                          ) : (
                            <Typography variant="body2" sx={{ color: '#B0B0B0' }}>
                              Unassigned
                            </Typography>
                          )}
                        </Box>
                      )}
                    </TableCell>
                  )}
                  {visibleColumns.startDate && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {editingField?.taskId === task.id && editingField?.field === 'start_date' ? (
                        <TextField
                          type="date"
                          size="small"
                          value={editingDateValue}
                          onChange={(e) => setEditingDateValue(e.target.value)}
                          onBlur={() => handleDateFieldSave(task.id, 'start_date')}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleDateFieldSave(task.id, 'start_date');
                            } else if (e.key === 'Escape') {
                              setEditingField(null);
                              setEditingDateValue('');
                            }
                          }}
                          autoFocus
                          InputLabelProps={{
                            shrink: true,
                          }}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              color: '#E0E0E0',
                              backgroundColor: 'rgba(255, 255, 255, 0.05)',
                              '& fieldset': {
                                borderColor: '#00E5FF',
                              },
                              '&:hover fieldset': {
                                borderColor: '#00E5FF',
                              },
                              '&.Mui-focused fieldset': {
                                borderColor: '#00E5FF',
                              },
                            },
                          }}
                        />
                      ) : (
                        <Typography
                          variant="body2"
                          sx={{
                            color: task.start_date && new Date(task.start_date) > new Date() ? '#FFA726' : '#E0E0E0',
                            cursor: 'pointer',
                            '&:hover': {
                              opacity: 0.8,
                            },
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDateFieldStart(task.id, 'start_date', task.start_date);
                          }}
                        >
                          {task.start_date ? new Date(task.start_date).toLocaleDateString() : '-'}
                        </Typography>
                      )}
                    </TableCell>
                  )}
                  {visibleColumns.dueDate && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {editingField?.taskId === task.id && editingField?.field === 'due_date' ? (
                        <TextField
                          type="date"
                          size="small"
                          value={editingDateValue}
                          onChange={(e) => setEditingDateValue(e.target.value)}
                          onBlur={() => handleDateFieldSave(task.id, 'due_date')}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleDateFieldSave(task.id, 'due_date');
                            } else if (e.key === 'Escape') {
                              setEditingField(null);
                              setEditingDateValue('');
                            }
                          }}
                          autoFocus
                          InputLabelProps={{
                            shrink: true,
                          }}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              color: '#E0E0E0',
                              backgroundColor: 'rgba(255, 255, 255, 0.05)',
                              '& fieldset': {
                                borderColor: '#00E5FF',
                              },
                              '&:hover fieldset': {
                                borderColor: '#00E5FF',
                              },
                              '&.Mui-focused fieldset': {
                                borderColor: '#00E5FF',
                              },
                            },
                          }}
                        />
                      ) : (
                        <Typography
                          variant="body2"
                          sx={{
                            color: task.due_date && new Date(task.due_date) < new Date() ? '#FF6B6B' : '#E0E0E0',
                            cursor: 'pointer',
                            '&:hover': {
                              opacity: 0.8,
                            },
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDateFieldStart(task.id, 'due_date', task.due_date);
                          }}
                        >
                          {task.due_date ? new Date(task.due_date).toLocaleDateString() : '-'}
                        </Typography>
                      )}
                    </TableCell>
                  )}
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <IconButton
                      size="small"
                      onClick={(e) => handleActionMenuOpen(e, task)}
                      sx={{ color: '#00E5FF' }}
                      aria-label={`Actions menu for task ${task.title}`}
                    >
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Task Count */}
      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="body2" sx={{ color: '#B0B0B0' }}>
          Showing {filteredAndSortedTasks.length} of {tasks.length} tasks
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Typography variant="body2" sx={{ color: '#B0B0B0' }}>
            To Do: {tasks.filter((t) => t.status === 'todo').length}
          </Typography>
          <Typography variant="body2" sx={{ color: '#B0B0B0' }}>
            In Progress: {tasks.filter((t) => t.status === 'in_progress').length}
          </Typography>
          <Typography variant="body2" sx={{ color: '#B0B0B0' }}>
            Done: {tasks.filter((t) => t.status === 'done').length}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

