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
  Typography,
  Alert,
  FormHelperText,
  IconButton,
  Drawer,
  Divider,
  Chip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { 
  Save as SaveIcon, 
  Settings as SettingsIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import WorkflowCanvas from './canvas/WorkflowCanvas';
import WorkflowAIAgent, { type GeneratedWorkflow } from './WorkflowAIAgent';
import type {
  TriggerType,
  WorkflowStep,
  EventTriggerConfig,
  ScheduleTriggerConfig,
} from '@/types/workflows';

interface WorkflowBuilderProps {
  mode: 'create' | 'edit';
  initialData?: {
    name: string;
    description: string | null;
    trigger_type: TriggerType;
    trigger_config: Record<string, unknown>;
    steps: WorkflowStep[];
  };
  onSubmit: (data: {
    name?: string;
    description?: string;
    trigger_type?: TriggerType;
    trigger_config?: Record<string, unknown>;
    steps?: WorkflowStep[];
    is_active?: boolean;
  }) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  error?: string | null;
}

export default function WorkflowBuilder({
  mode,
  initialData,
  onSubmit,
  onCancel,
  loading = false,
  error,
}: WorkflowBuilderProps) {
  const theme = useTheme();

  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [steps, setSteps] = useState<WorkflowStep[]>(initialData?.steps || []);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [triggerData, setTriggerData] = useState<{ type: TriggerType; config: Record<string, unknown> }>({
    type: initialData?.trigger_type || 'event',
    config: initialData?.trigger_config || {},
  });
  // Key to force canvas re-initialization when AI generates a new workflow
  const [canvasResetKey, setCanvasResetKey] = useState(0);

  const handleStepsChange = useCallback((newSteps: WorkflowStep[]) => {
    setSteps(newSteps);
  }, []);

  // Handle AI-generated workflow application
  const handleApplyAIWorkflow = useCallback((workflow: GeneratedWorkflow) => {
    console.log('[handleApplyAIWorkflow] Received workflow:', JSON.stringify(workflow, null, 2));
    console.log('[handleApplyAIWorkflow] Workflow steps count:', workflow.steps?.length);
    
    // Update workflow name and description if provided
    if (workflow.name) setName(workflow.name);
    if (workflow.description) setDescription(workflow.description);
    
    // Update trigger data
    setTriggerData({
      type: workflow.trigger_type,
      config: workflow.trigger_config,
    });
    
    const timestamp = Date.now();
    
    // Create a trigger pseudo-step (index 0 is treated as trigger by convertToNodes)
    const triggerStep: WorkflowStep = {
      id: `ai-trigger-${timestamp}`,
      workflow_id: '',
      step_order: 0,
      step_type: 'action', // Will be converted to trigger node due to index 0
      action_type: null,
      config: {
        trigger_type: workflow.trigger_type,
        trigger_config: workflow.trigger_config,
      } as unknown as WorkflowStep['config'],
      else_goto_step: null,
      created_at: new Date().toISOString(),
    };
    
    console.log('[handleApplyAIWorkflow] Created triggerStep:', JSON.stringify(triggerStep, null, 2));
    
    // Convert AI steps to proper WorkflowStep format with required fields
    // Start at index 1 since trigger is at index 0
    const actionSteps: WorkflowStep[] = (workflow.steps || []).map((step, index) => ({
      id: `ai-step-${timestamp}-${index + 1}`,
      workflow_id: '',
      step_order: index + 1,
      step_type: step.step_type,
      action_type: step.action_type || null,
      config: step.config,
      else_goto_step: step.else_goto_step ?? null,
      created_at: new Date().toISOString(),
    }));
    
    console.log('[handleApplyAIWorkflow] Created actionSteps:', JSON.stringify(actionSteps, null, 2));
    
    // Combine trigger + action steps
    const formattedSteps = [triggerStep, ...actionSteps];
    
    console.log('[handleApplyAIWorkflow] Final formattedSteps count:', formattedSteps.length);
    console.log('[handleApplyAIWorkflow] formattedSteps:', JSON.stringify(formattedSteps, null, 2));
    
    setSteps(formattedSteps);
    
    // Force canvas re-initialization
    setCanvasResetKey((prev) => prev + 1);
  }, []);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!name.trim()) {
      errors.name = 'Name is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      // Extract trigger config from steps (look for trigger node config)
      let extractedTriggerType: TriggerType = 'event';
      let extractedTriggerConfig: Record<string, unknown> = {};
      
      // Filter out trigger nodes and extract trigger config
      const workflowSteps: WorkflowStep[] = [];
      
      console.log('[WorkflowBuilder] ========== SUBMIT DEBUG ==========');
      console.log('[WorkflowBuilder] Total steps in state:', steps.length);
      console.log('[WorkflowBuilder] Steps:', JSON.stringify(steps, null, 2));
      
      steps.forEach((step, index) => {
        const config = step.config as unknown as Record<string, unknown>;
        const hasTriggerConfig = config?.trigger_type !== undefined && config?.trigger_config !== undefined;
        
        console.log(`[WorkflowBuilder] Step ${index}:`, {
          step_type: step.step_type,
          action_type: step.action_type,
          hasTriggerConfig,
          configKeys: config ? Object.keys(config) : [],
        });
        
        // Check if this step contains trigger configuration
        if (hasTriggerConfig) {
          console.log('[WorkflowBuilder] -> This is a trigger pseudo-step, extracting config');
          extractedTriggerType = config.trigger_type as TriggerType;
          extractedTriggerConfig = config.trigger_config as Record<string, unknown>;
        } else {
          // Regular workflow step
          console.log('[WorkflowBuilder] -> Adding to workflowSteps');
          workflowSteps.push(step);
        }
      });
      
      console.log('[WorkflowBuilder] Final workflowSteps count:', workflowSteps.length);
      console.log('[WorkflowBuilder] workflowSteps:', JSON.stringify(workflowSteps, null, 2));

      // Fallback to initial data if no trigger config was extracted from steps
      if (Object.keys(extractedTriggerConfig).length === 0 && initialData) {
        console.log('[WorkflowBuilder] Using fallback trigger from initialData');
        extractedTriggerType = initialData.trigger_type;
        extractedTriggerConfig = initialData.trigger_config as Record<string, unknown>;
      }

      // For event triggers without event_types, set an empty array (workflow will need to be configured before activation)
      if (extractedTriggerType === 'event' && !extractedTriggerConfig.event_types) {
        console.warn('[WorkflowBuilder] Event trigger missing event_types - workflow will need configuration before activation');
        extractedTriggerConfig.event_types = [];
      }

      const data = {
        name: name.trim(),
        description: description.trim() || undefined,
        trigger_type: extractedTriggerType,
        trigger_config: extractedTriggerConfig,
        steps: workflowSteps,
      };

      console.log('[WorkflowBuilder] Submitting data:', data);
      await onSubmit(data);
    } catch (err) {
      console.error('[WorkflowBuilder] Submit error:', err);
      throw err;
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: theme.palette.background.default,
      }}
    >
      {/* Top Bar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 3,
          py: 1.5,
          borderBottom: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.background.paper,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {name || 'Untitled Workflow'}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<SettingsIcon />}
            onClick={() => setSettingsOpen(true)}
            size="small"
          >
            Settings
          </Button>
          <Button variant="outlined" onClick={onCancel} disabled={loading} size="small">
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSubmit}
            disabled={loading}
            size="small"
          >
            {loading ? 'Saving...' : mode === 'create' ? 'Create' : 'Save'}
          </Button>
        </Box>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mx: 2, mt: 2 }} onClose={() => {}}>
          {error}
        </Alert>
      )}

      {/* Full-Screen Canvas */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        <WorkflowCanvas
          key={`canvas-${canvasResetKey}`}
          initialSteps={canvasResetKey > 0 ? steps : (initialData?.steps || [])}
          onChange={handleStepsChange}
        />
      </Box>

      {/* Settings Drawer */}
      <Drawer
        anchor="right"
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
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
              Workflow Settings
            </Typography>
            <IconButton onClick={() => setSettingsOpen(false)} size="small">
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
              gap: 3,
            }}
          >
            {/* Basic Info */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
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
                  size="small"
                />

                <TextField
                  label="Description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  multiline
                  rows={2}
                  fullWidth
                  size="small"
                />
              </Box>
            </Box>
          </Box>
        </Box>
      </Drawer>

      {/* AI Workflow Builder Agent */}
      <WorkflowAIAgent
        currentWorkflowName={name}
        currentSteps={steps}
        onApplyWorkflow={handleApplyAIWorkflow}
      />
    </Box>
  );
}

