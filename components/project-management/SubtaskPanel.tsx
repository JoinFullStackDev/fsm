'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  IconButton,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  Avatar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  Grid,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import type { ProjectTask, ProjectTaskExtended } from '@/types/project';
import type { User } from '@/types/project';
import { DEFAULT_PHASE_NAMES, STATUS_COLORS, PRIORITY_COLORS } from '@/lib/constants';

interface SubtaskPanelProps {
  parentTaskId: string;
  parentTask?: ProjectTask | ProjectTaskExtended;
  projectId: string;
  subtasks: (ProjectTask | ProjectTaskExtended)[];
  projectMembers: User[];
  onSubtaskCreated: (subtask: ProjectTask | ProjectTaskExtended) => void;
  onSubtaskUpdated: (subtaskId: string, updates: Partial<ProjectTask>) => void;
  onSubtaskDeleted: (subtaskId: string) => void;
  onSubtaskClick?: (subtask: ProjectTask | ProjectTaskExtended) => void;
  phaseNames?: Record<number, string>;
  visibleColumns?: {
    status: boolean;
    title: boolean;
    phase: boolean;
    priority: boolean;
    assignee: boolean;
    startDate: boolean;
    dueDate: boolean;
  };
  onCancel?: () => void;
}

export default function SubtaskPanel({
  parentTaskId,
  parentTask,
  projectId,
  subtasks,
  projectMembers,
  onSubtaskCreated,
  onSubtaskUpdated,
  onSubtaskDeleted,
  onSubtaskClick,
  phaseNames = {},
  visibleColumns = {
    status: true,
    title: true,
    phase: true,
    priority: true,
    assignee: true,
    startDate: true,
    dueDate: true,
  },
  onCancel,
}: SubtaskPanelProps) {
  const theme = useTheme();
  const [isAdding, setIsAdding] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newSubtaskDescription, setNewSubtaskDescription] = useState('');
  const [newSubtaskStatus, setNewSubtaskStatus] = useState<'todo' | 'in_progress' | 'done' | 'archived'>('todo');
  const [newSubtaskPriority, setNewSubtaskPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [newSubtaskAssigneeId, setNewSubtaskAssigneeId] = useState<string>('');
  const [newSubtaskStartDate, setNewSubtaskStartDate] = useState<string>('');
  const [newSubtaskDueDate, setNewSubtaskDueDate] = useState<string>('');
  const [newSubtaskTags, setNewSubtaskTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getPhaseName = (phaseNumber: number | null): string => {
    if (!phaseNumber) return 'Unassigned';
    return phaseNames[phaseNumber] || DEFAULT_PHASE_NAMES[phaseNumber] || `Phase ${phaseNumber}`;
  };

  // Load available tags from existing subtasks
  useEffect(() => {
    const tags = new Set<string>();
    subtasks.forEach((task) => {
      if (task.tags && Array.isArray(task.tags)) {
        task.tags.forEach((tag) => {
          if (tag && typeof tag === 'string') {
            tags.add(tag.trim());
          }
        });
      }
    });
    setAvailableTags(Array.from(tags).sort());
  }, [subtasks]);

  const handleAddSubtask = async () => {
    if (!newSubtaskTitle.trim()) {
      setError('Subtask title is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/tasks/${parentTaskId}/subtasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newSubtaskTitle.trim(),
          description: newSubtaskDescription.trim() || null,
          status: newSubtaskStatus,
          priority: newSubtaskPriority,
          assignee_id: newSubtaskAssigneeId || null,
          start_date: newSubtaskStartDate || null,
          due_date: newSubtaskDueDate || null,
          tags: newSubtaskTags,
          // Phase and dependencies will be auto-set by the API from parent task
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create subtask');
      }

      onSubtaskCreated(data);
      // Reset form
      setNewSubtaskTitle('');
      setNewSubtaskDescription('');
      setNewSubtaskStatus('todo');
      setNewSubtaskPriority('medium');
      setNewSubtaskAssigneeId('');
      setNewSubtaskStartDate('');
      setNewSubtaskDueDate('');
      setNewSubtaskTags([]);
      setIsAdding(false);
      if (onCancel) {
        onCancel();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create subtask');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setIsAdding(false);
    setNewSubtaskTitle('');
    setNewSubtaskDescription('');
    setNewSubtaskStatus('todo');
    setNewSubtaskPriority('medium');
    setNewSubtaskAssigneeId('');
    setNewSubtaskStartDate('');
    setNewSubtaskDueDate('');
    setNewSubtaskTags([]);
    setError(null);
    if (onCancel) {
      onCancel();
    }
  };


  const handleMarkAsDone = async (subtaskId: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/tasks/${subtaskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'done',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update subtask');
      }

      const updated = await response.json();
      onSubtaskUpdated(subtaskId, {
        status: 'done',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark subtask as done');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (subtaskId: string) => {
    if (!confirm('Are you sure you want to delete this subtask?')) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/tasks/${subtaskId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete subtask');
      }

      onSubtaskDeleted(subtaskId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete subtask');
    } finally {
      setLoading(false);
    }
  };

  // If we're only showing the add form (when called from TaskTable), show it immediately
  useEffect(() => {
    if (onCancel && !isAdding) {
      setIsAdding(true);
    }
  }, [onCancel]);

  return (
    <Box
      sx={{
        bgcolor: 'background.default',
        borderLeft: `3px solid ${theme.palette.primary.main}`,
        pl: 2,
        pr: 1,
        py: 1,
      }}
    >
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {isAdding && (
        <Box sx={{ mb: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Subtask Title *"
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                placeholder="Enter subtask title..."
                autoFocus
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                multiline
                rows={3}
                label="Description"
                value={newSubtaskDescription}
                onChange={(e) => setNewSubtaskDescription(e.target.value)}
                placeholder="Enter description..."
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={newSubtaskStatus}
                  onChange={(e) => setNewSubtaskStatus(e.target.value as any)}
                  label="Status"
                >
                  <MenuItem value="todo">To Do</MenuItem>
                  <MenuItem value="in_progress">In Progress</MenuItem>
                  <MenuItem value="done">Done</MenuItem>
                  <MenuItem value="archived">Archived</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Priority</InputLabel>
                <Select
                  value={newSubtaskPriority}
                  onChange={(e) => setNewSubtaskPriority(e.target.value as any)}
                  label="Priority"
                >
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="critical">Critical</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Assignee</InputLabel>
                <Select
                  value={newSubtaskAssigneeId}
                  onChange={(e) => setNewSubtaskAssigneeId(e.target.value)}
                  label="Assignee"
                  displayEmpty
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
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                type="date"
                label="Start Date"
                value={newSubtaskStartDate}
                onChange={(e) => setNewSubtaskStartDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                type="date"
                label="Due Date"
                value={newSubtaskDueDate}
                onChange={(e) => setNewSubtaskDueDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <Autocomplete
                multiple
                freeSolo
                options={availableTags}
                value={newSubtaskTags}
                onChange={(_, newValue) => {
                  setNewSubtaskTags(newValue);
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    size="small"
                    label="Tags"
                    placeholder="Add tags..."
                  />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      {...getTagProps({ index })}
                      key={index}
                      label={option}
                      size="small"
                    />
                  ))
                }
              />
            </Grid>
            {parentTask && (
              <Grid item xs={12}>
                <Alert severity="info" sx={{ fontSize: '0.875rem' }}>
                  This subtask will automatically inherit Phase: <strong>{getPhaseName(parentTask.phase_number)}</strong> and depend on the parent task.
                </Alert>
              </Grid>
            )}
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                <Button size="small" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  onClick={handleAddSubtask}
                  disabled={loading || !newSubtaskTitle.trim()}
                  startIcon={loading ? <CircularProgress size={16} /> : <CheckIcon />}
                >
                  Add Subtask
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Box>
      )}

    </Box>
  );
}

