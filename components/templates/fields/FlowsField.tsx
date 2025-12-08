'use client';
import type { PhaseDataUnion } from '@/types/phases';

import {
  Box,
  TextField,
  Button,
  Card,
  CardContent,
  IconButton,
  Grid,
  Typography,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import AIAssistButton from '@/components/ai/AIAssistButton';
import type { TemplateFieldConfig } from '@/types/templates';
import type { Flow } from '@/types/phases';

interface FlowsFieldProps {
  field: TemplateFieldConfig;
  value: Flow[];
  onChange: (value: Flow[]) => void;
  error?: string;
  phaseData?: Record<string, unknown>;
}

export default function FlowsField({ field, value, onChange, error, phaseData }: FlowsFieldProps) {
  const config = field.field_config;
  const flows = Array.isArray(value) ? value : [];
  const aiEnabled = config.aiSettings?.enabled;

  const addFlow = () => {
    const newFlow: Flow = {
      name: '',
      start_screen: '',
      end_screen: '',
      steps: [],
      notes: '',
    };
    onChange([...flows, newFlow]);
  };

  const updateFlow = (index: number, flow: Flow) => {
    const updated = [...flows];
    updated[index] = flow;
    onChange(updated);
  };

  const removeFlow = (index: number) => {
    onChange(flows.filter((_, i) => i !== index));
  };

  return (
    <Box sx={{ width: '100%' }}>
      {error && (
        <Typography variant="caption" color="error" sx={{ mb: 2, display: 'block' }}>
          {error}
        </Typography>
      )}
      <Grid container spacing={{ xs: 1, md: 2 }} sx={{ mb: 2 }}>
        {flows.map((flow, index) => (
          <Grid item xs={12} md={6} key={index}>
            <Card
              sx={{
                backgroundColor: 'background.paper',
                border: '1px solid',
                borderColor: 'primary.main',
                borderRadius: 2,
              }}
            >
              <CardContent sx={{ p: { xs: 1.5, md: 2 }, '&:last-child': { pb: { xs: 1.5, md: 2 } } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ color: 'primary.main', fontWeight: 600 }}>
                    {flow.name || `Flow ${index + 1}`}
                  </Typography>
                  <IconButton
                    onClick={() => removeFlow(index)}
                    size="small"
                    sx={{ color: 'error.main' }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
                <TextField
                  fullWidth
                  label="Name"
                  value={flow.name}
                  onChange={(e) => updateFlow(index, { ...flow, name: e.target.value })}
                  margin="normal"
                  size="small"
                />
                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Start Screen"
                      value={flow.start_screen}
                      onChange={(e) => updateFlow(index, { ...flow, start_screen: e.target.value })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="End Screen"
                      value={flow.end_screen}
                      onChange={(e) => updateFlow(index, { ...flow, end_screen: e.target.value })}
                      size="small"
                    />
                  </Grid>
                </Grid>
                <TextField
                  fullWidth
                  label="Steps (one per line)"
                  multiline
                  rows={3}
                  value={flow.steps.join('\n')}
                  onChange={(e) => updateFlow(index, { ...flow, steps: e.target.value.split('\n').filter(s => s.trim()) })}
                  margin="normal"
                  size="small"
                />
                <TextField
                  fullWidth
                  label="Notes"
                  multiline
                  rows={2}
                  value={flow.notes}
                  onChange={(e) => updateFlow(index, { ...flow, notes: e.target.value })}
                  margin="normal"
                  size="small"
                />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mt: '1.5rem' }}>
        <Button
          startIcon={<AddIcon />}
          onClick={addFlow}
          variant="outlined"
          sx={{
            borderColor: 'primary.main',
            color: 'primary.main',
            '&:hover': {
              borderColor: 'primary.light',
              backgroundColor: 'rgba(0, 229, 255, 0.1)',
            },
          }}
        >
          Add Flow
        </Button>
        {aiEnabled && (
          <AIAssistButton
            label="AI Generate Flows"
            onGenerate={async (additionalPrompt) => {
              const response = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  prompt: `${config.aiSettings?.customPrompt || 'Generate user flows based on screens'}. Return as JSON array of flow objects with name, start_screen, end_screen, steps (array), and notes. ${additionalPrompt || ''}`,
                  options: {
                    context: config.aiSettings?.contextFields
                      ? `Context from other fields: ${JSON.stringify(
                          config.aiSettings.contextFields.reduce((acc, key) => {
                            acc[key] = phaseData?.[key];
                            return acc;
                          }, {} as Record<string, any>)
                        )}`
                      : undefined,
                    phaseData: phaseData,
                  },
                  structured: true,
                }),
              });
              const json = await response.json();
              if (!response.ok) throw new Error(json.error);
              return JSON.stringify(json.result, null, 2);
            }}
            onAccept={(result) => {
              try {
                const generated = JSON.parse(result);
                if (Array.isArray(generated)) {
                  onChange([...flows, ...generated]);
                }
              } catch {}
            }}
            context="AI will generate user flows based on your screens"
          />
        )}
      </Box>
    </Box>
  );
}

