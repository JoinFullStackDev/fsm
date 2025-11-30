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
import type { Entity } from '@/types/phases';

interface EntitiesFieldProps {
  field: TemplateFieldConfig;
  value: Entity[];
  onChange: (value: Entity[]) => void;
  error?: string;
  phaseData?: any;
}

export default function EntitiesField({ field, value, onChange, error, phaseData }: EntitiesFieldProps) {
  const config = field.field_config;
  const entities = Array.isArray(value) ? value : [];
  const aiEnabled = config.aiSettings?.enabled;

  const addEntity = () => {
    const newEntity: Entity = {
      name: '',
      description: '',
      key_fields: [],
      relationships: [],
    };
    onChange([...entities, newEntity]);
  };

  const updateEntity = (index: number, entity: Entity) => {
    const updated = [...entities];
    updated[index] = entity;
    onChange(updated);
  };

  const removeEntity = (index: number) => {
    onChange(entities.filter((_, i) => i !== index));
  };

  return (
    <Box sx={{ width: '100%' }}>
      {error && (
        <Typography variant="caption" color="error" sx={{ mb: 2, display: 'block' }}>
          {error}
        </Typography>
      )}
      <Grid container spacing={{ xs: 1, md: 2 }} sx={{ mb: 2 }}>
        {entities.map((entity, index) => (
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
                    {entity.name || `Entity ${index + 1}`}
                  </Typography>
                  <IconButton
                    onClick={() => removeEntity(index)}
                    size="small"
                    sx={{ color: 'error.main' }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
                <TextField
                  fullWidth
                  label="Name"
                  value={entity.name}
                  onChange={(e) => updateEntity(index, { ...entity, name: e.target.value })}
                  margin="normal"
                  size="small"
                />
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Description"
                  value={entity.description}
                  onChange={(e) => updateEntity(index, { ...entity, description: e.target.value })}
                  margin="normal"
                  size="small"
                />
                <TextField
                  fullWidth
                  label="Key Fields (comma-separated)"
                  value={entity.key_fields.join(', ')}
                  onChange={(e) => updateEntity(index, { ...entity, key_fields: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                  margin="normal"
                  size="small"
                />
                <TextField
                  fullWidth
                  label="Relationships (comma-separated)"
                  value={entity.relationships.join(', ')}
                  onChange={(e) => updateEntity(index, { ...entity, relationships: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
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
          onClick={addEntity}
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
          Add Entity
        </Button>
        {aiEnabled && (
          <AIAssistButton
            label="AI Generate Entities"
            onGenerate={async (additionalPrompt) => {
              const response = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  prompt: `${config.aiSettings?.customPrompt || 'Generate data entities based on features and screens'}. Return as JSON array of entity objects with name, description, key_fields (array), and relationships (array). ${additionalPrompt || ''}`,
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
                  onChange([...entities, ...generated]);
                }
              } catch {}
            }}
            context="AI will suggest data entities based on your features and screens"
          />
        )}
      </Box>
    </Box>
  );
}

