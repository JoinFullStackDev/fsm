'use client';

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
import type { Component } from '@/types/phases';

interface ComponentsFieldProps {
  field: TemplateFieldConfig;
  value: Component[];
  onChange: (value: Component[]) => void;
  error?: string;
  phaseData?: any;
}

export default function ComponentsField({ field, value, onChange, error, phaseData }: ComponentsFieldProps) {
  const config = field.field_config;
  const components = Array.isArray(value) ? value : [];
  const aiEnabled = config.aiSettings?.enabled;

  const addComponent = () => {
    const newComponent: Component = {
      name: '',
      description: '',
      props: {},
      state_behavior: '',
      used_on: [],
    };
    onChange([...components, newComponent]);
  };

  const updateComponent = (index: number, component: Component) => {
    const updated = [...components];
    updated[index] = component;
    onChange(updated);
  };

  const removeComponent = (index: number) => {
    onChange(components.filter((_, i) => i !== index));
  };

  return (
    <Box sx={{ width: '100%' }}>
      {error && (
        <Typography variant="caption" color="error" sx={{ mb: 2, display: 'block' }}>
          {error}
        </Typography>
      )}
      <Grid container spacing={{ xs: 1, md: 2 }} sx={{ mb: 2 }}>
        {components.map((component, index) => (
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
                    {component.name || `Component ${index + 1}`}
                  </Typography>
                  <IconButton
                    onClick={() => removeComponent(index)}
                    size="small"
                    sx={{ color: 'error.main' }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
                <TextField
                  fullWidth
                  label="Name"
                  value={component.name}
                  onChange={(e) => updateComponent(index, { ...component, name: e.target.value })}
                  margin="normal"
                  size="small"
                />
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Description"
                  value={component.description}
                  onChange={(e) => updateComponent(index, { ...component, description: e.target.value })}
                  margin="normal"
                  size="small"
                />
                <TextField
                  fullWidth
                  label="Props (JSON format)"
                  multiline
                  rows={3}
                  value={JSON.stringify(component.props, null, 2)}
                  onChange={(e) => {
                    try {
                      const props = JSON.parse(e.target.value);
                      updateComponent(index, { ...component, props });
                    } catch {}
                  }}
                  margin="normal"
                  size="small"
                  placeholder='{"prop1": "string", "prop2": "number"}'
                />
                <TextField
                  fullWidth
                  label="State Behavior"
                  multiline
                  rows={2}
                  value={component.state_behavior}
                  onChange={(e) => updateComponent(index, { ...component, state_behavior: e.target.value })}
                  margin="normal"
                  size="small"
                />
                <TextField
                  fullWidth
                  label="Used On (comma-separated)"
                  value={component.used_on.join(', ')}
                  onChange={(e) => updateComponent(index, { ...component, used_on: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
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
          onClick={addComponent}
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
          Add Component
        </Button>
        {aiEnabled && (
          <AIAssistButton
            label="AI Suggest Components"
            onGenerate={async (additionalPrompt) => {
              const response = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  prompt: `${config.aiSettings?.customPrompt || 'Suggest reusable components based on screens'}. Return as JSON array of component objects with name, description, props (object), state_behavior, and used_on (array). ${additionalPrompt || ''}`,
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
                  onChange([...components, ...generated]);
                }
              } catch {}
            }}
            context="AI will suggest reusable components based on your screens"
          />
        )}
      </Box>
    </Box>
  );
}

