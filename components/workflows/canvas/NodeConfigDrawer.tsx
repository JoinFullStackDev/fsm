'use client';

import { useState, useEffect } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Close as CloseIcon, Delete as DeleteIcon, Save as SaveIcon } from '@mui/icons-material';
import type { Node } from '@xyflow/react';

interface NodeConfigDrawerProps {
  open: boolean;
  node: Node | null;
  onClose: () => void;
  onUpdate: (nodeId: string, data: Record<string, unknown>) => void;
  onDelete: (nodeId: string) => void;
}

const actionTypes = [
  { value: 'send_email', label: 'Send Email' },
  { value: 'send_notification', label: 'Send Notification' },
  { value: 'send_slack', label: 'Send Slack Message' },
  { value: 'create_task', label: 'Create Task' },
  { value: 'update_task', label: 'Update Task' },
  { value: 'create_project', label: 'Create Project' },
  { value: 'webhook_call', label: 'Call Webhook' },
  { value: 'ai_generate', label: 'AI Generate' },
];

const conditionOperators = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'gt', label: 'Greater Than' },
  { value: 'lt', label: 'Less Than' },
];

const triggerTypeOptions = [
  { value: 'event', label: 'Event Trigger' },
  { value: 'schedule', label: 'Scheduled' },
  { value: 'webhook', label: 'Webhook' },
  { value: 'manual', label: 'Manual' },
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

export default function NodeConfigDrawer({
  open,
  node,
  onClose,
  onUpdate,
  onDelete,
}: NodeConfigDrawerProps) {
  const theme = useTheme();
  const [label, setLabel] = useState('');
  const [actionType, setActionType] = useState('');
  const [field, setField] = useState('');
  const [operator, setOperator] = useState('');
  const [value, setValue] = useState('');
  const [delayValue, setDelayValue] = useState(1);
  const [delayType, setDelayType] = useState('hours');
  
  // Trigger node state
  const [triggerType, setTriggerType] = useState('event');
  const [triggerConfig, setTriggerConfig] = useState<Record<string, unknown>>({});

  // Action-specific state - Email
  const [emailTo, setEmailTo] = useState('');
  const [emailCc, setEmailCc] = useState('');
  const [emailBcc, setEmailBcc] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  // Action-specific state - Notification
  const [notificationUserField, setNotificationUserField] = useState('');
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationLink, setNotificationLink] = useState('');

  // Action-specific state - Task
  const [taskProjectField, setTaskProjectField] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskAssigneeField, setTaskAssigneeField] = useState('');
  const [taskPriority, setTaskPriority] = useState('medium');
  const [taskStatus, setTaskStatus] = useState('todo');

  // Action-specific state - Webhook
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookMethod, setWebhookMethod] = useState('POST');
  const [webhookBody, setWebhookBody] = useState('');
  const [webhookHeaders, setWebhookHeaders] = useState('');

  // Action-specific state - AI
  const [aiPromptTemplate, setAiPromptTemplate] = useState('');
  const [aiOutputField, setAiOutputField] = useState('');
  const [aiMaxTokens, setAiMaxTokens] = useState(1000);

  // Action-specific state - Slack
  const [slackChannel, setSlackChannel] = useState('');
  const [slackMessage, setSlackMessage] = useState('');
  const [slackNotifyChannel, setSlackNotifyChannel] = useState(false);
  const [slackUseBlocks, setSlackUseBlocks] = useState(false);

  useEffect(() => {
    if (node) {
      setLabel((node.data.label as string) || '');
      setActionType((node.data.actionType as string) || '');
      setField((node.data.field as string) || '');
      setOperator((node.data.operator as string) || '');
      setValue((node.data.value as string) || '');
      setDelayValue((node.data.delayValue as number) || 1);
      setDelayType((node.data.delayType as string) || 'hours');
      setTriggerType((node.data.triggerType as string) || 'event');
      setTriggerConfig((node.data.triggerConfig as Record<string, unknown>) || {});

      // Load action configs from stepData
      const config = (node.data.stepData as any)?.config || {};
      
      // Email config
      setEmailTo(config.to || '');
      setEmailCc(config.cc || '');
      setEmailBcc(config.bcc || '');
      setEmailSubject(config.subject || '');
      setEmailBody(config.body_html || '');

      // Notification config
      setNotificationUserField(config.user_field || '');
      setNotificationTitle(config.title || '');
      setNotificationMessage(config.message || '');
      setNotificationLink(config.link || '');

      // Task config
      setTaskProjectField(config.project_field || '');
      setTaskTitle(config.title || '');
      setTaskDescription(config.description || '');
      setTaskAssigneeField(config.assignee_field || '');
      setTaskPriority(config.priority || 'medium');
      setTaskStatus(config.status || 'todo');

      // Webhook config
      setWebhookUrl(config.url || '');
      setWebhookMethod(config.method || 'POST');
      setWebhookBody(config.body_template || '');
      setWebhookHeaders(config.headers ? JSON.stringify(config.headers, null, 2) : '');

      // Slack config
      setSlackChannel(config.channel || '');
      setSlackMessage(config.message || '');
      setSlackNotifyChannel(config.notify_channel || false);
      setSlackUseBlocks(config.use_blocks || false);

      // AI config
      setAiPromptTemplate(config.prompt_template || '');
      setAiOutputField(config.output_field || '');
      setAiMaxTokens(config.max_tokens || 1000);
    }
  }, [node]);

  const handleSave = () => {
    if (!node) return;

    const updates: Record<string, unknown> = {
      label,
    };

    if (node.type === 'trigger') {
      updates.triggerType = triggerType;
      updates.triggerConfig = triggerConfig;
    }

    if (node.type === 'action') {
      updates.actionType = actionType;
    }

    if (node.type === 'condition') {
      updates.field = field;
      updates.operator = operator;
      updates.value = value;
    }

    if (node.type === 'delay') {
      updates.delayValue = delayValue;
      updates.delayType = delayType;
    }

    // Build action-specific config
    let actionConfig = {};
    if (node.type === 'action') {
      switch (actionType) {
        case 'send_email':
          actionConfig = {
            to: emailTo,
            cc: emailCc || undefined,
            bcc: emailBcc || undefined,
            subject: emailSubject,
            body_html: emailBody,
          };
          break;
        case 'send_notification':
          actionConfig = {
            user_field: notificationUserField,
            title: notificationTitle,
            message: notificationMessage,
            link: notificationLink || undefined,
          };
          break;
        case 'create_task':
          actionConfig = {
            project_field: taskProjectField,
            title: taskTitle,
            description: taskDescription,
            assignee_field: taskAssigneeField || undefined,
            priority: taskPriority,
            status: taskStatus,
          };
          break;
        case 'webhook_call':
          actionConfig = {
            url: webhookUrl,
            method: webhookMethod,
            body_template: webhookBody || undefined,
            headers: webhookHeaders ? JSON.parse(webhookHeaders) : undefined,
          };
          break;
        case 'ai_generate':
        case 'ai_categorize':
        case 'ai_summarize':
          actionConfig = {
            prompt_template: aiPromptTemplate,
            output_field: aiOutputField,
            max_tokens: aiMaxTokens,
          };
          break;
        case 'send_slack':
          actionConfig = {
            channel: slackChannel,
            message: slackMessage,
            notify_channel: slackNotifyChannel || undefined,
            use_blocks: slackUseBlocks || undefined,
          };
          break;
      }
    }

    // Update stepData for conversion back to API format
    updates.stepData = {
      ...(node.data.stepData as Record<string, unknown> || {}),
      step_type: node.type === 'trigger' ? 'action' : node.type,
      action_type: node.type === 'action' ? actionType : undefined,
      config: {
        ...(node.type === 'condition' && { field, operator, value }),
        ...(node.type === 'delay' && { delay_value: delayValue, delay_type: delayType }),
        ...(node.type === 'trigger' && { trigger_type: triggerType, trigger_config: triggerConfig }),
        ...(node.type === 'action' && actionConfig),
      },
    };

    onUpdate(node.id, updates);
    onClose();
  };

  const handleDelete = () => {
    if (node && window.confirm('Are you sure you want to delete this node?')) {
      onDelete(node.id);
    }
  };

  if (!node) return null;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: 400,
          maxWidth: '90vw',
          backgroundColor: theme.palette.background.paper,
          transform: 'translateY(60px) !important',
        },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          maxHeight: 'calc(100vh - 60px)',
        }}
      >
        {/* Header */}
        <Box
          sx={{
            p: 3,
            borderBottom: `1px solid ${theme.palette.divider}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: theme.palette.background.paper,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Configure Node
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Content */}
        <Box
          sx={{
            flex: 1,
            overflow: 'auto',
            p: 3,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
        {/* Common: Label */}
        <TextField
          label="Node Label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          fullWidth
          size="small"
        />

        <Divider />

        {/* Trigger Node Config */}
        {node.type === 'trigger' && (
          <>
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>Trigger Type</InputLabel>
              <Select
                value={triggerType}
                onChange={(e) => {
                  setTriggerType(e.target.value);
                  setTriggerConfig({});
                }}
                label="Trigger Type"
              >
                {triggerTypeOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Event Trigger Config */}
            {triggerType === 'event' && (
              <FormControl fullWidth size="small">
                <InputLabel>Event Types</InputLabel>
                <Select
                  multiple
                  value={(triggerConfig.event_types as string[]) || []}
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
              </FormControl>
            )}

            {/* Schedule Trigger Config */}
            {triggerType === 'schedule' && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Schedule Type</InputLabel>
                  <Select
                    value={(triggerConfig.schedule_type as string) || ''}
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
                </FormControl>

                <TextField
                  label="Time (HH:MM)"
                  value={(triggerConfig.time as string) || '09:00'}
                  onChange={(e) =>
                    setTriggerConfig({ ...triggerConfig, time: e.target.value })
                  }
                  placeholder="09:00"
                  size="small"
                  fullWidth
                />
              </Box>
            )}

            {/* Webhook Trigger Config */}
            {triggerType === 'webhook' && (
              <Typography variant="body2" color="text.secondary">
                A unique webhook URL will be generated when you save this workflow.
              </Typography>
            )}
          </>
        )}

        {/* Action Node Config */}
        {node.type === 'action' && (
          <>
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>Action Type</InputLabel>
              <Select
                value={actionType}
                onChange={(e) => {
                  setActionType(e.target.value);
                  // Clear action-specific fields when changing type
                }}
                label="Action Type"
              >
                {actionTypes.map((type) => (
                  <MenuItem key={type.value} value={type.value}>
                    {type.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Send Email Config */}
            {actionType === 'send_email' && (
              <>
                <TextField
                  label="To (Email)"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  placeholder="{{contact.email}} or user@example.com"
                  helperText="Use {{variable}} for dynamic values"
                  size="small"
                  fullWidth
                  sx={{ mb: 2 }}
                />
                <TextField
                  label="CC (Optional)"
                  value={emailCc}
                  onChange={(e) => setEmailCc(e.target.value)}
                  placeholder="manager@example.com"
                  size="small"
                  fullWidth
                  sx={{ mb: 2 }}
                />
                <TextField
                  label="Subject"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="New opportunity: {{opportunity.name}}"
                  size="small"
                  fullWidth
                  sx={{ mb: 2 }}
                />
                <TextField
                  label="Email Body (HTML)"
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  multiline
                  rows={6}
                  placeholder="<p>Hello {{contact.name}},</p><p>A new opportunity has been created...</p>"
                  size="small"
                  fullWidth
                  helperText="HTML supported. Use {{variables}} for dynamic content."
                />
              </>
            )}

            {/* Send Notification Config */}
            {actionType === 'send_notification' && (
              <>
                <TextField
                  label="User Field"
                  value={notificationUserField}
                  onChange={(e) => setNotificationUserField(e.target.value)}
                  placeholder="{{opportunity.owner_id}}"
                  helperText="Field path to user ID (e.g., opportunity.owner_id)"
                  size="small"
                  fullWidth
                  sx={{ mb: 2 }}
                />
                <TextField
                  label="Title"
                  value={notificationTitle}
                  onChange={(e) => setNotificationTitle(e.target.value)}
                  placeholder="New Opportunity Created"
                  size="small"
                  fullWidth
                  sx={{ mb: 2 }}
                />
                <TextField
                  label="Message"
                  value={notificationMessage}
                  onChange={(e) => setNotificationMessage(e.target.value)}
                  multiline
                  rows={4}
                  placeholder="Opportunity {{opportunity.name}} was created in {{company.name}}"
                  size="small"
                  fullWidth
                  sx={{ mb: 2 }}
                />
                <TextField
                  label="Link (Optional)"
                  value={notificationLink}
                  onChange={(e) => setNotificationLink(e.target.value)}
                  placeholder="/ops/opportunities/{{opportunity.id}}"
                  size="small"
                  fullWidth
                />
              </>
            )}

            {/* Create Task Config */}
            {actionType === 'create_task' && (
              <>
                <TextField
                  label="Project Field"
                  value={taskProjectField}
                  onChange={(e) => setTaskProjectField(e.target.value)}
                  placeholder="{{opportunity.project_id}}"
                  helperText="Field path to project ID"
                  size="small"
                  fullWidth
                  sx={{ mb: 2 }}
                />
                <TextField
                  label="Task Title"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Follow up on {{opportunity.name}}"
                  size="small"
                  fullWidth
                  sx={{ mb: 2 }}
                />
                <TextField
                  label="Description"
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  multiline
                  rows={3}
                  placeholder="Contact {{contact.name}} about the opportunity"
                  size="small"
                  fullWidth
                  sx={{ mb: 2 }}
                />
                <TextField
                  label="Assignee Field (Optional)"
                  value={taskAssigneeField}
                  onChange={(e) => setTaskAssigneeField(e.target.value)}
                  placeholder="{{opportunity.owner_id}}"
                  size="small"
                  fullWidth
                  sx={{ mb: 2 }}
                />
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <FormControl size="small" sx={{ flex: 1 }}>
                    <InputLabel>Priority</InputLabel>
                    <Select
                      value={taskPriority}
                      onChange={(e) => setTaskPriority(e.target.value)}
                      label="Priority"
                    >
                      <MenuItem value="low">Low</MenuItem>
                      <MenuItem value="medium">Medium</MenuItem>
                      <MenuItem value="high">High</MenuItem>
                      <MenuItem value="critical">Critical</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ flex: 1 }}>
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={taskStatus}
                      onChange={(e) => setTaskStatus(e.target.value)}
                      label="Status"
                    >
                      <MenuItem value="todo">To Do</MenuItem>
                      <MenuItem value="in_progress">In Progress</MenuItem>
                      <MenuItem value="done">Done</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              </>
            )}

            {/* Webhook Call Config */}
            {actionType === 'webhook_call' && (
              <>
                <TextField
                  label="Webhook URL"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://api.example.com/webhook"
                  size="small"
                  fullWidth
                  sx={{ mb: 2 }}
                />
                <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                  <InputLabel>HTTP Method</InputLabel>
                  <Select
                    value={webhookMethod}
                    onChange={(e) => setWebhookMethod(e.target.value)}
                    label="HTTP Method"
                  >
                    <MenuItem value="GET">GET</MenuItem>
                    <MenuItem value="POST">POST</MenuItem>
                    <MenuItem value="PUT">PUT</MenuItem>
                    <MenuItem value="PATCH">PATCH</MenuItem>
                    <MenuItem value="DELETE">DELETE</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  label="Headers (JSON, Optional)"
                  value={webhookHeaders}
                  onChange={(e) => setWebhookHeaders(e.target.value)}
                  multiline
                  rows={3}
                  placeholder='{"Authorization": "Bearer {{token}}"}'
                  size="small"
                  fullWidth
                  sx={{ mb: 2 }}
                />
                <TextField
                  label="Body Template (JSON)"
                  value={webhookBody}
                  onChange={(e) => setWebhookBody(e.target.value)}
                  multiline
                  rows={4}
                  placeholder='{"opportunity_id": "{{opportunity.id}}", "name": "{{opportunity.name}}"}'
                  size="small"
                  fullWidth
                  helperText="Use {{variables}} for dynamic values"
                />
              </>
            )}

            {/* AI Actions Config */}
            {(actionType === 'ai_generate' || actionType === 'ai_categorize' || actionType === 'ai_summarize') && (
              <>
                <TextField
                  label="Prompt Template"
                  value={aiPromptTemplate}
                  onChange={(e) => setAiPromptTemplate(e.target.value)}
                  multiline
                  rows={5}
                  placeholder="Summarize this opportunity: {{opportunity.description}}"
                  helperText="Use {{variables}} for dynamic values"
                  size="small"
                  fullWidth
                  sx={{ mb: 2 }}
                />
                <TextField
                  label="Output Field Name"
                  value={aiOutputField}
                  onChange={(e) => setAiOutputField(e.target.value)}
                  placeholder="ai_summary"
                  helperText="Field name to store the AI response"
                  size="small"
                  fullWidth
                  sx={{ mb: 2 }}
                />
                <TextField
                  label="Max Tokens"
                  type="number"
                  value={aiMaxTokens}
                  onChange={(e) => setAiMaxTokens(Number(e.target.value))}
                  inputProps={{ min: 100, max: 4000 }}
                  size="small"
                  fullWidth
                />
              </>
            )}

            {/* Slack Message Config */}
            {actionType === 'send_slack' && (
              <>
                <TextField
                  label="Channel"
                  value={slackChannel}
                  onChange={(e) => setSlackChannel(e.target.value)}
                  placeholder="#general or {{project.slack_channel}}"
                  helperText="Slack channel name or ID (use {{variables}} for dynamic values)"
                  size="small"
                  fullWidth
                  sx={{ mb: 2 }}
                />
                <TextField
                  label="Message"
                  value={slackMessage}
                  onChange={(e) => setSlackMessage(e.target.value)}
                  multiline
                  rows={4}
                  placeholder="New task created: {{task.title}} in project {{project.name}}"
                  helperText="Use {{variables}} for dynamic values from the workflow context"
                  size="small"
                  fullWidth
                  sx={{ mb: 2 }}
                />
                <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
                  <FormControl size="small" sx={{ flex: 1 }}>
                    <InputLabel>Notify Channel</InputLabel>
                    <Select
                      value={slackNotifyChannel ? 'yes' : 'no'}
                      onChange={(e) => setSlackNotifyChannel(e.target.value === 'yes')}
                      label="Notify Channel"
                    >
                      <MenuItem value="no">No</MenuItem>
                      <MenuItem value="yes">Yes (@channel)</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ flex: 1 }}>
                    <InputLabel>Rich Formatting</InputLabel>
                    <Select
                      value={slackUseBlocks ? 'yes' : 'no'}
                      onChange={(e) => setSlackUseBlocks(e.target.value === 'yes')}
                      label="Rich Formatting"
                    >
                      <MenuItem value="no">Plain Text</MenuItem>
                      <MenuItem value="yes">Blocks (Rich)</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  Note: Your organization must have Slack connected to use this action.
                </Typography>
              </>
            )}
          </>
        )}

        {/* Condition Node Config */}
        {node.type === 'condition' && (
          <>
            <TextField
              label="Field"
              value={field}
              onChange={(e) => setField(e.target.value)}
              placeholder="e.g., contact.status"
              fullWidth
              size="small"
            />
            <FormControl fullWidth size="small">
              <InputLabel>Operator</InputLabel>
              <Select
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
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
              value={value}
              onChange={(e) => setValue(e.target.value)}
              fullWidth
              size="small"
            />
          </>
        )}

        {/* Delay Node Config */}
        {node.type === 'delay' && (
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Delay Value"
              type="number"
              value={delayValue}
              onChange={(e) => setDelayValue(Number(e.target.value))}
              inputProps={{ min: 1 }}
              size="small"
              sx={{ width: 120 }}
            />
            <FormControl size="small" sx={{ flex: 1 }}>
              <InputLabel>Unit</InputLabel>
              <Select
                value={delayType}
                onChange={(e) => setDelayType(e.target.value)}
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

        {/* Footer */}
        <Box
          sx={{
            p: 3,
            borderTop: `1px solid ${theme.palette.divider}`,
            display: 'flex',
            gap: 2,
            backgroundColor: theme.palette.background.paper,
          }}
        >
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={handleDelete}
            fullWidth
          >
            Delete
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            fullWidth
          >
            Save
          </Button>
        </Box>
      </Box>
    </Drawer>
  );
}

