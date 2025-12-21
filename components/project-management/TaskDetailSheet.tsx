'use client';

import { useState, useEffect } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Chip,
  Autocomplete,
  Divider,
  Alert,
  CircularProgress,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Close as CloseIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Link as LinkIcon,
} from '@mui/icons-material';
import RichTextEditor from './RichTextEditor';
import TaskComments from './TaskComments';
import type { ProjectTask, ProjectTaskExtended, TaskStatus, TaskPriority } from '@/types/project';
import type { User } from '@/types/project';

interface TaskDetailSheetProps {
  open: boolean;
  task: ProjectTask | ProjectTaskExtended | null;
  projectId: string;
  projectMembers: User[];
  allTasks: (ProjectTask | ProjectTaskExtended)[];
  phaseNames?: Record<number, string>;
  currentUserId: string;
  onClose: () => void;
  onSave: (task: Partial<ProjectTask>) => Promise<void>;
  onDelete?: (taskId: string) => Promise<void>;
}

// Fallback phase names for backward compatibility
const DEFAULT_PHASE_NAMES: Record<number, string> = {
  1: 'Concept Framing',
  2: 'Product Strategy',
  3: 'Rapid Prototype Definition',
  4: 'Analysis & User Stories',
  5: 'Build Accelerator',
  6: 'QA & Hardening',
};

// Helper function to format date for datetime-local input (uses local timezone)
const formatDateForInput = (isoString: string | null): string => {
  if (!isoString) return '';
  try {
    // Handle date-only strings (YYYY-MM-DD) by treating them as local dates
    // JavaScript's Date parses "YYYY-MM-DD" as UTC, causing timezone shift issues
    let date: Date;
    if (isoString.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(isoString)) {
      // Date-only string: parse as local date by adding time component
      const [year, month, day] = isoString.split('-').map(Number);
      date = new Date(year, month - 1, day, 12, 0, 0); // Use noon to avoid edge cases
    } else {
      date = new Date(isoString);
    }
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    return '';
  }
};

// Helper function to parse datetime-local input value and convert to ISO string
const parseDateFromInput = (localDateTimeString: string): string | null => {
  if (!localDateTimeString) return null;
  try {
    // datetime-local gives us "YYYY-MM-DDTHH:mm" in local time
    // We need to convert this to an ISO string (UTC)
    const date = new Date(localDateTimeString);
    return date.toISOString();
  } catch {
    return null;
  }
};

export default function TaskDetailSheet({
  open,
  task,
  projectId,
  projectMembers,
  allTasks,
  phaseNames = {},
  currentUserId,
  onClose,
  onSave,
  onDelete,
}: TaskDetailSheetProps) {
  const theme = useTheme();
  // Merge provided phase names with defaults
  const getPhaseName = (phaseNumber: number | null): string => {
    if (!phaseNumber) return 'Unassigned';
    return phaseNames[phaseNumber] || DEFAULT_PHASE_NAMES[phaseNumber] || `Phase ${phaseNumber}`;
  };
  const [formData, setFormData] = useState<Partial<ProjectTask>>({
    title: '',
    description: '',
    status: 'todo',
    priority: 'medium',
    phase_number: null,
    assignee_id: null,
    start_date: null,
    due_date: null,
    tags: [],
    notes: '',
    dependencies: [],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const isNewTask = !task?.id;

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title || '',
        description: task.description || '',
        status: task.status || 'todo',
        priority: task.priority || 'medium',
        phase_number: task.phase_number || null,
        assignee_id: task.assignee_id || null,
        start_date: task.start_date || null,
        due_date: task.due_date || null,
        tags: task.tags || [],
        notes: task.notes || '',
        dependencies: task.dependencies || [],
      });
    } else {
      setFormData({
        title: '',
        description: '',
        status: 'todo',
        priority: 'medium',
        phase_number: null,
        assignee_id: null,
        start_date: null,
        due_date: null,
        tags: [],
        notes: '',
        dependencies: [],
      });
    }
    setError(null);
  }, [task, open]);

  // Load available tags from all tasks in the project
  useEffect(() => {
    const loadAvailableTags = () => {
      const allTags = new Set<string>();
      allTasks.forEach((t) => {
        if (t.tags && Array.isArray(t.tags)) {
          t.tags.forEach((tag) => {
            if (tag && typeof tag === 'string') {
              allTags.add(tag.trim());
            }
          });
        }
      });
      setAvailableTags(Array.from(allTags).sort());
    };

    if (open && allTasks.length > 0) {
      loadAvailableTags();
    }
  }, [open, allTasks]);

  const handleSave = async () => {
    if (!formData.title?.trim()) {
      setError('Title is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSave({
        ...formData,
        project_id: projectId,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save task');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!task?.id || !onDelete) return;

    if (window.confirm('Are you sure you want to delete this task?')) {
      try {
        await onDelete(task.id);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete task');
      }
    }
  };

  const handleNavigateToPhase = (phaseNumber: number) => {
    window.open(`/project/${projectId}/phase/${phaseNumber}`, '_blank');
  };

  const availableDependencies = allTasks.filter((t) => t.id !== task?.id);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: '75%', md: '60%' },
          backgroundColor: theme.palette.background.paper,
          borderLeft: `1px solid ${theme.palette.divider}`,
          transform: 'translateY(60px) !important',
        },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', maxHeight: 'calc(100vh - 60px)' }}>
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            p: 3,
            px: 4,
            borderBottom: `1px solid ${theme.palette.divider}`,
            backgroundColor: theme.palette.background.paper,
            minHeight: '64px',
          }}
        >
          <Typography
            variant="h6"
            sx={{
              color: theme.palette.text.primary,
              fontWeight: 600,
              marginBottom: 0,
              lineHeight: 1.2,
            }}
          >
            {isNewTask ? 'New Task' : 'Edit Task'}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {!isNewTask && onDelete && (
              <IconButton
                onClick={handleDelete}
                sx={{ color: theme.palette.text.primary, padding: '8px' }}
                title="Delete task"
              >
                <DeleteIcon />
              </IconButton>
            )}
            <IconButton onClick={onClose} sx={{ color: theme.palette.text.primary, padding: '8px' }} title="Close">
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2, backgroundColor: theme.palette.action.hover, color: theme.palette.text.primary, border: `1px solid ${theme.palette.divider}` }}>
              {error}
            </Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 800, mx: 'auto' }}>
            {/* Start Date, Due Date and Tags - Top Row */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              {/* Start Date */}
              <TextField
                label="Start Date"
                type="datetime-local"
                value={formatDateForInput(formData.start_date ?? null)}
                onChange={(e) => {
                  const newStartDate = e.target.value ? new Date(e.target.value).toISOString() : null;
                  // Ensure start_date is not after due_date
                  if (newStartDate && formData.due_date && new Date(newStartDate) > new Date(formData.due_date)) {
                    // Auto-adjust due_date to be at least 1 day after start_date
                    const adjustedDueDate = new Date(newStartDate);
                    adjustedDueDate.setDate(adjustedDueDate.getDate() + 1);
                    setFormData({
                      ...formData,
                      start_date: newStartDate,
                      due_date: adjustedDueDate.toISOString(),
                    });
                  } else {
                    setFormData({
                      ...formData,
                      start_date: newStartDate,
                    });
                  }
                }}
                InputLabelProps={{
                  shrink: true,
                }}
                sx={{
                  flex: 1,
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
                  '& .MuiInputLabel-root': {
                    color: theme.palette.text.secondary,
                  },
                  '& .MuiInputLabel-root.Mui-focused': {
                    color: theme.palette.text.primary,
                  },
                }}
              />

              {/* Due Date */}
              <TextField
                label="Due Date"
                type="datetime-local"
                value={formatDateForInput(formData.due_date ?? null)}
                onChange={(e) => {
                  const newDueDate = e.target.value ? new Date(e.target.value).toISOString() : null;
                  // Ensure due_date is not before start_date
                  if (newDueDate && formData.start_date && new Date(newDueDate) < new Date(formData.start_date)) {
                    // Auto-adjust start_date to be at least 1 day before due_date
                    const adjustedStartDate = new Date(newDueDate);
                    adjustedStartDate.setDate(adjustedStartDate.getDate() - 1);
                    setFormData({
                      ...formData,
                      start_date: adjustedStartDate.toISOString(),
                      due_date: newDueDate,
                    });
                  } else {
                    setFormData({
                      ...formData,
                      due_date: newDueDate,
                    });
                  }
                }}
                InputLabelProps={{
                  shrink: true,
                }}
                sx={{
                  flex: 1,
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
                  '& .MuiInputLabel-root': {
                    color: theme.palette.text.secondary,
                  },
                  '& .MuiInputLabel-root.Mui-focused': {
                    color: theme.palette.text.primary,
                  },
                }}
              />

            </Box>

            {/* Tags - Full Width */}
            <Box>
              <Autocomplete
                multiple
                freeSolo
                options={availableTags}
                value={formData.tags || []}
                onChange={(_, newValue) => {
                  // Ensure all values are strings and trim them
                  const cleanedValue = newValue.map((v) => (typeof v === 'string' ? v.trim() : String(v).trim())).filter(Boolean);
                  setFormData({ ...formData, tags: cleanedValue });
                }}
                onInputChange={(_, newInputValue) => {
                  // This allows creating new tags by typing
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Tags"
                    placeholder="Select or create tags..."
                    sx={{
                      flex: 1,
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
                      '& .MuiInputLabel-root': {
                        color: theme.palette.text.secondary,
                      },
                      '& .MuiInputLabel-root.Mui-focused': {
                        color: theme.palette.text.primary,
                      },
                    }}
                  />
                )}
                renderTags={(value, getTagProps) => {
                  // Only show first 2 tags, then show count
                  const visibleTags = value.slice(0, 2);
                  const remainingCount = value.length - 2;
                  
                  return (
                    <>
                      {visibleTags.map((option, index) => (
                        <Chip
                          {...getTagProps({ index })}
                          key={index}
                          label={option}
                          size="small"
                          sx={{
                            backgroundColor: theme.palette.action.hover,
                            color: theme.palette.text.primary,
                            border: `1px solid ${theme.palette.divider}`,
                            '& .MuiChip-deleteIcon': {
                              color: theme.palette.text.primary,
                              '&:hover': {
                                color: theme.palette.text.secondary,
                              },
                            },
                          }}
                        />
                      ))}
                      {remainingCount > 0 && (
                        <Chip
                          label={`+${remainingCount}`}
                          size="small"
                          sx={{
                            backgroundColor: theme.palette.action.hover,
                            color: theme.palette.text.primary,
                            border: `1px solid ${theme.palette.divider}`,
                            cursor: 'default',
                            '&:hover': {
                              backgroundColor: theme.palette.action.hover,
                            },
                          }}
                        />
                      )}
                    </>
                  );
                }}
                renderOption={(props, option) => {
                  const isSelected = (formData.tags || []).includes(option);
                  return (
                    <li
                      {...props}
                      key={option}
                      style={{
                        ...props.style,
                        backgroundColor: isSelected ? theme.palette.action.hover : 'transparent',
                        fontWeight: isSelected ? 600 : 400,
                        color: theme.palette.text.primary,
                      }}
                    >
                      {option}
                      {isSelected && (
                        <span style={{ marginLeft: '8px', color: theme.palette.text.primary }}>✓</span>
                      )}
                    </li>
                  );
                }}
                getOptionLabel={(option) => (typeof option === 'string' ? option : String(option))}
                filterOptions={(options, params) => {
                  const { inputValue } = params;
                  const selectedTags = formData.tags || [];
                  
                  // Filter options
                  const filtered = options.filter((option) =>
                    option.toLowerCase().includes(inputValue.toLowerCase())
                  );
                  
                  // Sort: selected tags first, then others
                  const sorted = [
                    ...filtered.filter((opt) => selectedTags.includes(opt)),
                    ...filtered.filter((opt) => !selectedTags.includes(opt)),
                  ];
                  
                  // If input doesn't match any option and freeSolo is enabled, allow creating new tag
                  if (inputValue && !options.some((opt) => opt.toLowerCase() === inputValue.toLowerCase())) {
                    return sorted;
                  }
                  
                  return sorted;
                }}
                sx={{
                  width: '100%',
                  '& .MuiAutocomplete-popupIndicator': {
                    color: theme.palette.text.primary,
                  },
                  '& .MuiAutocomplete-clearIndicator': {
                    color: theme.palette.text.secondary,
                  },
                }}
              />
            </Box>

            {/* Title */}
            <TextField
              label="Title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              fullWidth
              sx={{
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
                '& .MuiInputLabel-root': {
                  color: theme.palette.text.secondary,
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: theme.palette.text.primary,
                },
              }}
            />

            {/* Description */}
            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              multiline
              rows={4}
              fullWidth
              sx={{
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
                '& .MuiInputLabel-root': {
                  color: theme.palette.text.secondary,
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: theme.palette.text.primary,
                },
              }}
            />

            {/* Metadata Grid - More Professional Layout */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 2,
                p: 2,
                backgroundColor: theme.palette.action.hover,
                borderRadius: 2,
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              <FormControl>
                <InputLabel sx={{ color: theme.palette.text.secondary }}>Status</InputLabel>
                <Select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as TaskStatus })}
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
                  <MenuItem value="todo">To Do</MenuItem>
                  <MenuItem value="in_progress">In Progress</MenuItem>
                  <MenuItem value="done">Done</MenuItem>
                  <MenuItem value="archived">Archived</MenuItem>
                </Select>
              </FormControl>

              <FormControl>
                <InputLabel sx={{ color: theme.palette.text.secondary }}>Priority</InputLabel>
                <Select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as TaskPriority })}
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
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="critical">Critical</MenuItem>
                </Select>
              </FormControl>

              <FormControl>
                <InputLabel sx={{ color: theme.palette.text.secondary }}>Phase</InputLabel>
                <Select
                  value={formData.phase_number || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      phase_number: e.target.value ? Number(e.target.value) : null,
                    })
                  }
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
                  <MenuItem value="">None</MenuItem>
                  {[1, 2, 3, 4, 5, 6].map((phase) => (
                    <MenuItem key={phase} value={phase}>
                      Phase {phase}: {getPhaseName(phase)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl>
                <InputLabel sx={{ color: theme.palette.text.secondary }}>Assignee</InputLabel>
                <Select
                  value={formData.assignee_id || ''}
                  onChange={(e) => setFormData({ ...formData, assignee_id: e.target.value || null })}
                  label="Assignee"
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
                  <MenuItem value="">Unassigned</MenuItem>
                  {projectMembers.map((member) => (
                    <MenuItem key={member.id} value={member.id}>
                      {member.name || member.email}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {formData.phase_number && (
                <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                  <Button
                    variant="outlined"
                    startIcon={<LinkIcon />}
                    onClick={() => handleNavigateToPhase(formData.phase_number!)}
                    fullWidth
                    sx={{
                      borderColor: theme.palette.text.primary,
                      color: theme.palette.text.primary,
                      '&:hover': {
                        borderColor: theme.palette.text.primary,
                        backgroundColor: theme.palette.action.hover,
                      },
                    }}
                  >
                    View Phase {formData.phase_number}
                  </Button>
                </Box>
              )}
            </Box>


            {/* Dependencies */}
            <Autocomplete
              multiple
              options={availableDependencies}
              getOptionLabel={(option) => option.title}
              value={availableDependencies.filter((t) => formData.dependencies?.includes(t.id))}
              onChange={(_, newValue) =>
                setFormData({
                  ...formData,
                  dependencies: newValue.map((t) => t.id),
                })
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Dependencies"
                  placeholder="Select dependent tasks..."
                  sx={{
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
                    '& .MuiInputLabel-root': {
                      color: theme.palette.text.secondary,
                    },
                    '& .MuiInputLabel-root.Mui-focused': {
                      color: theme.palette.text.primary,
                    },
                  }}
                />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    {...getTagProps({ index })}
                    key={option.id}
                    label={option.title}
                    size="small"
                    sx={{
                      backgroundColor: theme.palette.action.hover,
                      color: theme.palette.text.primary,
                      border: `1px solid ${theme.palette.divider}`,
                    }}
                  />
                ))
              }
            />

            <Divider sx={{ borderColor: theme.palette.divider }} />

            {/* Notes - Rich Text Editor */}
            <Box>
              <Typography
                variant="subtitle2"
                sx={{
                  color: theme.palette.text.primary,
                  fontWeight: 600,
                  mb: 1.5,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  fontSize: '0.75rem',
                }}
              >
                Notes
              </Typography>
              <RichTextEditor
                value={formData.notes || ''}
                onChange={(value) => setFormData({ ...formData, notes: value })}
                placeholder="Add any additional notes or context..."
              />
            </Box>

            <Divider sx={{ borderColor: theme.palette.divider, my: 2 }} />

            {/* Comments */}
            {task?.id && (
              <TaskComments
                taskId={task.id}
                projectMembers={projectMembers}
                allTasks={allTasks}
                currentUserId={currentUserId}
              />
            )}
          </Box>
        </Box>

        {/* Footer */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 2,
            p: 2,
            borderTop: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Button 
            onClick={onClose} 
            variant="outlined"
            sx={{ 
              borderColor: theme.palette.text.primary,
              color: theme.palette.text.primary,
              flex: 1,
              '&:hover': {
                borderColor: theme.palette.text.primary,
                backgroundColor: theme.palette.action.hover,
              },
            }}
          >
            Cancel
          </Button>
          <Button
            variant="outlined"
            startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving || !formData.title?.trim()}
            sx={{
              borderColor: theme.palette.text.primary,
              color: theme.palette.text.primary,
              fontWeight: 600,
              flex: 1,
              '&:hover': {
                borderColor: theme.palette.text.primary,
                backgroundColor: theme.palette.action.hover,
              },
              '&:disabled': {
                borderColor: theme.palette.divider,
                color: theme.palette.text.secondary,
              },
            }}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </Box>
      </Box>
    </Drawer>
  );
}

