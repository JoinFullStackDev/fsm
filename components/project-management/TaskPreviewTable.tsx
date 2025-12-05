'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Checkbox,
  Chip,
  IconButton,
  Button,
  Typography,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Delete as DeleteIcon,
  Info as InfoIcon,
  Merge as MergeIcon,
  List as ListIcon,
  CalendarToday as CalendarIcon,
  Edit as EditIcon,
  Warning as WarningIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import type { PreviewTask, DuplicateStatus, TaskMerge } from '@/types/taskGenerator';
import RequirementsModal from './RequirementsModal';
import TaskMergeDialog from './TaskMergeDialog';
import { DEFAULT_PHASE_NAMES } from '@/lib/constants';

interface TaskPreviewTableProps {
  tasks: PreviewTask[];
  phaseNames?: Record<number, string>;
  onInject: (selectedTasks: PreviewTask[], merges: TaskMerge[]) => Promise<void>;
  onRegenerate: () => void;
  onBack: () => void;
  onTasksUpdate?: (updatedTasks: PreviewTask[]) => void;
  summary?: string;
  projectId?: string;
}

const DUPLICATE_STATUS_COLORS: Record<DuplicateStatus, string> = {
  'unique': '#4caf50',
  'possible-duplicate': '#ff9800',
  'exact-duplicate': '#f44336',
};

const DUPLICATE_STATUS_LABELS: Record<DuplicateStatus, string> = {
  'unique': 'Unique',
  'possible-duplicate': 'Possible Duplicate',
  'exact-duplicate': 'Exact Duplicate',
};

export default function TaskPreviewTable({
  tasks,
  phaseNames = {},
  onInject,
  onRegenerate,
  onBack,
  onTasksUpdate,
  summary,
  projectId: propProjectId,
}: TaskPreviewTableProps) {
  const theme = useTheme();
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [taskToMerge, setTaskToMerge] = useState<PreviewTask | null>(null);
  const [requirementsModalOpen, setRequirementsModalOpen] = useState(false);
  const [taskForRequirements, setTaskForRequirements] = useState<PreviewTask | null>(null);
  const [dateEditDialogOpen, setDateEditDialogOpen] = useState(false);
  const [taskForDateEdit, setTaskForDateEdit] = useState<PreviewTask | null>(null);
  const [editingStartDate, setEditingStartDate] = useState('');
  const [editingDueDate, setEditingDueDate] = useState('');
  const [merges, setMerges] = useState<Map<string, TaskMerge>>(new Map());
  const [injecting, setInjecting] = useState(false);
  const [localTasks, setLocalTasks] = useState<PreviewTask[]>(tasks);
  const [assigneeEditDialogOpen, setAssigneeEditDialogOpen] = useState(false);
  const [taskForAssigneeEdit, setTaskForAssigneeEdit] = useState<PreviewTask | null>(null);
  const [editingAssigneeId, setEditingAssigneeId] = useState('');
  const [projectMembers, setProjectMembers] = useState<Array<{ user_id: string; user: { name: string | null; email: string } }>>([]);
  const [assigneeTaskCounts, setAssigneeTaskCounts] = useState<Map<string, number>>(new Map());
  const [projectId, setProjectId] = useState<string>('');

  // Use projectId from props or extract from URL
  useEffect(() => {
    if (propProjectId) {
      setProjectId(propProjectId);
    } else if (typeof window !== 'undefined') {
      const pathParts = window.location.pathname.split('/');
      const projectIndex = pathParts.indexOf('project-management');
      if (projectIndex !== -1 && pathParts[projectIndex + 1]) {
        setProjectId(pathParts[projectIndex + 1]);
      }
    }
  }, [propProjectId]);

  // Load project members when projectId is available
  useEffect(() => {
    if (projectId) {
      loadProjectMembers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const loadProjectMembers = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/members`);
      if (response.ok) {
        const data = await response.json();
        setProjectMembers(data.members || []);
        
        // Load task counts for assignees
        const tasksResponse = await fetch(`/api/projects/${projectId}/tasks`);
        if (tasksResponse.ok) {
          const tasksData = await tasksResponse.json();
          const tasks = tasksData.tasks || [];
          const counts = new Map<string, number>();
          (data.members || []).forEach((m: any) => {
            const count = tasks.filter((t: any) => t.assignee_id === m.user_id && t.status !== 'archived').length;
            counts.set(m.user_id, count);
          });
          setAssigneeTaskCounts(counts);
        }
      }
    } catch (error) {
      console.error('[TaskPreviewTable] Error loading project members:', error);
    }
  };

  const getPhaseName = (phaseNumber: number | null): string => {
    if (!phaseNumber) return 'Unassigned';
    return phaseNames[phaseNumber] || DEFAULT_PHASE_NAMES[phaseNumber] || `Phase ${phaseNumber}`;
  };

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedTasks(new Set(tasks.map((t) => t.previewId || '')));
    } else {
      setSelectedTasks(new Set());
    }
  };

  const handleSelectTask = (previewId: string) => {
    const newSelected = new Set(selectedTasks);
    if (newSelected.has(previewId)) {
      newSelected.delete(previewId);
    } else {
      newSelected.add(previewId);
    }
    setSelectedTasks(newSelected);
  };

  const handleRemoveSelected = () => {
    const remaining = localTasks.filter((t) => !selectedTasks.has(t.previewId || ''));
    setLocalTasks(remaining);
    if (onTasksUpdate) {
      onTasksUpdate(remaining);
    }
    // Reset selection
    setSelectedTasks(new Set());
  };

  const handleOpenMergeDialog = (task: PreviewTask) => {
    if (task.duplicateStatus !== 'unique' && task.existingTaskId) {
      setTaskToMerge(task);
      setMergeDialogOpen(true);
    }
  };

  const handleMergeDecision = (previewTaskId: string, action: 'merge' | 'keep-both' | 'discard', existingTaskId: string) => {
    const newMerges = new Map(merges);
    newMerges.set(previewTaskId, {
      previewTaskId,
      existingTaskId,
      action,
    });
    setMerges(newMerges);
    setMergeDialogOpen(false);
    setTaskToMerge(null);
  };

  // Get all duplicate tasks
  const duplicateTasks = localTasks.filter(
    (t) => t.duplicateStatus !== 'unique' && t.existingTaskId
  );

  // Apply bulk merge action to all duplicates
  const handleBulkMergeAction = (action: 'merge' | 'keep-both' | 'discard') => {
    const newMerges = new Map(merges);
    for (const task of duplicateTasks) {
      if (task.previewId && task.existingTaskId) {
        newMerges.set(task.previewId, {
          previewTaskId: task.previewId,
          existingTaskId: task.existingTaskId,
          action,
        });
      }
    }
    setMerges(newMerges);
  };

  // Clear all merge decisions
  const handleClearMergeDecisions = () => {
    setMerges(new Map());
  };

  const handleOpenRequirements = (task: PreviewTask) => {
    setTaskForRequirements(task);
    setRequirementsModalOpen(true);
  };

  const handleOpenDateEdit = (task: PreviewTask) => {
    setTaskForDateEdit(task);
    setEditingStartDate(task.start_date || '');
    setEditingDueDate(task.due_date || '');
    setDateEditDialogOpen(true);
  };

  const handleSaveDateEdit = () => {
    if (taskForDateEdit) {
      // Update the task in the local state
      const updatedTasks = localTasks.map((t) =>
        t.previewId === taskForDateEdit.previewId
          ? {
              ...t,
              start_date: editingStartDate || null,
              due_date: editingDueDate || null,
            }
          : t
      );
      setLocalTasks(updatedTasks);
      if (onTasksUpdate) {
        onTasksUpdate(updatedTasks);
      }
    }
    setDateEditDialogOpen(false);
    setTaskForDateEdit(null);
  };

  // Update local tasks when props change
  useEffect(() => {
    setLocalTasks(tasks);
  }, [tasks]);

  const handleInject = async () => {
    const tasksToInject = localTasks.filter((t) => {
      const previewId = t.previewId || '';
      const isSelected = selectedTasks.has(previewId);
      const mergeInfo = merges.get(previewId);
      
      // Don't inject if task is discarded
      if (mergeInfo?.action === 'discard') {
        return false;
      }
      
      return isSelected;
    });

    if (tasksToInject.length === 0) {
      return;
    }

    setInjecting(true);
    try {
      const mergeArray = Array.from(merges.values());
      await onInject(tasksToInject, mergeArray);
    } catch (error) {
      console.error('[Task Preview] Injection error:', error);
    } finally {
      setInjecting(false);
    }
  };

  const allSelected = localTasks.length > 0 && localTasks.every((t) => selectedTasks.has(t.previewId || ''));
  const someSelected = localTasks.some((t) => selectedTasks.has(t.previewId || ''));

  return (
    <Box>
      {summary && (
        <Box sx={{ mb: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {summary}
          </Typography>
        </Box>
      )}

      {/* Bulk Merge Actions */}
      {duplicateTasks.length > 0 && (
        <Alert 
          severity="warning" 
          sx={{ mb: 2 }}
          action={
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => handleBulkMergeAction('merge')}
                sx={{ fontSize: '0.75rem' }}
              >
                Merge All
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={() => handleBulkMergeAction('keep-both')}
                sx={{ fontSize: '0.75rem' }}
              >
                Keep All
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="error"
                onClick={() => handleBulkMergeAction('discard')}
                sx={{ fontSize: '0.75rem' }}
              >
                Discard All
              </Button>
              {merges.size > 0 && (
                <Button
                  size="small"
                  variant="text"
                  onClick={handleClearMergeDecisions}
                  sx={{ fontSize: '0.75rem' }}
                >
                  Clear
                </Button>
              )}
            </Box>
          }
        >
          <Typography variant="body2">
            <strong>{duplicateTasks.length} duplicate{duplicateTasks.length > 1 ? 's' : ''}</strong> detected 
            {merges.size > 0 && ` (${merges.size} decision${merges.size > 1 ? 's' : ''} made)`}
          </Typography>
        </Alert>
      )}

      <Box sx={{ mb: 2, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 1.5, sm: 1 }, alignItems: { xs: 'stretch', sm: 'center' }, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', gap: 1, flex: { xs: '1 1 100%', sm: '0 0 auto' } }}>
          <Button
            variant="outlined"
            onClick={onBack}
            size="small"
            fullWidth={false}
            sx={{ flex: { xs: 1, sm: '0 0 auto' } }}
          >
            Back
          </Button>
          <Button
            variant="outlined"
            onClick={onRegenerate}
            size="small"
            fullWidth={false}
            sx={{ flex: { xs: 1, sm: '0 0 auto' } }}
          >
            Regenerate
          </Button>
        </Box>
        <Box sx={{ flexGrow: { xs: 0, sm: 1 }, width: { xs: '100%', sm: 'auto' } }} />
        <Box sx={{ display: 'flex', gap: 1, flex: { xs: '1 1 100%', sm: '0 0 auto' }, width: { xs: '100%', sm: 'auto' } }}>
          {someSelected && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={handleRemoveSelected}
              size="small"
              fullWidth={false}
              sx={{ flex: { xs: 1, sm: '0 0 auto' } }}
            >
              Remove Selected ({selectedTasks.size})
            </Button>
          )}
          <Button
            variant="contained"
            onClick={handleInject}
            disabled={selectedTasks.size === 0 || injecting}
            fullWidth={false}
            sx={{
              backgroundColor: 'primary.main',
              color: '#000',
              flex: { xs: 1, sm: '0 0 auto' },
            }}
          >
            {injecting ? 'Injecting...' : `Inject Tasks (${selectedTasks.size})`}
          </Button>
        </Box>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  indeterminate={someSelected && !allSelected}
                  checked={allSelected}
                  onChange={handleSelectAll}
                />
              </TableCell>
              <TableCell>Title</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Requirements</TableCell>
              <TableCell>Phase</TableCell>
              <TableCell>Estimated Hours</TableCell>
              <TableCell>Assignee</TableCell>
              <TableCell>Due Date</TableCell>
              <TableCell>Duplicate Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {localTasks.map((task) => {
              const previewId = task.previewId || '';
              const isSelected = selectedTasks.has(previewId);
              const mergeInfo = merges.get(previewId);
              const isDiscarded = mergeInfo?.action === 'discard';

              return (
                <TableRow
                  key={previewId}
                  sx={{
                    bgcolor: isDiscarded
                      ? 'action.disabledBackground'
                      : task.duplicateStatus === 'exact-duplicate'
                      ? 'rgba(244, 67, 54, 0.1)'
                      : task.duplicateStatus === 'possible-duplicate'
                      ? 'rgba(255, 152, 0, 0.1)'
                      : 'transparent',
                    opacity: isDiscarded ? 0.5 : 1,
                  }}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={isSelected && !isDiscarded}
                      onChange={() => handleSelectTask(previewId)}
                      disabled={isDiscarded}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>
                      {task.title}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Tooltip title={task.description || ''}>
                      <Typography
                        variant="body2"
                        sx={{
                          maxWidth: 200,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {task.description || 'No description'}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    {task.requirements && task.requirements.length > 0 ? (
                      <Tooltip title="View requirements">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenRequirements(task)}
                        >
                          <ListIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        -
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getPhaseName(task.phase_number)}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    {task.estimated_hours ? (
                      <Typography variant="body2">
                        {task.estimated_hours}h
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Not set
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {task.assignee_id ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <PersonIcon fontSize="small" color="action" />
                        <Typography variant="body2">
                          {(() => {
                            const member = projectMembers.find(m => m.user_id === task.assignee_id);
                            return member?.user?.name || member?.user?.email || 'Unknown';
                          })()}
                        </Typography>
                        {(() => {
                          const taskCount = assigneeTaskCounts.get(task.assignee_id || '') || 0;
                          return taskCount > 10 ? (
                            <Tooltip title="This assignee has many tasks">
                              <WarningIcon fontSize="small" color="warning" />
                            </Tooltip>
                          ) : null;
                        })()}
                        <IconButton
                          size="small"
                          onClick={() => {
                            setTaskForAssigneeEdit(task);
                            setEditingAssigneeId(task.assignee_id || '');
                            setAssigneeEditDialogOpen(true);
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    ) : (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="body2" color="text.secondary">
                          Unassigned
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setTaskForAssigneeEdit(task);
                            setEditingAssigneeId('');
                            setAssigneeEditDialogOpen(true);
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    )}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {task.due_date ? (
                        <>
                          <Typography variant="body2">
                            {format(parseISO(task.due_date), 'MMM d, yyyy')}
                          </Typography>
                          <IconButton
                            size="small"
                            onClick={() => handleOpenDateEdit(task)}
                          >
                            <CalendarIcon fontSize="small" />
                          </IconButton>
                        </>
                      ) : (
                        <>
                          <Typography variant="body2" color="text.secondary">
                            Not set
                          </Typography>
                          <IconButton
                            size="small"
                            onClick={() => handleOpenDateEdit(task)}
                          >
                            <CalendarIcon fontSize="small" />
                          </IconButton>
                        </>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={DUPLICATE_STATUS_LABELS[task.duplicateStatus]}
                      size="small"
                      sx={{
                        bgcolor: DUPLICATE_STATUS_COLORS[task.duplicateStatus],
                        color: '#fff',
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    {task.duplicateStatus !== 'unique' && task.existingTaskId && (
                      <Tooltip title="Merge or manage duplicate">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenMergeDialog(task)}
                        >
                          <MergeIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {mergeInfo && (
                      <Chip
                        label={
                          mergeInfo.action === 'merge'
                            ? 'Will Merge'
                            : mergeInfo.action === 'keep-both'
                            ? 'Keep Both'
                            : 'Discarded'
                        }
                        size="small"
                        color={mergeInfo.action === 'discard' ? 'error' : 'default'}
                      />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Requirements Modal */}
      <RequirementsModal
        open={requirementsModalOpen}
        onClose={() => setRequirementsModalOpen(false)}
        task={taskForRequirements}
      />

      {/* Merge Dialog */}
      {taskToMerge && (
        <TaskMergeDialog
          open={mergeDialogOpen}
          onClose={() => {
            setMergeDialogOpen(false);
            setTaskToMerge(null);
          }}
          previewTask={taskToMerge}
          existingTaskId={taskToMerge.existingTaskId || ''}
          projectId={projectId}
          onDecision={handleMergeDecision}
        />
      )}

      {/* Date Edit Dialog */}
      <Dialog
        open={dateEditDialogOpen}
        onClose={() => setDateEditDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Dates</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Start Date"
            type="date"
            value={editingStartDate}
            onChange={(e) => setEditingStartDate(e.target.value)}
            sx={{ mt: 2 }}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            fullWidth
            label="Due Date"
            type="date"
            value={editingDueDate}
            onChange={(e) => setEditingDueDate(e.target.value)}
            sx={{ mt: 2 }}
            InputLabelProps={{ shrink: true }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDateEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveDateEdit} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

