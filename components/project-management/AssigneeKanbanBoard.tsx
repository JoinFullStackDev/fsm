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
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  FilterList as FilterListIcon,
  Person as PersonIcon,
  SubdirectoryArrowRight as SubtaskIcon,
} from '@mui/icons-material';
import type { ProjectTask, ProjectTaskExtended } from '@/types/project';
import type { User } from '@/types/project';

interface AssigneeKanbanBoardProps {
  tasks: (ProjectTask | ProjectTaskExtended)[];
  onTaskClick: (task: ProjectTask | ProjectTaskExtended) => void;
  projectMembers?: User[];
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
  '#7A8B8B', // Muted teal-gray
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

interface AssigneeColumn {
  assigneeId: string | null;
  assignee: {
    id: string;
    name: string | null;
    email: string;
    avatar_url?: string | null;
  } | null;
  tasks: (ProjectTask | ProjectTaskExtended)[];
  color: string;
}

export default function AssigneeKanbanBoard({ 
  tasks, 
  onTaskClick,
  projectMembers = [],
}: AssigneeKanbanBoardProps) {
  const theme = useTheme();
  const [visibleAssignees, setVisibleAssignees] = useState<Set<string | null>>(new Set());
  const [filterMenuAnchor, setFilterMenuAnchor] = useState<null | HTMLElement>(null);

  // Create a map of subtasks by parent task ID
  const subtasksByParent = useMemo(() => {
    const map = new Map<string, (ProjectTask | ProjectTaskExtended)[]>();
    tasks.forEach((task) => {
      if (task.parent_task_id) {
        if (!map.has(task.parent_task_id)) {
          map.set(task.parent_task_id, []);
        }
        map.get(task.parent_task_id)!.push(task);
      }
    });
    return map;
  }, [tasks]);

  // Group tasks by assignee
  const assigneeColumns = useMemo(() => {
    const grouped: Map<string | null, (ProjectTask | ProjectTaskExtended)[]> = new Map();
    
    // First, collect all assignees from tasks
    const assigneeMap = new Map<string | null, {
      id: string;
      name: string | null;
      email: string;
      avatar_url?: string | null;
    } | null>();

    tasks.forEach((task) => {
      const assigneeId = task.assignee_id;
      
      // Store assignee info if available
      const taskWithAssignee = task as ProjectTaskExtended;
      if (taskWithAssignee.assignee) {
        assigneeMap.set(assigneeId, taskWithAssignee.assignee);
      } else if (assigneeId) {
        // Try to find assignee in projectMembers
        const member = projectMembers.find(m => m.id === assigneeId);
        if (member) {
          assigneeMap.set(assigneeId, {
            id: member.id,
            name: member.name,
            email: member.email,
            avatar_url: member.avatar_url,
          });
        } else {
          assigneeMap.set(assigneeId, null);
        }
      } else {
        assigneeMap.set(null, null);
      }

      // Group task by assignee (only non-subtasks - subtasks appear below their parents)
      if (!task.parent_task_id) {
        if (!grouped.has(assigneeId)) {
          grouped.set(assigneeId, []);
        }
        grouped.get(assigneeId)!.push(task);
      }
    });

    // Convert to array of columns, starting with unassigned
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
  }, [tasks, projectMembers]);

  // Initialize visible assignees to show all by default
  useEffect(() => {
    if (visibleAssignees.size === 0 && assigneeColumns.length > 0) {
      const allIds = new Set(assigneeColumns.map(col => col.assigneeId));
      setVisibleAssignees(allIds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assigneeColumns.length]); // Only depend on length to avoid infinite loops

  // Filter columns based on visibility
  const visibleColumns = useMemo(() => {
    return assigneeColumns.filter(col => visibleAssignees.has(col.assigneeId));
  }, [assigneeColumns, visibleAssignees]);

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

  // Helper function to render a task card
  const renderTaskCard = (task: ProjectTask | ProjectTaskExtended, isReference: boolean = false) => {
    const phaseColor = task.phase_number
      ? PHASE_COLORS[task.phase_number] || theme.palette.text.secondary
      : theme.palette.text.secondary;
    const priorityColor = PRIORITY_COLORS[task.priority] || theme.palette.text.secondary;
    const isSubtask = !!task.parent_task_id;
    const taskWithParent = task as ProjectTaskExtended;
    const parentTask = taskWithParent.parent_task;

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
        {/* Parent Task Reference for Subtasks */}
        {isSubtask && parentTask && (
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
            <SubtaskIcon sx={{ fontSize: 14, color: theme.palette.text.secondary }} />
            <Typography
              variant="caption"
              sx={{
                color: theme.palette.text.secondary,
                fontSize: '0.7rem',
                fontStyle: 'italic',
              }}
            >
              Subtask of: {parentTask.title}
            </Typography>
          </Box>
        )}

        {/* Reference indicator for subtasks shown below parent */}
        {isReference && (
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
            <Typography
              variant="caption"
              sx={{
                color: theme.palette.text.secondary,
                fontSize: '0.7rem',
                fontStyle: 'italic',
              }}
            >
              Referenced from: {task.assignee_id ? 'another assignee' : 'unassigned'}
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
          {isSubtask && (
            <SubtaskIcon
              sx={{
                fontSize: 16,
                color: theme.palette.text.secondary,
                verticalAlign: 'middle',
                mr: 0.5,
              }}
            />
          )}
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
                    border: `1px solid ${theme.palette.divider}`,
                  }}
                />
              </Tooltip>
            )}

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
          </Box>

          {/* Status Badge */}
          <Chip
            label={task.status.replace('_', ' ').toUpperCase()}
            size="small"
            sx={{
              backgroundColor: theme.palette.action.hover,
              color: theme.palette.text.secondary,
              border: `1px solid ${theme.palette.divider}`,
              fontSize: '0.65rem',
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
      {/* Column Visibility Filter */}
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
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
          Filter Columns ({visibleColumns.length}/{assigneeColumns.length})
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
            No columns visible. Use the filter button to show assignee columns.
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
          {visibleColumns.map((column) => {
          return (
            <Box
              key={column.assigneeId || 'unassigned'}
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
                  // Check if this task has subtasks
                  const subtasks = subtasksByParent.get(task.id) || [];
                  
                  return (
                    <Box key={task.id}>
                      {/* Render the parent task */}
                      {renderTaskCard(task)}
                      
                      {/* Render subtasks directly below parent (even if they're assigned to different people) */}
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
          );
        })}
        </Box>
      )}
    </Box>
  );
}
