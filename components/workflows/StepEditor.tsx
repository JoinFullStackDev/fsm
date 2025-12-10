'use client';

import {
  Box,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  IconButton,
  Typography,
  Collapse,
  Chip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Delete as DeleteIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { useState } from 'react';
import { getActionDescription } from '@/lib/workflows/actionUtils';
import type { WorkflowStepInput, StepType, ActionType } from '@/types/workflows';

interface StepEditorProps {
  step: WorkflowStepInput;
  stepIndex: number;
  totalSteps: number;
  onChange: (step: WorkflowStepInput) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

const stepTypes: { value: StepType; label: string }[] = [
  { value: 'action', label: 'Action' },
  { value: 'condition', label: 'Condition (If/Else)' },
  { value: 'delay', label: 'Delay (Wait)' },
];

const actionTypes: { value: ActionType; label: string; category: string }[] = [
  // Communication
  { value: 'send_email', label: 'Send Email', category: 'Communication' },
  { value: 'send_notification', label: 'Send In-App Notification', category: 'Communication' },
  { value: 'send_push', label: 'Send Push Notification', category: 'Communication' },
  // Tasks
  { value: 'create_task', label: 'Create Task', category: 'Tasks' },
  { value: 'update_task', label: 'Update Task', category: 'Tasks' },
  // Contacts
  { value: 'update_contact', label: 'Update Contact', category: 'Contacts' },
  { value: 'add_tag', label: 'Add Tag', category: 'Contacts' },
  { value: 'remove_tag', label: 'Remove Tag', category: 'Contacts' },
  // Projects
  { value: 'create_project', label: 'Create Project', category: 'Projects' },
  { value: 'create_project_from_template', label: 'Create Project from Template', category: 'Projects' },
  // AI
  { value: 'ai_generate', label: 'AI Generate Content', category: 'AI' },
  { value: 'ai_categorize', label: 'AI Categorize', category: 'AI' },
  { value: 'ai_summarize', label: 'AI Summarize', category: 'AI' },
  // Integrations
  { value: 'webhook_call', label: 'Call Webhook', category: 'Integrations' },
  { value: 'create_activity', label: 'Create Activity Log', category: 'Integrations' },
];

const conditionOperators = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Does Not Equal' },
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Does Not Contain' },
  { value: 'gt', label: 'Greater Than' },
  { value: 'gte', label: 'Greater Than or Equal' },
  { value: 'lt', label: 'Less Than' },
  { value: 'lte', label: 'Less Than or Equal' },
  { value: 'is_empty', label: 'Is Empty' },
  { value: 'is_not_empty', label: 'Is Not Empty' },
];

export default function StepEditor({
  step,
  stepIndex,
  totalSteps,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: StepEditorProps) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(true);

  const updateConfig = (key: string, value: unknown) => {
    onChange({
      ...step,
      config: { ...step.config, [key]: value },
    });
  };

  const getStepLabel = (): string => {
    if (step.step_type === 'action' && step.action_type) {
      return getActionDescription(step.action_type);
    }
    if (step.step_type === 'condition') {
      return 'Condition';
    }
    if (step.step_type === 'delay') {
      return 'Delay';
    }
    return 'Step';
  };

  const groupedActionTypes = actionTypes.reduce((acc, action) => {
    if (!acc[action.category]) acc[action.category] = [];
    acc[action.category].push(action);
    return acc;
  }, {} as Record<string, typeof actionTypes>);

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        backgroundColor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50',
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: expanded ? 2 : 0 }}>
        <Chip label={stepIndex + 1} size="small" color="primary" />
        <Typography variant="subtitle2" sx={{ flex: 1 }}>
          {getStepLabel()}
        </Typography>

        <IconButton
          size="small"
          onClick={() => setExpanded(!expanded)}
          sx={{ mr: 1 }}
        >
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>

        <IconButton
          size="small"
          onClick={onMoveUp}
          disabled={stepIndex === 0}
        >
          <ArrowUpIcon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          onClick={onMoveDown}
          disabled={stepIndex === totalSteps - 1}
        >
          <ArrowDownIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" onClick={onRemove} color="error">
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Step Type */}
          <FormControl size="small">
            <InputLabel>Step Type</InputLabel>
            <Select
              value={step.step_type}
              onChange={(e) =>
                onChange({
                  ...step,
                  step_type: e.target.value as StepType,
                  action_type: e.target.value === 'action' ? 'send_notification' : undefined,
                  config: {},
                })
              }
              label="Step Type"
            >
              {stepTypes.map((type) => (
                <MenuItem key={type.value} value={type.value}>
                  {type.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Action Type */}
          {step.step_type === 'action' && (
            <FormControl size="small">
              <InputLabel>Action</InputLabel>
              <Select
                value={step.action_type || ''}
                onChange={(e) =>
                  onChange({
                    ...step,
                    action_type: e.target.value as ActionType,
                    config: {},
                  })
                }
                label="Action"
              >
                {Object.entries(groupedActionTypes).map(([category, actions]) => [
                  <MenuItem key={`category-${category}`} disabled sx={{ fontWeight: 600, opacity: 1 }}>
                    {category}
                  </MenuItem>,
                  ...actions.map((action) => (
                    <MenuItem key={action.value} value={action.value} sx={{ pl: 4 }}>
                      {action.label}
                    </MenuItem>
                  )),
                ])}
              </Select>
            </FormControl>
          )}

          {/* Action Config */}
          {step.step_type === 'action' && step.action_type && (
            <ActionConfigEditor
              actionType={step.action_type}
              config={step.config as Record<string, unknown>}
              updateConfig={updateConfig}
            />
          )}

          {/* Condition Config */}
          {step.step_type === 'condition' && (
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                label="Field"
                value={(step.config as Record<string, unknown>).field || ''}
                onChange={(e) => updateConfig('field', e.target.value)}
                placeholder="e.g., contact.status"
                size="small"
                sx={{ flex: 1, minWidth: 200 }}
              />
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Operator</InputLabel>
                <Select
                  value={(step.config as Record<string, unknown>).operator || ''}
                  onChange={(e) => updateConfig('operator', e.target.value)}
                  label="Operator"
                >
                  {conditionOperators.map((op) => (
                    <MenuItem key={op.value} value={op.value}>
                      {op.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Value"
                value={(step.config as Record<string, unknown>).value || ''}
                onChange={(e) => updateConfig('value', e.target.value)}
                size="small"
                sx={{ flex: 1, minWidth: 150 }}
              />
            </Box>
          )}

          {/* Delay Config */}
          {step.step_type === 'delay' && (
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Delay Value"
                type="number"
                value={(step.config as Record<string, unknown>).delay_value || 1}
                onChange={(e) => updateConfig('delay_value', Number(e.target.value))}
                inputProps={{ min: 1 }}
                size="small"
                sx={{ width: 120 }}
              />
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Unit</InputLabel>
                <Select
                  value={(step.config as Record<string, unknown>).delay_type || 'hours'}
                  onChange={(e) => updateConfig('delay_type', e.target.value)}
                  label="Unit"
                >
                  <MenuItem value="minutes">Minutes</MenuItem>
                  <MenuItem value="hours">Hours</MenuItem>
                  <MenuItem value="days">Days</MenuItem>
                </Select>
              </FormControl>
            </Box>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
}

// Action-specific config editors
function ActionConfigEditor({
  actionType,
  config,
  updateConfig,
}: {
  actionType: ActionType;
  config: Record<string, unknown> | { [key: string]: unknown };
  updateConfig: (key: string, value: unknown) => void;
}) {
  switch (actionType) {
    case 'send_email':
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="To (Email)"
            value={config.to || ''}
            onChange={(e) => updateConfig('to', e.target.value)}
            placeholder="{{contact.email}}"
            size="small"
            fullWidth
            helperText="Use {{variable}} for dynamic values"
          />
          <TextField
            label="Subject"
            value={config.subject || ''}
            onChange={(e) => updateConfig('subject', e.target.value)}
            size="small"
            fullWidth
          />
          <TextField
            label="Body (HTML)"
            value={config.body_html || ''}
            onChange={(e) => updateConfig('body_html', e.target.value)}
            multiline
            rows={3}
            size="small"
            fullWidth
          />
        </Box>
      );

    case 'send_notification':
    case 'send_push':
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="User Field"
            value={config.user_field || ''}
            onChange={(e) => updateConfig('user_field', e.target.value)}
            placeholder="e.g., task.assignee_id"
            size="small"
            fullWidth
            helperText="Context path to user ID"
          />
          <TextField
            label="Title"
            value={config.title || ''}
            onChange={(e) => updateConfig('title', e.target.value)}
            size="small"
            fullWidth
          />
          <TextField
            label="Message"
            value={config.message || ''}
            onChange={(e) => updateConfig('message', e.target.value)}
            multiline
            rows={2}
            size="small"
            fullWidth
          />
        </Box>
      );

    case 'create_task':
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Project Field"
            value={config.project_field || ''}
            onChange={(e) => updateConfig('project_field', e.target.value)}
            placeholder="e.g., trigger.entity_id"
            size="small"
            fullWidth
          />
          <TextField
            label="Title"
            value={config.title || ''}
            onChange={(e) => updateConfig('title', e.target.value)}
            size="small"
            fullWidth
          />
          <TextField
            label="Description"
            value={config.description || ''}
            onChange={(e) => updateConfig('description', e.target.value)}
            multiline
            rows={2}
            size="small"
            fullWidth
          />
        </Box>
      );

    case 'webhook_call':
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="URL"
            value={config.url || ''}
            onChange={(e) => updateConfig('url', e.target.value)}
            size="small"
            fullWidth
          />
          <FormControl size="small">
            <InputLabel>Method</InputLabel>
            <Select
              value={config.method || 'POST'}
              onChange={(e) => updateConfig('method', e.target.value)}
              label="Method"
            >
              <MenuItem value="GET">GET</MenuItem>
              <MenuItem value="POST">POST</MenuItem>
              <MenuItem value="PUT">PUT</MenuItem>
              <MenuItem value="PATCH">PATCH</MenuItem>
              <MenuItem value="DELETE">DELETE</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Body Template (JSON)"
            value={config.body_template || ''}
            onChange={(e) => updateConfig('body_template', e.target.value)}
            multiline
            rows={3}
            size="small"
            fullWidth
          />
        </Box>
      );

    case 'ai_generate':
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Prompt Template"
            value={config.prompt_template || ''}
            onChange={(e) => updateConfig('prompt_template', e.target.value)}
            multiline
            rows={3}
            size="small"
            fullWidth
            helperText="Use {{variable}} for context values"
          />
          <TextField
            label="Output Field Name"
            value={config.output_field || ''}
            onChange={(e) => updateConfig('output_field', e.target.value)}
            placeholder="e.g., generated_summary"
            size="small"
            fullWidth
          />
        </Box>
      );

    default:
      return (
        <Typography variant="body2" color="text.secondary">
          Configure this action in the JSON config below.
        </Typography>
      );
  }
}

