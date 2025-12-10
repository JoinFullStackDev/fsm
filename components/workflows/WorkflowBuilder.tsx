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

  const handleStepsChange = useCallback((newSteps: WorkflowStep[]) => {
    setSteps(newSteps);
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
      
      console.log('[WorkflowBuilder] Steps before processing:', steps);
      
      steps.forEach((step) => {
        const config = step.config as any;
        
        // Check if this step contains trigger configuration
        if (config?.trigger_type && config?.trigger_config) {
          console.log('[WorkflowBuilder] Found trigger config:', config);
          extractedTriggerType = config.trigger_type;
          extractedTriggerConfig = config.trigger_config;
        } else {
          // Regular workflow step
          workflowSteps.push(step);
        }
      });

      // Fallback to initial data if no trigger found in steps
      if ((!extractedTriggerType || extractedTriggerType === 'event') && initialData) {
        console.log('[WorkflowBuilder] Using fallback trigger from initialData');
        extractedTriggerType = initialData.trigger_type;
        extractedTriggerConfig = initialData.trigger_config as Record<string, unknown>;
      }

      // Ensure event triggers have event_types
      if (extractedTriggerType === 'event' && (!extractedTriggerConfig.event_types || (extractedTriggerConfig.event_types as any[]).length === 0)) {
        console.error('[WorkflowBuilder] Event trigger missing event_types');
        throw new Error('Please configure the trigger node: Event triggers must have at least one event type selected.');
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
          initialSteps={initialData?.steps || []}
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
    </Box>
  );
}

