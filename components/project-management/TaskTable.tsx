'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
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
import { useTheme, alpha } from '@mui/material/styles';
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
  ChevronRight as ChevronRightIcon,
  ExpandMore as ChevronDownIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import type { ProjectTask, ProjectTaskExtended, TaskStatus, TaskPriority, User } from '@/types/project';
import { DEFAULT_PHASE_NAMES, STATUS_COLORS, PRIORITY_COLORS } from '@/lib/constants';
import { getParentTaskAggregateInfo } from '@/lib/utils/taskAggregates';
import SubtaskPanel from './SubtaskPanel';

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
  const theme = useTheme();
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
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
  const [subtasksMap, setSubtasksMap] = useState<Map<string, (ProjectTask | ProjectTaskExtended)[]>>(new Map());
  const [addingSubtaskTo, setAddingSubtaskTo] = useState<string | null>(null);
  
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

  // Group tasks by parent (parent tasks first, then subtasks)
  const { parentTasks, subtasksByParent } = useMemo(() => {
    const allTasks = tasks.filter((task) => {
      const matchesSearch =
        task.title.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        (task.description || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
      const matchesPhase = phaseFilter === 'all' || task.phase_number === phaseFilter;
      const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
      return matchesSearch && matchesStatus && matchesPhase && matchesPriority;
    });

    const parents: (ProjectTask | ProjectTaskExtended)[] = [];
    const subtasksMap = new Map<string, (ProjectTask | ProjectTaskExtended)[]>();

    allTasks.forEach((task) => {
      if (!task.parent_task_id) {
        parents.push(task);
      } else {
        if (!subtasksMap.has(task.parent_task_id)) {
          subtasksMap.set(task.parent_task_id, []);
        }
        subtasksMap.get(task.parent_task_id)!.push(task);
      }
    });

    // Apply sorting to parent tasks
    let sortedParents = parents;
    if (sortField && sortDirection) {
      sortedParents = [...parents].sort((a, b) => {
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

    return { parentTasks: sortedParents, subtasksByParent: subtasksMap };
  }, [tasks, debouncedSearchTerm, statusFilter, phaseFilter, priorityFilter, sortField, sortDirection]);

  // Update subtasks map when it changes
  useEffect(() => {
    setSubtasksMap(subtasksByParent);
  }, [subtasksByParent]);

  const filteredAndSortedTasks = parentTasks; // For backward compatibility with existing code

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
          backgroundColor: theme.palette.background.paper,
          color: theme.palette.text.primary,
          fontWeight: 600,
          cursor: 'pointer',
          userSelect: 'none',
          borderBottom: `1px solid ${theme.palette.divider}`,
          '&:hover': {
            backgroundColor: theme.palette.action.hover,
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
                color: isActive && direction === 'asc' ? theme.palette.text.primary : theme.palette.text.secondary,
                opacity: isActive && direction === 'asc' ? 1 : 0.5,
              }}
            />
            <ArrowDownwardIcon
              sx={{
                fontSize: 14,
                color: isActive && direction === 'desc' ? theme.palette.text.primary : theme.palette.text.secondary,
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
    // Use the actual task status, not the aggregate display status
    // This ensures we toggle from the real status, not the calculated aggregate
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

    // Find the actual task to get its real status (not the aggregate display status)
    const actualTask = filteredAndSortedTasks.find(t => t.id === taskId);
    if (!actualTask) return;

    // For status updates on parent tasks, ensure we're not accidentally using aggregate status
    // Only update if the value is actually different from the current task status
    if (field === 'status' && value === actualTask.status) {
      // No change needed, just close the editor
      setEditingField(null);
      return;
    }

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
  }, [onTaskUpdate, filteredAndSortedTasks]);

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

  const handleToggleExpand = useCallback((taskId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const newExpanded = new Set(expandedParents);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
      // Initialize with empty array immediately for responsive UI
      if (!subtasksMap.has(taskId)) {
        const newMap = new Map(subtasksMap);
        newMap.set(taskId, []);
        setSubtasksMap(newMap);
        
        // Then fetch actual subtasks
        fetch(`/api/projects/${projectId}/tasks/${taskId}/subtasks`)
          .then((res) => res.json())
          .then((data) => {
            if (Array.isArray(data)) {
              setSubtasksMap((prevMap) => {
                const updatedMap = new Map(prevMap);
                updatedMap.set(taskId, data);
                return updatedMap;
              });
            }
          })
          .catch((err) => {
            console.error('Error loading subtasks:', err);
          });
      }
    }
    setExpandedParents(newExpanded);
  }, [expandedParents, subtasksMap, projectId]);

  const handleSubtaskCreated = useCallback((subtask: ProjectTask | ProjectTaskExtended) => {
    const parentId = subtask.parent_task_id!;
    const newMap = new Map(subtasksMap);
    const existing = newMap.get(parentId) || [];
    newMap.set(parentId, [...existing, subtask]);
    setSubtasksMap(newMap);
  }, [subtasksMap]);

  const handleSubtaskUpdated = useCallback((subtaskId: string, updates: Partial<ProjectTask>) => {
    const newMap = new Map(subtasksMap);
    for (const [parentId, subtasks] of newMap.entries()) {
      const index = subtasks.findIndex((s) => s.id === subtaskId);
      if (index >= 0) {
        const updated = [...subtasks];
        updated[index] = { ...updated[index], ...updates };
        newMap.set(parentId, updated);
        setSubtasksMap(newMap);
        break;
      }
    }
  }, [subtasksMap]);

  const handleSubtaskDeleted = useCallback((subtaskId: string) => {
    const newMap = new Map(subtasksMap);
    for (const [parentId, subtasks] of newMap.entries()) {
      const filtered = subtasks.filter((s) => s.id !== subtaskId);
      if (filtered.length !== subtasks.length) {
        newMap.set(parentId, filtered);
        setSubtasksMap(newMap);
        break;
      }
    }
  }, [subtasksMap]);

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
                  <SearchIcon sx={{ color: theme.palette.text.primary }} />
                </InputAdornment>
              ),
            }}
            sx={{
              flex: { xs: '1 1 100%', sm: '0 0 300px' },
              '& .MuiOutlinedInput-root': {
                backgroundColor: theme.palette.action.hover,
                color: theme.palette.text.primary,
                '& fieldset': {
                  borderColor: theme.palette.divider,
                },
                '&:hover fieldset': {
                  borderColor: theme.palette.text.secondary,
                },
                '&.Mui-focused fieldset': {
                  borderColor: theme.palette.text.primary,
                },
              },
            }}
          />
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel sx={{ color: theme.palette.text.secondary }}>Status</InputLabel>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as TaskStatus | 'all')}
              label="Status"
              sx={{
                color: theme.palette.text.primary,
                backgroundColor: theme.palette.action.hover,
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: theme.palette.divider,
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: theme.palette.text.secondary,
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: theme.palette.text.primary,
                },
                '& .MuiSvgIcon-root': {
                  color: theme.palette.text.primary,
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
            <InputLabel sx={{ color: theme.palette.text.secondary }}>Phase</InputLabel>
            <Select
              value={phaseFilter}
              onChange={(e) => setPhaseFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              label="Phase"
              sx={{
                color: theme.palette.text.primary,
                backgroundColor: theme.palette.action.hover,
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: theme.palette.divider,
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: theme.palette.text.secondary,
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: theme.palette.text.primary,
                },
                '& .MuiSvgIcon-root': {
                  color: theme.palette.text.primary,
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
            <InputLabel sx={{ color: theme.palette.text.secondary }}>Priority</InputLabel>
            <Select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as TaskPriority | 'all')}
              label="Priority"
              sx={{
                color: theme.palette.text.primary,
                backgroundColor: theme.palette.action.hover,
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: theme.palette.divider,
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: theme.palette.text.secondary,
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: theme.palette.text.primary,
                },
                '& .MuiSvgIcon-root': {
                  color: theme.palette.text.primary,
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
              sx={{ color: theme.palette.text.primary }}
              aria-label="Toggle column visibility"
            >
              <ViewColumnIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => onTaskClick({} as ProjectTask)}
            sx={{
              borderColor: theme.palette.text.primary,
              color: theme.palette.text.primary,
              fontWeight: 600,
              '&:hover': {
                borderColor: theme.palette.text.primary,
                backgroundColor: theme.palette.action.hover,
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
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
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
            color: theme.palette.text.primary,
            '&:hover': {
              backgroundColor: theme.palette.action.hover,
            },
          }}
        >
          View Details
        </MenuItem>
        {onTaskDelete && (
          <MenuItem
            onClick={handleDeleteTask}
            sx={{
              color: theme.palette.text.primary,
              '&:hover': {
                backgroundColor: theme.palette.action.hover,
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
          backgroundColor: theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 2,
          maxHeight: 'calc(100vh - 300px)',
          overflow: 'auto',
        }}
      >
        <Table stickyHeader size="small">
          <TableHead sx={{ backgroundColor: theme.palette.background.paper }}>
            <TableRow>
              {visibleColumns.status && (
                <SortableHeader field="status" label="Status" />
              )}
              {visibleColumns.title && (
                <TableCell sx={{ backgroundColor: theme.palette.background.paper, color: theme.palette.text.primary, fontWeight: 600, minWidth: 300, borderBottom: `1px solid ${theme.palette.divider}` }}>
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
              <TableCell sx={{ backgroundColor: theme.palette.background.paper, color: theme.palette.text.primary, fontWeight: 600, width: 50, borderBottom: `1px solid ${theme.palette.divider}` }}>
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
              <>
                {filteredAndSortedTasks.map((task) => {
                  const subtasks = subtasksMap.get(task.id) || [];
                  const isExpanded = expandedParents.has(task.id);
                  const aggregateInfo = subtasks.length > 0 ? getParentTaskAggregateInfo(task, subtasks) : null;
                  // Always use the actual task.status for the status chip display
                  // The aggregate info is shown in the tooltip badge next to the status

                  return (
                    <React.Fragment key={task.id}>
                      <TableRow
                        onClick={() => onTaskClick(task)}
                        sx={{
                          cursor: 'pointer',
                          borderBottom: `1px solid ${theme.palette.divider}`,
                          '&:hover': {
                            backgroundColor: theme.palette.action.hover,
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
                                    color: theme.palette.text.primary,
                                    backgroundColor: theme.palette.action.hover,
                                    '& .MuiOutlinedInput-notchedOutline': {
                                      borderColor: theme.palette.divider,
                                    },
                                    '& .MuiSvgIcon-root': {
                                      color: theme.palette.text.primary,
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
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
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
                                {aggregateInfo && subtasks.length > 0 && (
                                  <Tooltip title={aggregateInfo.summary} arrow>
                                    <Box
                                      component="span"
                                      sx={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        minWidth: 20,
                                        height: 20,
                                        px: 0.5,
                                        fontSize: '0.7rem',
                                        fontWeight: 500,
                                        color: '#000',
                                        bgcolor: '#fff',
                                        borderRadius: '50%',
                                        cursor: 'help',
                                        border: `1px solid ${theme.palette.divider}`,
                                      }}
                                    >
                                      {subtasks.length}
                                    </Box>
                                  </Tooltip>
                                )}
                              </Box>
                            )}
                          </TableCell>
                        )}
                        {visibleColumns.title && (
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <IconButton
                                size="small"
                                onClick={(e) => handleToggleExpand(task.id, e)}
                                sx={{ p: 0.5 }}
                                title={isExpanded ? 'Collapse subtasks' : 'Expand to view/add subtasks'}
                              >
                                {isExpanded ? (
                                  <ChevronDownIcon fontSize="small" />
                                ) : (
                                  <ChevronRightIcon fontSize="small" />
                                )}
                              </IconButton>
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="body2" sx={{ color: theme.palette.text.primary, fontWeight: 500 }}>
                                  {task.title}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>
                        )}
                  {visibleColumns.phase && (
                    <TableCell>
                      {task.phase_number ? (
                        <Chip
                          label={getPhaseName(task.phase_number)}
                          size="small"
                          sx={{
                            backgroundColor: theme.palette.action.hover,
                            color: theme.palette.text.primary,
                            border: `1px solid ${theme.palette.divider}`,
                          }}
                        />
                      ) : (
                        <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
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
                              color: theme.palette.text.primary,
                              backgroundColor: theme.palette.action.hover,
                              '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: theme.palette.divider,
                              },
                              '& .MuiSvgIcon-root': {
                                color: theme.palette.text.primary,
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
                              color: theme.palette.text.primary,
                              backgroundColor: theme.palette.action.hover,
                              '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: theme.palette.divider,
                              },
                              '& .MuiSvgIcon-root': {
                                color: theme.palette.text.primary,
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
                              <Typography variant="body2" sx={{ color: theme.palette.text.primary }}>
                                {(task as ProjectTaskExtended).assignee?.name || (task as ProjectTaskExtended).assignee?.email || 'Unknown'}
                              </Typography>
                            </>
                          ) : task.assignee_id ? (
                            <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem', bgcolor: theme.palette.text.primary, color: theme.palette.background.default }}>
                              {task.assignee_id.substring(0, 2).toUpperCase()}
                            </Avatar>
                          ) : (
                            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
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
                              color: theme.palette.text.primary,
                              backgroundColor: theme.palette.action.hover,
                              '& fieldset': {
                                borderColor: theme.palette.divider,
                              },
                              '&:hover fieldset': {
                                borderColor: theme.palette.text.secondary,
                              },
                              '&.Mui-focused fieldset': {
                                borderColor: theme.palette.text.primary,
                              },
                            },
                          }}
                        />
                      ) : (
                        <Typography
                          variant="body2"
                          sx={{
                            color: theme.palette.text.primary,
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
                              color: theme.palette.text.primary,
                              backgroundColor: theme.palette.action.hover,
                              '& fieldset': {
                                borderColor: theme.palette.divider,
                              },
                              '&:hover fieldset': {
                                borderColor: theme.palette.text.secondary,
                              },
                              '&.Mui-focused fieldset': {
                                borderColor: theme.palette.text.primary,
                              },
                            },
                          }}
                        />
                      ) : (
                        <Typography
                          variant="body2"
                          sx={{
                            color: theme.palette.text.primary,
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
                      sx={{ color: theme.palette.text.primary }}
                      aria-label={`Actions menu for task ${task.title}`}
                    >
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
                
                {/* Subtask Rows - shown when expanded */}
                {isExpanded && subtasks.map((subtask) => {
                  const assignee = (subtask as ProjectTaskExtended).assignee;
                  return (
                    <TableRow
                      key={subtask.id}
                      onClick={() => onTaskClick(subtask)}
                      sx={{
                        cursor: 'pointer',
                        bgcolor: alpha(theme.palette.common.black, 0.05),
                        '&:hover': {
                          bgcolor: alpha(theme.palette.common.black, 0.08),
                        },
                      }}
                    >
                      {visibleColumns.status && (
                        <TableCell>
                          <Chip
                            label={subtask.status.replace('_', ' ')}
                            size="small"
                            sx={{
                              height: 24,
                              fontSize: '0.75rem',
                              bgcolor: `${STATUS_COLORS[subtask.status]}20`,
                              color: STATUS_COLORS[subtask.status],
                              border: `1px solid ${STATUS_COLORS[subtask.status]}40`,
                            }}
                          />
                        </TableCell>
                      )}
                      {visibleColumns.title && (
                        <TableCell sx={{ pl: 4 }}>
                          <Typography variant="body2" fontWeight={500} noWrap>
                            {subtask.title}
                          </Typography>
                        </TableCell>
                      )}
                      {visibleColumns.phase && (
                        <TableCell>
                          {subtask.phase_number ? (
                            <Chip
                              label={getPhaseName(subtask.phase_number)}
                              size="small"
                              sx={{
                                height: 24,
                                fontSize: '0.75rem',
                                bgcolor: theme.palette.action.hover,
                                color: theme.palette.text.primary,
                              }}
                            />
                          ) : (
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                              -
                            </Typography>
                          )}
                        </TableCell>
                      )}
                      {visibleColumns.priority && (
                        <TableCell>
                          <Chip
                            label={subtask.priority}
                            size="small"
                            sx={{
                              height: 24,
                              fontSize: '0.75rem',
                              bgcolor: `${PRIORITY_COLORS[subtask.priority]}20`,
                              color: PRIORITY_COLORS[subtask.priority],
                              border: `1px solid ${PRIORITY_COLORS[subtask.priority]}40`,
                            }}
                          />
                        </TableCell>
                      )}
                      {visibleColumns.assignee && (
                        <TableCell>
                          {assignee ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Avatar
                                src={assignee.avatar_url || undefined}
                                sx={{ width: 24, height: 24, fontSize: '0.75rem' }}
                              >
                                {(assignee.name || assignee.email || 'U').substring(0, 2).toUpperCase()}
                              </Avatar>
                              <Typography variant="body2" sx={{ fontSize: '0.875rem' }} noWrap>
                                {assignee.name || assignee.email}
                              </Typography>
                            </Box>
                          ) : (
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem', fontStyle: 'italic' }}>
                              Unassigned
                            </Typography>
                          )}
                        </TableCell>
                      )}
                      {visibleColumns.startDate && (
                        <TableCell>
                          {subtask.start_date ? (
                            <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                              {new Date(subtask.start_date).toLocaleDateString()}
                            </Typography>
                          ) : (
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                              -
                            </Typography>
                          )}
                        </TableCell>
                      )}
                      {visibleColumns.dueDate && (
                        <TableCell>
                          {subtask.due_date ? (
                            <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                              {new Date(subtask.due_date).toLocaleDateString()}
                            </Typography>
                          ) : (
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                              -
                            </Typography>
                          )}
                        </TableCell>
                      )}
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                          {subtask.status !== 'done' && (
                            <IconButton
                              size="small"
                              onClick={async () => {
                                if (onTaskUpdate) {
                                  await onTaskUpdate(subtask.id, { status: 'done' });
                                  handleSubtaskUpdated(subtask.id, { status: 'done' });
                                }
                              }}
                              title="Mark as done"
                              sx={{
                                p: 0.5,
                                color: theme.palette.success.main,
                                '&:hover': {
                                  bgcolor: `${theme.palette.success.main}20`,
                                },
                              }}
                            >
                              <CheckCircleIcon fontSize="small" />
                            </IconButton>
                          )}
                          {onTaskDelete && (
                            <IconButton
                              size="small"
                              onClick={async () => {
                                if (confirm('Are you sure you want to delete this subtask?')) {
                                  await onTaskDelete(subtask.id);
                                  handleSubtaskDeleted(subtask.id);
                                }
                              }}
                              color="error"
                              title="Delete subtask"
                              sx={{ p: 0.5 }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {/* Add Subtask Form Row */}
                {isExpanded && addingSubtaskTo === task.id && (
                  <TableRow>
                    <TableCell colSpan={Object.values(visibleColumns).filter(Boolean).length + 1} sx={{ p: 0, borderBottom: 'none' }}>
                      <SubtaskPanel
                        parentTaskId={task.id}
                        parentTask={task}
                        projectId={projectId}
                        subtasks={subtasks}
                        projectMembers={projectMembers}
                        onSubtaskCreated={(subtask) => {
                          handleSubtaskCreated(subtask);
                          setAddingSubtaskTo(null);
                        }}
                        onSubtaskUpdated={handleSubtaskUpdated}
                        onSubtaskDeleted={handleSubtaskDeleted}
                        onSubtaskClick={onTaskClick}
                        phaseNames={phaseNames}
                        visibleColumns={visibleColumns}
                        onCancel={() => setAddingSubtaskTo(null)}
                      />
                    </TableCell>
                  </TableRow>
                )}
                {/* Add Subtask Button Row */}
                {isExpanded && addingSubtaskTo !== task.id && (
                  <TableRow
                    sx={{
                      bgcolor: alpha(theme.palette.common.black, 0.05),
                    }}
                  >
                    <TableCell colSpan={Object.values(visibleColumns).filter(Boolean).length + 1} sx={{ pl: 4, py: 0.5 }}>
                      <Tooltip title="Add Subtask" arrow>
                        <IconButton
                          size="small"
                          onClick={() => setAddingSubtaskTo(task.id)}
                          sx={{
                            color: theme.palette.text.secondary,
                            '&:hover': {
                              color: theme.palette.text.primary,
                              bgcolor: theme.palette.action.hover,
                            },
                          }}
                        >
                          <AddIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
                  );
                })}
              </>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Task Count */}
      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
          Showing {filteredAndSortedTasks.length} of {tasks.length} tasks
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
            To Do: {tasks.filter((t) => t.status === 'todo').length}
          </Typography>
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
            In Progress: {tasks.filter((t) => t.status === 'in_progress').length}
          </Typography>
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
            Done: {tasks.filter((t) => t.status === 'done').length}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

