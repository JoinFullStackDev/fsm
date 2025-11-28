'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Divider,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
  Alert,
  CircularProgress,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Merge as MergeIcon } from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import type { PreviewTask, TaskMerge } from '@/types/taskGenerator';
import type { ProjectTask } from '@/types/project';

interface TaskMergeDialogProps {
  open: boolean;
  onClose: () => void;
  previewTask: PreviewTask;
  existingTaskId: string;
  onDecision: (previewTaskId: string, action: 'merge' | 'keep-both' | 'discard', existingTaskId: string) => void;
}

export default function TaskMergeDialog({
  open,
  onClose,
  previewTask,
  existingTaskId,
  onDecision,
}: TaskMergeDialogProps) {
  const theme = useTheme();
  const [existingTask, setExistingTask] = useState<ProjectTask | null>(null);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<'merge' | 'keep-both' | 'discard'>('merge');
  const supabase = createSupabaseClient();

  useEffect(() => {
    if (open && existingTaskId) {
      const loadExistingTask = async () => {
        setLoading(true);
        try {
          const { data, error } = await supabase
            .from('project_tasks')
            .select('*')
            .eq('id', existingTaskId)
            .single();

          if (error) {
            console.error('[Task Merge Dialog] Error loading task:', error);
          } else {
            setExistingTask(data as ProjectTask);
          }
        } catch (error) {
          console.error('[Task Merge Dialog] Error:', error);
        } finally {
          setLoading(false);
        }
      };
      loadExistingTask();
    }
  }, [open, existingTaskId, supabase]);

  const handleConfirm = () => {
    if (previewTask.previewId) {
      onDecision(previewTask.previewId, action, existingTaskId);
    }
    onClose();
  };

  const getDifferences = () => {
    if (!existingTask) return [];

    const differences: string[] = [];

    if (previewTask.title !== existingTask.title) {
      differences.push('Title');
    }
    if (previewTask.description !== existingTask.description) {
      differences.push('Description');
    }
    if (previewTask.due_date !== existingTask.due_date) {
      differences.push('Due Date');
    }
    if (previewTask.phase_number !== existingTask.phase_number) {
      differences.push('Phase');
    }

    return differences;
  };

  const differences = getDifferences();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: 'background.paper',
          border: '2px solid',
          borderColor: 'primary.main',
          borderRadius: 3,
        },
      }}
    >
      <DialogTitle
        sx={{
          backgroundColor: 'rgba(0, 229, 255, 0.1)',
          borderBottom: '1px solid',
          borderColor: 'primary.main',
          color: 'primary.main',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <MergeIcon />
        Merge Duplicate Task
      </DialogTitle>

      <DialogContent sx={{ mt: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Alert severity="info" sx={{ mb: 2 }}>
              A similar task already exists. Choose how to handle this duplicate.
            </Alert>

            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                New Task (AI Generated)
              </Typography>
              <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                <Typography variant="body2" fontWeight={500}>
                  {previewTask.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {previewTask.description || 'No description'}
                </Typography>
                {previewTask.due_date && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Due: {new Date(previewTask.due_date).toLocaleDateString()}
                  </Typography>
                )}
              </Box>
            </Box>

            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Existing Task
              </Typography>
              <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                {existingTask ? (
                  <>
                    <Typography variant="body2" fontWeight={500}>
                      {existingTask.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {existingTask.description || 'No description'}
                    </Typography>
                    {existingTask.due_date && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Due: {new Date(existingTask.due_date).toLocaleDateString()}
                      </Typography>
                    )}
                  </>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Loading...
                  </Typography>
                )}
              </Box>
            </Box>

            {differences.length > 0 && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                Differences found: {differences.join(', ')}
              </Alert>
            )}

            <FormControl component="fieldset" fullWidth>
              <FormLabel component="legend">Choose Action</FormLabel>
              <RadioGroup
                value={action}
                onChange={(e) => setAction(e.target.value as 'merge' | 'keep-both' | 'discard')}
              >
                <FormControlLabel
                  value="merge"
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography variant="body2" fontWeight={500}>
                        Merge Tasks
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Combine AI content into existing task. Existing task remains, enriched with new information.
                      </Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  value="keep-both"
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography variant="body2" fontWeight={500}>
                        Keep Both Tasks
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Create new task alongside existing one. A duplicate warning will be added.
                      </Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  value="discard"
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography variant="body2" fontWeight={500}>
                        Discard AI Task
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Remove this AI-generated task. Existing task remains unchanged.
                      </Typography>
                    </Box>
                  }
                />
              </RadioGroup>
            </FormControl>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button onClick={onClose} sx={{ color: 'text.secondary' }}>
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={loading}
          sx={{
            backgroundColor: 'primary.main',
            color: '#000',
          }}
        >
          Confirm
        </Button>
      </DialogActions>
    </Dialog>
  );
}

