'use client';

import { useMemo, useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  Avatar,
  Tooltip,
  Checkbox,
  FormControlLabel,
  Menu,
  MenuItem,
  IconButton,
  Button,
  Divider,
  FormControl,
  InputLabel,
  Select,
  SelectChangeEvent,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  FilterList as FilterListIcon,
  Person as PersonIcon,
  Folder as ProjectIcon,
  SubdirectoryArrowRight as SubtaskIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';

interface TeamTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  assignee_id: string | null;
  project_id: string;
  phase_number?: number | null;
  parent_task_id?: string | null;
  tags?: string[];
  estimated_hours?: number | null;
  project?: {
    id: string;
    name: string;
  };
  assignee?: {
    id: string;
    name: string | null;
    email: string;
    avatar_url?: string | null;
  } | null;
}

interface TeamMember {
  id: string;
  user_id: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

interface Project {
  id: string;
  name: string;
  status: string;
}

interface TeamKanbanBoardProps {
  tasks: TeamTask[];
  teamMembers: TeamMember[];
  projects: Project[];
  teamColor: string;
  onTaskClick: (task: TeamTask) => void;
}

// Muted colors for assignee columns
const ASSIGNEE_COLORS: string[] = [
  '#8B7D8B', // Muted purple-gray
  '#7A8B8B', // Muted teal-gray
  '#8B8B7A', // Muted olive-gray
  '#7A7A8B', // Muted blue-gray
  '#8B7A7A', // Muted rose-gray
  '#7A8B7A', // Muted green-gray
  '#8B8B8B', // Muted gray
];

const PRIORITY_COLORS: Record<string, string> = {
  low: '#4CAF50',
  medium: '#FF9800',
  high: '#FF5722',
  critical: '#F44336',
};

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Done' },
];

const PRIORITY_OPTIONS = [
  { value: '', label: 'All Priorities' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

interface AssigneeColumn {
  assigneeId: string | null;
  assignee: {
    id: string;
    name: string | null;
    email: string;
    avatar_url?: string | null;
  } | null;
  tasks: TeamTask[];
  color: string;
}

export default function TeamKanbanBoard({ 
  tasks, 
  teamMembers,
  projects,
  teamColor,
  onTaskClick,
}: TeamKanbanBoardProps) {
  const theme = useTheme();
  const [visibleAssignees, setVisibleAssignees] = useState<Set<string | null>>(new Set());
  const [filterMenuAnchor, setFilterMenuAnchor] = useState<null | HTMLElement>(null);
  
  // Filter states
  const [projectFilter, setProjectFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');

  // Build member lookup map
  const memberLookup = useMemo(() => {
    const map = new Map<string, { id: string; name: string | null; email: string }>();
    teamMembers.forEach((m) => {
      if (m.user) {
        map.set(m.user_id, m.user);
      }
    });
    return map;
  }, [teamMembers]);

  // Filter tasks based on selected filters
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (projectFilter && task.project_id !== projectFilter) return false;
      if (statusFilter && task.status !== statusFilter) return false;
      if (priorityFilter && task.priority !== priorityFilter) return false;
      return true;
    });
  }, [tasks, projectFilter, statusFilter, priorityFilter]);

  // Group tasks by assignee
  const assigneeColumns = useMemo(() => {
    const grouped: Map<string | null, TeamTask[]> = new Map();
    
    const assigneeMap = new Map<string | null, {
      id: string;
      name: string | null;
      email: string;
      avatar_url?: string | null;
    } | null>();

    filteredTasks.forEach((task) => {
      const assigneeId = task.assignee_id;
      
      // Store assignee info if available
      if (task.assignee) {
        assigneeMap.set(assigneeId, task.assignee);
      } else if (assigneeId) {
        const member = memberLookup.get(assigneeId);
        if (member) {
          assigneeMap.set(assigneeId, member);
        } else {
          assigneeMap.set(assigneeId, null);
        }
      } else {
        assigneeMap.set(null, null);
      }

      // Group task by assignee (only non-subtasks)
      if (!task.parent_task_id) {
        if (!grouped.has(assigneeId)) {
          grouped.set(assigneeId, []);
        }
        grouped.get(assigneeId)!.push(task);
      }
    });

    // Convert to array of columns
    const columns: AssigneeColumn[] = [];
    
    // Add unassigned column first
    const unassignedTasks = grouped.get(null) || [];
    if (unassignedTasks.length > 0) {
      columns.push({
        assigneeId: null,
        assignee: null,
        tasks: unassignedTasks,
        color: ASSIGNEE_COLORS[0],
      });
    }

    // Add assigned columns, sorted by assignee name
    const assignedEntries = Array.from(grouped.entries())
      .filter(([id]) => id !== null)
      .sort((a, b) => {
        const assigneeA = assigneeMap.get(a[0]);
        const assigneeB = assigneeMap.get(b[0]);
        const nameA = assigneeA?.name || assigneeA?.email || '';
        const nameB = assigneeB?.name || assigneeB?.email || '';
        return nameA.localeCompare(nameB);
      });

    assignedEntries.forEach(([assigneeId, taskList], index) => {
      columns.push({
        assigneeId,
        assignee: assigneeMap.get(assigneeId) || null,
        tasks: taskList,
        color: ASSIGNEE_COLORS[(index + 1) % ASSIGNEE_COLORS.length],
      });
    });

    return columns;
  }, [filteredTasks, memberLookup]);

  // Initialize visible assignees - show all by default when columns first load
  const [hasInitialized, setHasInitialized] = useState(false);
  
  useEffect(() => {
    if (!hasInitialized && assigneeColumns.length > 0) {
      const allIds = new Set(assigneeColumns.map(col => col.assigneeId));
      setVisibleAssignees(allIds);
      setHasInitialized(true);
    }
  }, [assigneeColumns, hasInitialized]);

  // Filter columns based on visibility
  const visibleColumns = useMemo(() => {
    return assigneeColumns.filter(col => visibleAssignees.has(col.assigneeId));
  }, [assigneeColumns, visibleAssignees]);

  // Create subtask map
  const subtasksByParent = useMemo(() => {
    const map = new Map<string, TeamTask[]>();
    filteredTasks.forEach((task) => {
      if (task.parent_task_id) {
        if (!map.has(task.parent_task_id)) {
          map.set(task.parent_task_id, []);
        }
        map.get(task.parent_task_id)!.push(task);
      }
    });
    return map;
  }, [filteredTasks]);

  const handleToggleAssignee = (assigneeId: string | null) => {
    setVisibleAssignees(prev => {
      const next = new Set(prev);
      if (next.has(assigneeId)) {
        next.delete(assigneeId);
      } else {
        next.add(assigneeId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const allIds = new Set(assigneeColumns.map(col => col.assigneeId));
    setVisibleAssignees(allIds);
    setFilterMenuAnchor(null);
  };

  const handleDeselectAll = () => {
    setVisibleAssignees(new Set());
    setFilterMenuAnchor(null);
  };

  const handleClearFilters = () => {
    setProjectFilter('');
    setStatusFilter('');
    setPriorityFilter('');
  };

  const hasActiveFilters = projectFilter || statusFilter || priorityFilter;

  // Task card renderer
  const renderTaskCard = (task: TeamTask, isReference: boolean = false) => {
    const priorityColor = PRIORITY_COLORS[task.priority] || theme.palette.text.secondary;
    const isSubtask = !!task.parent_task_id;

    return (
      <Paper
        key={`${task.id}-${isReference ? 'ref' : 'main'}`}
        onClick={() => onTaskClick(task)}
        sx={{
          p: { xs: 1.5, md: 2 },
          backgroundColor: theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`,
          borderLeft: isSubtask ? `4px solid ${theme.palette.text.secondary}` : `1px solid ${theme.palette.divider}`,
          borderRadius: 2,
          cursor: 'pointer',
          transition: 'all 0.2s',
          ml: isSubtask ? 2 : 0,
          opacity: isSubtask ? 0.9 : 1,
          ...(isReference && {
            borderStyle: 'dashed',
            opacity: 0.8,
          }),
          '&:hover': {
            borderColor: theme.palette.text.primary,
            backgroundColor: theme.palette.action.hover,
            transform: { xs: 'none', md: 'translateY(-2px)' },
            boxShadow: { xs: 'none', md: `0 4px 12px ${theme.palette.text.primary}20` },
          },
        }}
      >
        {/* Project Badge */}
        {task.project && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              mb: 1,
              pb: 0.5,
              borderBottom: `1px dashed ${theme.palette.divider}`,
            }}
          >
            <ProjectIcon sx={{ fontSize: 14, color: theme.palette.info.main }} />
            <Typography
              variant="caption"
              sx={{
                color: theme.palette.info.main,
                fontSize: '0.7rem',
                fontWeight: 500,
              }}
            >
              {task.project.name}
            </Typography>
          </Box>
        )}

        {/* Subtask indicator */}
        {isSubtask && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              mb: 1,
            }}
          >
            <SubtaskIcon sx={{ fontSize: 14, color: theme.palette.text.secondary }} />
            <Typography
              variant="caption"
              sx={{
                color: theme.palette.text.secondary,
                fontSize: '0.7rem',
                fontStyle: 'italic',
              }}
            >
              Subtask
            </Typography>
          </Box>
        )}

        {/* Task Title */}
        <Typography
          variant="subtitle1"
          sx={{
            color: theme.palette.text.primary,
            fontWeight: isSubtask ? 500 : 600,
            mb: 1,
            lineHeight: 1.3,
            fontSize: { xs: '0.875rem', md: isSubtask ? '0.9rem' : '1rem' },
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

        {/* Tags */}
        {task.tags && task.tags.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
            {task.tags.slice(0, 2).map((tag, index) => (
              <Chip
                key={index}
                label={tag}
                size="small"
                sx={{
                  backgroundColor: theme.palette.action.hover,
                  color: theme.palette.text.primary,
                  border: `1px solid ${theme.palette.divider}`,
                  fontSize: '0.65rem',
                  height: 18,
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
                  fontSize: '0.65rem',
                  height: 18,
                }}
              />
            )}
          </Box>
        )}

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
            {/* Priority Indicator */}
            <Tooltip title={`Priority: ${task.priority}`}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: priorityColor,
                  border: `1px solid ${theme.palette.divider}`,
                }}
              />
            </Tooltip>

            {/* Due date */}
            {task.due_date && (
              <Typography
                variant="caption"
                sx={{
                  color: new Date(task.due_date) < new Date() 
                    ? theme.palette.error.main 
                    : theme.palette.text.secondary,
                  fontSize: '0.7rem',
                }}
              >
                {new Date(task.due_date).toLocaleDateString()}
              </Typography>
            )}
          </Box>

          {/* Status Badge */}
          <Chip
            label={task.status.replace('_', ' ').toUpperCase()}
            size="small"
            sx={{
              backgroundColor: theme.palette.action.hover,
              color: theme.palette.text.secondary,
              border: `1px solid ${theme.palette.divider}`,
              fontSize: '0.6rem',
              height: 18,
              textTransform: 'uppercase',
            }}
          />
        </Box>
      </Paper>
    );
  };

  const getAssigneeDisplayName = (column: AssigneeColumn): string => {
    if (column.assigneeId === null) {
      return 'Unassigned';
    }
    if (column.assignee) {
      return column.assignee.name || column.assignee.email || 'Unknown';
    }
    return 'Unknown Assignee';
  };

  const getAssigneeInitials = (column: AssigneeColumn): string => {
    if (column.assigneeId === null) {
      return '?';
    }
    if (column.assignee?.name) {
      const names = column.assignee.name.split(' ');
      if (names.length >= 2) {
        return `${names[0][0]}${names[1][0]}`.toUpperCase();
      }
      return names[0][0].toUpperCase();
    }
    if (column.assignee?.email) {
      return column.assignee.email[0].toUpperCase();
    }
    return '?';
  };

  return (
    <Box sx={{ width: '100%', height: '100%', overflow: 'auto', p: { xs: 1, md: 2 } }}>
      {/* Filters Row */}
      <Box 
        sx={{ 
          mb: 2, 
          display: 'flex', 
          flexWrap: 'wrap',
          gap: 2, 
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          {/* Project Filter */}
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel shrink>Project</InputLabel>
            <Select
              value={projectFilter}
              label="Project"
              displayEmpty
              onChange={(e: SelectChangeEvent) => setProjectFilter(e.target.value)}
              renderValue={(selected) => {
                if (!selected) return 'All Projects';
                const project = projects.find(p => p.id === selected);
                return project?.name || 'All Projects';
              }}
            >
              <MenuItem value="">All Projects</MenuItem>
              {projects.map((project) => (
                <MenuItem key={project.id} value={project.id}>
                  {project.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Status Filter */}
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel shrink>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              displayEmpty
              onChange={(e: SelectChangeEvent) => setStatusFilter(e.target.value)}
              renderValue={(selected) => {
                if (!selected) return 'All Statuses';
                const option = STATUS_OPTIONS.find(o => o.value === selected);
                return option?.label || 'All Statuses';
              }}
            >
              {STATUS_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Priority Filter */}
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel shrink>Priority</InputLabel>
            <Select
              value={priorityFilter}
              label="Priority"
              displayEmpty
              onChange={(e: SelectChangeEvent) => setPriorityFilter(e.target.value)}
              renderValue={(selected) => {
                if (!selected) return 'All Priorities';
                const option = PRIORITY_OPTIONS.find(o => o.value === selected);
                return option?.label || 'All Priorities';
              }}
            >
              {PRIORITY_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button
              size="small"
              startIcon={<ClearIcon />}
              onClick={handleClearFilters}
              sx={{
                color: theme.palette.text.secondary,
                '&:hover': {
                  color: theme.palette.text.primary,
                },
              }}
            >
              Clear Filters
            </Button>
          )}
        </Box>

        {/* Assignee Column Filter */}
        <Button
          startIcon={<FilterListIcon />}
          onClick={(e) => setFilterMenuAnchor(e.currentTarget)}
          sx={{
            color: theme.palette.text.secondary,
            border: `1px solid ${theme.palette.divider}`,
            '&:hover': {
              backgroundColor: theme.palette.action.hover,
              color: theme.palette.text.primary,
            },
          }}
        >
          Columns ({visibleColumns.length}/{assigneeColumns.length})
        </Button>
        <Menu
          anchorEl={filterMenuAnchor}
          open={Boolean(filterMenuAnchor)}
          onClose={() => setFilterMenuAnchor(null)}
          PaperProps={{
            sx: {
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              minWidth: 250,
              maxHeight: 400,
              overflow: 'auto',
            },
          }}
        >
          <Box sx={{ p: 1, display: 'flex', gap: 1, borderBottom: `1px solid ${theme.palette.divider}` }}>
            <Button size="small" onClick={handleSelectAll} sx={{ flex: 1 }}>
              Select All
            </Button>
            <Button size="small" onClick={handleDeselectAll} sx={{ flex: 1 }}>
              Deselect All
            </Button>
          </Box>
          {assigneeColumns.map((column) => (
            <MenuItem key={column.assigneeId || 'unassigned'} dense>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={visibleAssignees.has(column.assigneeId)}
                    onChange={() => handleToggleAssignee(column.assigneeId)}
                    size="small"
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {column.assigneeId === null ? (
                      <PersonIcon sx={{ fontSize: 18, color: theme.palette.text.secondary }} />
                    ) : (
                      <Avatar
                        sx={{
                          width: 24,
                          height: 24,
                          fontSize: '0.75rem',
                          backgroundColor: column.color,
                          color: theme.palette.text.primary,
                        }}
                      >
                        {getAssigneeInitials(column)}
                      </Avatar>
                    )}
                    <Typography variant="body2" sx={{ color: theme.palette.text.primary }}>
                      {getAssigneeDisplayName(column)}
                    </Typography>
                    <Chip
                      label={column.tasks.length}
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: '0.7rem',
                        backgroundColor: theme.palette.action.hover,
                        color: theme.palette.text.secondary,
                      }}
                    />
                  </Box>
                }
                sx={{ margin: 0, flex: 1 }}
              />
            </MenuItem>
          ))}
        </Menu>
      </Box>

      {/* Task Count Summary */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
          Showing {filteredTasks.filter(t => !t.parent_task_id).length} tasks
          {hasActiveFilters && ` (filtered from ${tasks.filter(t => !t.parent_task_id).length})`}
        </Typography>
      </Box>

      {/* Kanban Board */}
      {visibleColumns.length === 0 ? (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 400,
            p: 4,
          }}
        >
          <Typography variant="body1" sx={{ color: theme.palette.text.secondary }}>
            {assigneeColumns.length === 0 
              ? 'No tasks found matching the current filters.'
              : 'No columns visible. Use the filter button to show assignee columns.'}
          </Typography>
        </Box>
      ) : (
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
          {visibleColumns.map((column) => (
            <Box
              key={column.assigneeId || 'unassigned'}
              sx={{
                flex: { xs: 'none', md: 1 },
                minWidth: { xs: 300, md: 300 },
                width: { xs: 300, md: 'auto' },
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
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                    {column.assigneeId === null ? (
                      <PersonIcon sx={{ fontSize: 20, color: theme.palette.text.secondary }} />
                    ) : column.assignee?.avatar_url ? (
                      <Avatar
                        src={column.assignee.avatar_url}
                        sx={{ width: 24, height: 24 }}
                      >
                        {getAssigneeInitials(column)}
                      </Avatar>
                    ) : (
                      <Avatar
                        sx={{
                          width: 24,
                          height: 24,
                          fontSize: '0.75rem',
                          backgroundColor: column.color,
                          color: theme.palette.text.primary,
                        }}
                      >
                        {getAssigneeInitials(column)}
                      </Avatar>
                    )}
                    <Typography
                      variant="h6"
                      sx={{
                        color: theme.palette.text.primary,
                        fontWeight: 600,
                        fontSize: { xs: '0.8rem', md: '0.9rem' },
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {getAssigneeDisplayName(column)}
                    </Typography>
                  </Box>
                  <Chip
                    label={column.tasks.length}
                    size="small"
                    sx={{
                      backgroundColor: theme.palette.action.hover,
                      color: theme.palette.text.primary,
                      border: `1px solid ${theme.palette.divider}`,
                      fontWeight: 'bold',
                    }}
                  />
                </Box>
                {column.assignee?.email && column.assigneeId !== null && (
                  <Typography
                    variant="caption"
                    sx={{
                      color: theme.palette.text.secondary,
                      fontSize: '0.7rem',
                      display: 'block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {column.assignee.email}
                  </Typography>
                )}
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
                {column.tasks.map((task) => {
                  const subtasks = subtasksByParent.get(task.id) || [];
                  
                  return (
                    <Box key={task.id}>
                      {renderTaskCard(task)}
                      
                      {subtasks.length > 0 && (
                        <Box sx={{ ml: 2, mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                          {subtasks.map((subtask) => renderTaskCard(subtask, true))}
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

