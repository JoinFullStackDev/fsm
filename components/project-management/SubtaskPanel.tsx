'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Typography,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Check as CheckIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import type { ProjectTask, ProjectTaskExtended } from '@/types/project';
import type { User } from '@/types/project';

interface SubtaskPanelProps {
  parentTaskId: string;
  projectId: string;
  subtasks: (ProjectTask | ProjectTaskExtended)[];
  projectMembers: User[];
  onSubtaskCreated: (subtask: ProjectTask | ProjectTaskExtended) => void;
  onSubtaskUpdated: (subtaskId: string, updates: Partial<ProjectTask>) => void;
  onSubtaskDeleted: (subtaskId: string) => void;
}

export default function SubtaskPanel({
  parentTaskId,
  projectId,
  subtasks,
  projectMembers,
  onSubtaskCreated,
  onSubtaskUpdated,
  onSubtaskDeleted,
}: SubtaskPanelProps) {
  const theme = useTheme();
  const [isAdding, setIsAdding] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newSubtaskDescription, setNewSubtaskDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingDescription, setEditingDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create subtask');
      }

      onSubtaskCreated(data);
      setNewSubtaskTitle('');
      setNewSubtaskDescription('');
      setIsAdding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create subtask');
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (subtask: ProjectTask | ProjectTaskExtended) => {
    setEditingId(subtask.id);
    setEditingTitle(subtask.title);
    setEditingDescription(subtask.description || '');
  };

  const handleSaveEdit = async (subtaskId: string) => {
    if (!editingTitle.trim()) {
      setError('Subtask title is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/tasks/${subtaskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editingTitle.trim(),
          description: editingDescription.trim() || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update subtask');
      }

      const updated = await response.json();
      onSubtaskUpdated(subtaskId, {
        title: updated.title,
        description: updated.description,
      });

      setEditingId(null);
      setEditingTitle('');
      setEditingDescription('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update subtask');
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

  return (
    <Box
      sx={{
        pl: 4,
        pr: 2,
        py: 2,
        bgcolor: 'background.default',
        borderLeft: `3px solid ${theme.palette.primary.main}`,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="subtitle2" fontWeight={600} color="text.secondary">
          Subtasks ({subtasks.length})
        </Typography>
        {!isAdding && (
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setIsAdding(true)}
            sx={{ minWidth: 'auto' }}
          >
            Add Subtask
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {isAdding && (
        <Box sx={{ mb: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
          <TextField
            fullWidth
            size="small"
            label="Subtask Title"
            value={newSubtaskTitle}
            onChange={(e) => setNewSubtaskTitle(e.target.value)}
            placeholder="Enter subtask title..."
            sx={{ mb: 1 }}
            autoFocus
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAddSubtask();
              }
            }}
          />
          <TextField
            fullWidth
            size="small"
            multiline
            rows={2}
            label="Description (Optional)"
            value={newSubtaskDescription}
            onChange={(e) => setNewSubtaskDescription(e.target.value)}
            placeholder="Enter description..."
            sx={{ mb: 1 }}
          />
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            <Button
              size="small"
              onClick={() => {
                setIsAdding(false);
                setNewSubtaskTitle('');
                setNewSubtaskDescription('');
                setError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={handleAddSubtask}
              disabled={loading || !newSubtaskTitle.trim()}
              startIcon={loading ? <CircularProgress size={16} /> : <CheckIcon />}
            >
              Add
            </Button>
          </Box>
        </Box>
      )}

      {subtasks.length === 0 && !isAdding ? (
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', py: 2 }}>
          No subtasks yet. Click &quot;Add Subtask&quot; to create one.
        </Typography>
      ) : (
        <List dense>
          {subtasks.map((subtask) => (
            <ListItem
              key={subtask.id}
              sx={{
                bgcolor: 'background.paper',
                mb: 1,
                borderRadius: 1,
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              {editingId === subtask.id ? (
                <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <TextField
                    fullWidth
                    size="small"
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    autoFocus
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSaveEdit(subtask.id);
                      }
                    }}
                  />
                  <TextField
                    fullWidth
                    size="small"
                    multiline
                    rows={2}
                    value={editingDescription}
                    onChange={(e) => setEditingDescription(e.target.value)}
                  />
                  <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                    <IconButton
                      size="small"
                      onClick={() => {
                        setEditingId(null);
                        setEditingTitle('');
                        setEditingDescription('');
                      }}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleSaveEdit(subtask.id)}
                      disabled={loading || !editingTitle.trim()}
                    >
                      <CheckIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
              ) : (
                <>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" fontWeight={500}>
                          {subtask.title}
                        </Typography>
                        <Chip
                          label={subtask.status}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: '0.7rem',
                            bgcolor:
                              subtask.status === 'done'
                                ? theme.palette.success.main
                                : subtask.status === 'in_progress'
                                ? theme.palette.warning.main
                                : theme.palette.action.disabledBackground,
                            color: subtask.status === 'done' ? '#fff' : 'text.primary',
                          }}
                        />
                      </Box>
                    }
                    secondary={
                      subtask.description ? (
                        <Typography variant="caption" color="text.secondary">
                          {subtask.description}
                        </Typography>
                      ) : null
                    }
                  />
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton
                      size="small"
                      onClick={() => handleStartEdit(subtask)}
                      disabled={loading}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(subtask.id)}
                      disabled={loading}
                      color="error"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </>
              )}
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
}

