'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Chip,
  Tooltip,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  DragHandle as DragHandleIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { useNotification } from '@/components/providers/NotificationProvider';
import { createSupabaseClient } from '@/lib/supabaseClient';
import type { TemplatePhase } from '@/types/project';

interface PhaseManagerProps {
  templateId: string;
  onPhasesChange?: () => void;
}

interface PhaseItemProps {
  phase: TemplatePhase;
  onEdit: (phase: TemplatePhase) => void;
  onDelete: (phaseId: string) => void;
  isDragging?: boolean;
}

function PhaseItem({ phase, onEdit, onDelete, isDragging }: PhaseItemProps) {
  const theme = useTheme();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: phase.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.5 : 1,
  };

  return (
    <ListItem
      ref={setNodeRef}
      style={style}
      sx={{
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 1,
        mb: 1,
        backgroundColor: theme.palette.background.paper,
        '&:hover': {
          backgroundColor: theme.palette.action.hover,
        },
      }}
    >
      <Box
        {...attributes}
        {...listeners}
        sx={{
          display: 'flex',
          alignItems: 'center',
          cursor: 'grab',
          mr: 2,
          '&:active': {
            cursor: 'grabbing',
          },
        }}
      >
        <DragHandleIcon sx={{ color: theme.palette.text.primary }} />
      </Box>
      <ListItemText
        primary={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body1" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
              {phase.phase_name}
            </Typography>
            <Chip
              label={`Phase ${phase.phase_number}`}
              size="small"
              sx={{
                backgroundColor: theme.palette.action.hover,
                color: theme.palette.text.primary,
                border: `1px solid ${theme.palette.divider}`,
                fontSize: '0.7rem',
              }}
            />
            <Chip
              label={`Order: ${phase.display_order}`}
              size="small"
              sx={{
                backgroundColor: theme.palette.action.hover,
                color: theme.palette.text.secondary,
                border: `1px solid ${theme.palette.divider}`,
                fontSize: '0.7rem',
              }}
            />
          </Box>
        }
        secondary={
          <Typography variant="caption" sx={{ color: theme.palette.text.secondary, mt: 0.5 }}>
            {phase.is_active ? 'Active' : 'Inactive'}
          </Typography>
        }
      />
      <ListItemSecondaryAction>
        <Tooltip title="Edit Phase">
          <IconButton
            edge="end"
            onClick={() => onEdit(phase)}
            sx={{ 
              color: theme.palette.text.primary, 
              mr: 1,
              '&:hover': {
                backgroundColor: theme.palette.action.hover,
              },
            }}
          >
            <EditIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete Phase">
          <IconButton
            edge="end"
            onClick={() => onDelete(phase.id)}
            sx={{ 
              color: theme.palette.text.primary,
              '&:hover': {
                backgroundColor: theme.palette.action.hover,
              },
            }}
          >
            <DeleteIcon />
          </IconButton>
        </Tooltip>
      </ListItemSecondaryAction>
    </ListItem>
  );
}

export default function PhaseManager({ templateId, onPhasesChange }: PhaseManagerProps) {
  const theme = useTheme();
  const { showSuccess, showError } = useNotification();
  const supabase = createSupabaseClient();
  const [phases, setPhases] = useState<TemplatePhase[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingPhase, setEditingPhase] = useState<TemplatePhase | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ 
    phase: TemplatePhase | null; 
    open: boolean;
    hasFieldConfigs?: boolean;
  }>({
    phase: null,
    open: false,
    hasFieldConfigs: false,
  });
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newPhaseName, setNewPhaseName] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const loadPhases = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/templates/${templateId}/phases`);
      if (!response.ok) {
        throw new Error('Failed to load phases');
      }
      const data = await response.json();
      setPhases(data.phases || []);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to load phases');
    } finally {
      setLoading(false);
    }
  }, [templateId, showError]);

  useEffect(() => {
    loadPhases();
  }, [loadPhases]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const oldIndex = phases.findIndex((p) => p.id === active.id);
    const newIndex = phases.findIndex((p) => p.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reorderedPhases = arrayMove(phases, oldIndex, newIndex);

    // Update display_order for all affected phases
    const updatedPhases = reorderedPhases.map((phase, index) => ({
      ...phase,
      display_order: index + 1,
    }));

    setPhases(updatedPhases);

    // Save new order to database
    setSaving(true);
    try {
      for (const phase of updatedPhases) {
        const response = await fetch(`/api/templates/${templateId}/phases`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phase_id: phase.id,
            display_order: phase.display_order,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to update phase order');
        }
      }

      showSuccess('Phase order updated successfully');
      onPhasesChange?.();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to update phase order');
      // Revert on error
      loadPhases();
    } finally {
      setSaving(false);
    }
  };

  const handleEditStart = (phase: TemplatePhase) => {
    setEditingPhase(phase);
    setEditName(phase.phase_name);
  };

  const handleEditSave = async () => {
    if (!editingPhase || !editName.trim()) {
      showError('Phase name cannot be empty');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/templates/${templateId}/phases`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phase_id: editingPhase.id,
          phase_name: editName.trim(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update phase');
      }

      showSuccess('Phase updated successfully');
      setEditingPhase(null);
      setEditName('');
      loadPhases();
      onPhasesChange?.();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to update phase');
    } finally {
      setSaving(false);
    }
  };

  const handleEditCancel = () => {
    setEditingPhase(null);
    setEditName('');
  };

  const handleDeleteClick = async (phaseId: string) => {
    const phase = phases.find((p) => p.id === phaseId);
    if (!phase) return;

    // Check if phase has field configs
    try {
      const { data: fieldConfigs, error: configsError } = await supabase
        .from('template_field_configs')
        .select('id')
        .eq('template_id', templateId)
        .eq('phase_number', phase.phase_number)
        .limit(1);

      const hasFieldConfigs = !configsError && fieldConfigs && fieldConfigs.length > 0;

      setDeleteConfirm({ 
        phase, 
        open: true,
        hasFieldConfigs 
      });
    } catch (error) {
      // If check fails, still show dialog but warn
      setDeleteConfirm({ phase, open: true, hasFieldConfigs: false });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.phase) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/templates/${templateId}/phases?phase_id=${deleteConfirm.phase.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete phase');
      }

      showSuccess('Phase deleted successfully');
      setDeleteConfirm({ phase: null, open: false, hasFieldConfigs: false });
      loadPhases();
      onPhasesChange?.();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to delete phase');
    } finally {
      setSaving(false);
    }
  };

  const handleAddPhase = async () => {
    if (!newPhaseName.trim()) {
      showError('Phase name cannot be empty');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/templates/${templateId}/phases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phase_name: newPhaseName.trim(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create phase');
      }

      showSuccess('Phase created successfully');
      setAddDialogOpen(false);
      setNewPhaseName('');
      loadPhases();
      onPhasesChange?.();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to create phase');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress sx={{ color: theme.palette.text.primary }} />
      </Box>
    );
  }

  const activePhase = activeId ? phases.find((p) => p.id === activeId) : null;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
          Phase Management
        </Typography>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => setAddDialogOpen(true)}
          sx={{
            borderColor: theme.palette.text.primary,
            color: theme.palette.text.primary,
            '&:hover': {
              borderColor: theme.palette.text.primary,
              backgroundColor: theme.palette.action.hover,
            },
          }}
        >
          Add Phase
        </Button>
      </Box>

      <Alert 
        severity="info" 
        sx={{ 
          mb: 2,
          backgroundColor: theme.palette.action.hover,
          border: `1px solid ${theme.palette.divider}`,
          color: theme.palette.text.primary,
        }}
      >
        Drag phases to reorder them. The display order determines how phases appear in projects.
      </Alert>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={phases.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          <List>
            {phases.map((phase) => (
              <PhaseItem
                key={phase.id}
                phase={phase}
                onEdit={handleEditStart}
                onDelete={handleDeleteClick}
              />
            ))}
          </List>
        </SortableContext>
        <DragOverlay>
          {activePhase ? (
            <Paper
              sx={{
                p: 2,
                border: `1px solid ${theme.palette.divider}`,
                backgroundColor: theme.palette.action.hover,
                minWidth: 300,
              }}
            >
              <Typography variant="body1" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
                {activePhase.phase_name}
              </Typography>
            </Paper>
          ) : null}
        </DragOverlay>
      </DndContext>

      {phases.length === 0 && (
        <Alert 
          severity="warning" 
          sx={{ 
            mt: 2,
            backgroundColor: theme.palette.action.hover,
            border: `1px solid ${theme.palette.divider}`,
            color: theme.palette.text.primary,
          }}
        >
          No phases found. Add your first phase to get started.
        </Alert>
      )}

      {/* Edit Phase Dialog */}
      <Dialog 
        open={editingPhase !== null} 
        onClose={handleEditCancel} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
          },
        }}
      >
        <DialogTitle sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
          Edit Phase
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Phase Name"
            fullWidth
            variant="outlined"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions sx={{ borderTop: `1px solid ${theme.palette.divider}` }}>
          <Button 
            onClick={handleEditCancel} 
            disabled={saving}
            sx={{
              color: theme.palette.text.secondary,
              '&:hover': {
                backgroundColor: theme.palette.action.hover,
              },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleEditSave}
            variant="outlined"
            startIcon={<SaveIcon />}
            disabled={saving || !editName.trim()}
            sx={{
              borderColor: theme.palette.text.primary,
              color: theme.palette.text.primary,
              '&:hover': {
                borderColor: theme.palette.text.primary,
                backgroundColor: theme.palette.action.hover,
              },
              '&.Mui-disabled': {
                borderColor: theme.palette.divider,
                color: theme.palette.text.secondary,
              },
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Phase Dialog */}
      <Dialog 
        open={addDialogOpen} 
        onClose={() => setAddDialogOpen(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
          },
        }}
      >
        <DialogTitle sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
          Add New Phase
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Phase Name"
            fullWidth
            variant="outlined"
            value={newPhaseName}
            onChange={(e) => setNewPhaseName(e.target.value)}
            placeholder="e.g., Discovery, Planning, Launch"
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions sx={{ borderTop: `1px solid ${theme.palette.divider}` }}>
          <Button 
            onClick={() => setAddDialogOpen(false)} 
            disabled={saving}
            sx={{
              color: theme.palette.text.secondary,
              '&:hover': {
                backgroundColor: theme.palette.action.hover,
              },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAddPhase}
            variant="outlined"
            startIcon={<AddIcon />}
            disabled={saving || !newPhaseName.trim()}
            sx={{
              borderColor: theme.palette.text.primary,
              color: theme.palette.text.primary,
              '&:hover': {
                borderColor: theme.palette.text.primary,
                backgroundColor: theme.palette.action.hover,
              },
              '&.Mui-disabled': {
                borderColor: theme.palette.divider,
                color: theme.palette.text.secondary,
              },
            }}
          >
            Create Phase
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog 
        open={deleteConfirm.open} 
        onClose={() => setDeleteConfirm({ phase: null, open: false, hasFieldConfigs: false })}
        PaperProps={{
          sx: {
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
          },
        }}
      >
        <DialogTitle sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
          Delete Phase
        </DialogTitle>
        <DialogContent>
          <Alert 
            severity="warning" 
            sx={{ 
              mb: 2,
              backgroundColor: theme.palette.action.hover,
              border: `1px solid ${theme.palette.divider}`,
              color: theme.palette.text.primary,
            }}
          >
            Are you sure you want to delete &quot;{deleteConfirm.phase?.phase_name}&quot;?
          </Alert>
          {deleteConfirm.hasFieldConfigs && (
            <Alert 
              severity="error" 
              sx={{ 
                mb: 2,
                backgroundColor: theme.palette.action.hover,
                border: `1px solid ${theme.palette.divider}`,
                color: theme.palette.text.primary,
              }}
            >
              <strong>Warning:</strong> This phase has field configurations. Deleting it will hide the phase, but field configs will remain associated with this phase number.
              Consider removing field configs first in the Template Builder.
            </Alert>
          )}
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
            This will soft-delete the phase (set it to inactive). The phase will be hidden but not removed from the database.
            Projects using this template will retain their phase data.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ borderTop: `1px solid ${theme.palette.divider}` }}>
          <Button
            onClick={() => setDeleteConfirm({ phase: null, open: false, hasFieldConfigs: false })}
            disabled={saving}
            sx={{
              color: theme.palette.text.secondary,
              '&:hover': {
                backgroundColor: theme.palette.action.hover,
              },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            variant="outlined"
            disabled={saving}
            sx={{
              borderColor: theme.palette.text.primary,
              color: theme.palette.text.primary,
              '&:hover': {
                borderColor: theme.palette.text.primary,
                backgroundColor: theme.palette.action.hover,
              },
              '&.Mui-disabled': {
                borderColor: theme.palette.divider,
                color: theme.palette.text.secondary,
              },
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

