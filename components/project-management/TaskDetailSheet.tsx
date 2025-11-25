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
          backgroundColor: '#121633',
          borderLeft: '1px solid rgba(0, 229, 255, 0.2)',
        },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            p: 2,
            borderBottom: '1px solid rgba(0, 229, 255, 0.2)',
          }}
        >
          <Typography
            variant="h6"
            sx={{
              color: '#00E5FF',
              fontWeight: 600,
            }}
          >
            {isNewTask ? 'New Task' : 'Edit Task'}
          </Typography>
          <Box>
            {!isNewTask && onDelete && (
              <IconButton
                onClick={handleDelete}
                sx={{ color: '#FF6B6B', mr: 1 }}
                title="Delete task"
              >
                <DeleteIcon />
              </IconButton>
            )}
            <IconButton onClick={onClose} sx={{ color: '#00E5FF' }} title="Close">
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2, backgroundColor: 'rgba(244, 67, 54, 0.1)', color: '#FF6B6B' }}>
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
                value={formData.start_date ? new Date(formData.start_date).toISOString().slice(0, 16) : ''}
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
                  '& .MuiInputLabel-root': {
                    color: '#B0B0B0',
                  },
                  '& .MuiInputLabel-root.Mui-focused': {
                    color: '#00E5FF',
                  },
                }}
              />

              {/* Due Date */}
              <TextField
                label="Due Date"
                type="datetime-local"
                value={formData.due_date ? new Date(formData.due_date).toISOString().slice(0, 16) : ''}
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
                  '& .MuiInputLabel-root': {
                    color: '#B0B0B0',
                  },
                  '& .MuiInputLabel-root.Mui-focused': {
                    color: '#00E5FF',
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
                      '& .MuiInputLabel-root': {
                        color: '#B0B0B0',
                      },
                      '& .MuiInputLabel-root.Mui-focused': {
                        color: '#00E5FF',
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
                            backgroundColor: 'rgba(0, 229, 255, 0.15)',
                            color: '#00E5FF',
                            border: '1px solid rgba(0, 229, 255, 0.3)',
                            '& .MuiChip-deleteIcon': {
                              color: '#00E5FF',
                              '&:hover': {
                                color: '#00B2CC',
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
                            backgroundColor: 'rgba(0, 229, 255, 0.1)',
                            color: '#00E5FF',
                            border: '1px solid rgba(0, 229, 255, 0.2)',
                            cursor: 'default',
                            '&:hover': {
                              backgroundColor: 'rgba(0, 229, 255, 0.15)',
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
                        backgroundColor: isSelected ? 'rgba(0, 229, 255, 0.1)' : 'transparent',
                        fontWeight: isSelected ? 600 : 400,
                      }}
                    >
                      {option}
                      {isSelected && (
                        <span style={{ marginLeft: '8px', color: '#00E5FF' }}>✓</span>
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
                    color: '#00E5FF',
                  },
                  '& .MuiAutocomplete-clearIndicator': {
                    color: '#B0B0B0',
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
                '& .MuiInputLabel-root': {
                  color: '#B0B0B0',
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: '#00E5FF',
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
                '& .MuiInputLabel-root': {
                  color: '#B0B0B0',
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: '#00E5FF',
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
                backgroundColor: 'rgba(0, 229, 255, 0.03)',
                borderRadius: 2,
                border: '1px solid rgba(0, 229, 255, 0.1)',
              }}
            >
              <FormControl>
                <InputLabel sx={{ color: '#B0B0B0' }}>Status</InputLabel>
                <Select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as TaskStatus })}
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
                  <MenuItem value="todo">To Do</MenuItem>
                  <MenuItem value="in_progress">In Progress</MenuItem>
                  <MenuItem value="done">Done</MenuItem>
                  <MenuItem value="archived">Archived</MenuItem>
                </Select>
              </FormControl>

              <FormControl>
                <InputLabel sx={{ color: '#B0B0B0' }}>Priority</InputLabel>
                <Select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as TaskPriority })}
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
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="critical">Critical</MenuItem>
                </Select>
              </FormControl>

              <FormControl>
                <InputLabel sx={{ color: '#B0B0B0' }}>Phase</InputLabel>
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
                  <MenuItem value="">None</MenuItem>
                  {[1, 2, 3, 4, 5, 6].map((phase) => (
                    <MenuItem key={phase} value={phase}>
                      Phase {phase}: {getPhaseName(phase)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl>
                <InputLabel sx={{ color: '#B0B0B0' }}>Assignee</InputLabel>
                <Select
                  value={formData.assignee_id || ''}
                  onChange={(e) => setFormData({ ...formData, assignee_id: e.target.value || null })}
                  label="Assignee"
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
                      borderColor: '#00E5FF',
                      color: '#00E5FF',
                      '&:hover': {
                        borderColor: '#00E5FF',
                        backgroundColor: 'rgba(0, 229, 255, 0.1)',
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
                    '& .MuiInputLabel-root': {
                      color: '#B0B0B0',
                    },
                    '& .MuiInputLabel-root.Mui-focused': {
                      color: '#00E5FF',
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
                      backgroundColor: 'rgba(233, 30, 99, 0.15)',
                      color: '#E91E63',
                      border: '1px solid rgba(233, 30, 99, 0.3)',
                    }}
                  />
                ))
              }
            />

            <Divider sx={{ borderColor: 'rgba(0, 229, 255, 0.2)' }} />

            {/* Notes - Rich Text Editor */}
            <Box>
              <Typography
                variant="subtitle2"
                sx={{
                  color: '#00E5FF',
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

            <Divider sx={{ borderColor: 'rgba(0, 229, 255, 0.2)', my: 2 }} />

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
            borderTop: '1px solid rgba(0, 229, 255, 0.2)',
          }}
        >
          <Button onClick={onClose} sx={{ color: '#B0B0B0' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving || !formData.title?.trim()}
            sx={{
              backgroundColor: '#00E5FF',
              color: '#000',
              fontWeight: 600,
              '&:hover': {
                backgroundColor: '#00B2CC',
              },
              '&:disabled': {
                backgroundColor: 'rgba(0, 229, 255, 0.3)',
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

