'use client';

import { useState, useCallback } from 'react';
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Paper,
  Typography,
  Alert,
  Divider,
  FormHelperText,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Add as AddIcon, Save as SaveIcon } from '@mui/icons-material';
import StepEditor from './StepEditor';
import type {
  TriggerType,
  WorkflowStepInput,
  EventTriggerConfig,
  ScheduleTriggerConfig,
} from '@/types/workflows';

interface WorkflowFormProps {
  mode: 'create' | 'edit';
  initialData?: {
    name: string;
    description: string | null;
    trigger_type: TriggerType;
    trigger_config: Record<string, unknown>;
    steps: WorkflowStepInput[];
  };
  onSubmit: (data: {
    name?: string;
    description?: string;
    trigger_type?: TriggerType;
    trigger_config?: Record<string, unknown>;
    steps?: WorkflowStepInput[];
    is_active?: boolean;
  }) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  error?: string | null;
}

const triggerTypeOptions: { value: TriggerType; label: string; description: string }[] = [
  {
    value: 'event',
    label: 'Event Trigger',
    description: 'Run when specific events occur (task created, contact updated, etc.)',
  },
  {
    value: 'schedule',
    label: 'Scheduled',
    description: 'Run on a schedule (daily, weekly, monthly)',
  },
  {
    value: 'webhook',
    label: 'Webhook',
    description: 'Run when an external system calls the webhook URL',
  },
  {
    value: 'manual',
    label: 'Manual',
    description: 'Run manually when triggered by a user',
  },
];

const eventTypes = [
  { value: 'task_created', label: 'Task Created' },
  { value: 'task_updated', label: 'Task Updated' },
  { value: 'task_completed', label: 'Task Completed' },
  { value: 'contact_created', label: 'Contact Created' },
  { value: 'contact_updated', label: 'Contact Updated' },
  { value: 'opportunity_created', label: 'Opportunity Created' },
  { value: 'opportunity_status_changed', label: 'Opportunity Status Changed' },
  { value: 'project_created', label: 'Project Created' },
  { value: 'project_status_changed', label: 'Project Status Changed' },
];

export default function WorkflowForm({
  mode,
  initialData,
  onSubmit,
  onCancel,
  loading = false,
  error,
}: WorkflowFormProps) {
  const theme = useTheme();

  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [triggerType, setTriggerType] = useState<TriggerType>(initialData?.trigger_type || 'event');
  const [triggerConfig, setTriggerConfig] = useState<Record<string, unknown>>(
    initialData?.trigger_config || {}
  );
  const [steps, setSteps] = useState<WorkflowStepInput[]>(initialData?.steps || []);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const handleAddStep = useCallback(() => {
    setSteps((prev) => [
      ...prev,
      {
        step_type: 'action',
        action_type: 'send_notification',
        config: {},
      },
    ]);
  }, []);

  const handleUpdateStep = useCallback((index: number, step: WorkflowStepInput) => {
    setSteps((prev) => {
      const updated = [...prev];
      updated[index] = step;
      return updated;
    });
  }, []);

  const handleRemoveStep = useCallback((index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleMoveStep = useCallback((index: number, direction: 'up' | 'down') => {
    setSteps((prev) => {
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= prev.length) return prev;

      const updated = [...prev];
      [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
      return updated;
    });
  }, []);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!name.trim()) {
      errors.name = 'Name is required';
    }

    if (triggerType === 'event') {
      const eventConfig = triggerConfig as unknown as EventTriggerConfig;
      if (!eventConfig.event_types || eventConfig.event_types.length === 0) {
        errors.event_types = 'Select at least one event type';
      }
    }

    if (triggerType === 'schedule') {
      const scheduleConfig = triggerConfig as unknown as ScheduleTriggerConfig;
      if (!scheduleConfig.schedule_type) {
        errors.schedule_type = 'Select a schedule type';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    const data = {
      name: name.trim(),
      description: description.trim() || undefined,
      trigger_type: triggerType,
      trigger_config: triggerConfig,
      steps,
    };

    await onSubmit(data);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {error && <Alert severity="error">{error}</Alert>}

      {/* Basic Info */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Basic Information
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Workflow Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={!!validationErrors.name}
            helperText={validationErrors.name}
            fullWidth
            required
          />

          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            rows={2}
            fullWidth
          />
        </Box>
      </Paper>

      {/* Trigger Configuration */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Trigger
        </Typography>

        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Trigger Type</InputLabel>
          <Select
            value={triggerType}
            onChange={(e) => {
              setTriggerType(e.target.value as TriggerType);
              setTriggerConfig({});
            }}
            label="Trigger Type"
          >
            {triggerTypeOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                <Box>
                  <Typography>{option.label}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {option.description}
                  </Typography>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Event Trigger Config */}
        {triggerType === 'event' && (
          <FormControl fullWidth error={!!validationErrors.event_types}>
            <InputLabel>Event Types</InputLabel>
            <Select
              multiple
              value={((triggerConfig as Record<string, unknown>).event_types as string[]) || []}
              onChange={(e) =>
                setTriggerConfig({ ...triggerConfig, event_types: e.target.value })
              }
              label="Event Types"
            >
              {eventTypes.map((event) => (
                <MenuItem key={event.value} value={event.value}>
                  {event.label}
                </MenuItem>
              ))}
            </Select>
            {validationErrors.event_types && (
              <FormHelperText>{validationErrors.event_types}</FormHelperText>
            )}
          </FormControl>
        )}

        {/* Schedule Trigger Config */}
        {triggerType === 'schedule' && (
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <FormControl sx={{ minWidth: 200 }} error={!!validationErrors.schedule_type}>
              <InputLabel>Schedule Type</InputLabel>
              <Select
                value={((triggerConfig as Record<string, unknown>).schedule_type as string) || ''}
                onChange={(e) =>
                  setTriggerConfig({
                    ...triggerConfig,
                    schedule_type: e.target.value,
                  })
                }
                label="Schedule Type"
              >
                <MenuItem value="daily">Daily</MenuItem>
                <MenuItem value="weekly">Weekly</MenuItem>
                <MenuItem value="monthly">Monthly</MenuItem>
              </Select>
              {validationErrors.schedule_type && (
                <FormHelperText>{validationErrors.schedule_type}</FormHelperText>
              )}
            </FormControl>

            <TextField
              label="Time (HH:MM)"
              value={((triggerConfig as Record<string, unknown>).time as string) || '09:00'}
              onChange={(e) =>
                setTriggerConfig({ ...triggerConfig, time: e.target.value })
              }
              placeholder="09:00"
              sx={{ width: 120 }}
            />

            {(triggerConfig as Record<string, unknown>).schedule_type === 'weekly' && (
              <FormControl sx={{ minWidth: 150 }}>
                <InputLabel>Day of Week</InputLabel>
                <Select
                  value={((triggerConfig as Record<string, unknown>).day_of_week as number) ?? 1}
                  onChange={(e) =>
                    setTriggerConfig({
                      ...triggerConfig,
                      day_of_week: Number(e.target.value),
                    })
                  }
                  label="Day of Week"
                >
                  <MenuItem value={0}>Sunday</MenuItem>
                  <MenuItem value={1}>Monday</MenuItem>
                  <MenuItem value={2}>Tuesday</MenuItem>
                  <MenuItem value={3}>Wednesday</MenuItem>
                  <MenuItem value={4}>Thursday</MenuItem>
                  <MenuItem value={5}>Friday</MenuItem>
                  <MenuItem value={6}>Saturday</MenuItem>
                </Select>
              </FormControl>
            )}

            {(triggerConfig as Record<string, unknown>).schedule_type === 'monthly' && (
              <TextField
                label="Day of Month"
                type="number"
                value={((triggerConfig as Record<string, unknown>).day_of_month as number) || 1}
                onChange={(e) =>
                  setTriggerConfig({
                    ...triggerConfig,
                    day_of_month: Number(e.target.value),
                  })
                }
                inputProps={{ min: 1, max: 31 }}
                sx={{ width: 120 }}
              />
            )}
          </Box>
        )}

        {/* Webhook Trigger Config */}
        {triggerType === 'webhook' && (
          <Typography variant="body2" color="text.secondary">
            A unique webhook URL will be generated when you save this workflow.
          </Typography>
        )}
      </Paper>

      {/* Steps */}
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Steps</Typography>
          <Button startIcon={<AddIcon />} onClick={handleAddStep} size="small">
            Add Step
          </Button>
        </Box>

        {steps.length === 0 ? (
          <Box
            sx={{
              py: 4,
              textAlign: 'center',
              backgroundColor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50',
              borderRadius: 1,
            }}
          >
            <Typography color="text.secondary" gutterBottom>
              No steps yet
            </Typography>
            <Button startIcon={<AddIcon />} onClick={handleAddStep}>
              Add First Step
            </Button>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {steps.map((step, index) => (
              <Box key={index}>
                {index > 0 && <Divider sx={{ my: 1 }} />}
                <StepEditor
                  step={step}
                  stepIndex={index}
                  totalSteps={steps.length}
                  onChange={(updated) => handleUpdateStep(index, updated)}
                  onRemove={() => handleRemoveStep(index)}
                  onMoveUp={() => handleMoveStep(index, 'up')}
                  onMoveDown={() => handleMoveStep(index, 'down')}
                />
              </Box>
            ))}
          </Box>
        )}
      </Paper>

      {/* Actions */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        <Button variant="outlined" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? 'Saving...' : mode === 'create' ? 'Create Workflow' : 'Save Changes'}
        </Button>
      </Box>
    </Box>
  );
}

