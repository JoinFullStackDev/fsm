'use client';

import {
  Box,
  TextField,
  Button,
  Card,
  CardContent,
  IconButton,
  Typography,
  Grid,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import HelpTooltip from '@/components/ui/HelpTooltip';
import type { TemplateFieldConfig } from '@/types/templates';
import type { Feature } from '@/types/phases';

interface FeaturesFieldProps {
  field: TemplateFieldConfig;
  value: Feature[];
  onChange: (value: Feature[]) => void;
  error?: string;
  phaseData?: any;
}

export default function FeaturesField({ field, value, onChange, error, phaseData }: FeaturesFieldProps) {
  const config = field.field_config;
  const features = Array.isArray(value) ? value : [];

  const addFeature = () => {
    const newFeature: Feature = {
      title: '',
      description: '',
      target_persona: '',
      target_outcome: '',
    };
    onChange([...features, newFeature]);
  };

  const updateFeature = (index: number, feature: Feature) => {
    const updated = [...features];
    updated[index] = feature;
    onChange(updated);
  };

  const removeFeature = (index: number) => {
    onChange(features.filter((_, i) => i !== index));
  };

  return (
    <Box>
      {error && (
        <Typography variant="caption" color="error" sx={{ mb: 2, display: 'block' }}>
          {error}
        </Typography>
      )}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {features.map((feature, index) => (
          <Grid item xs={12} md={6} key={index}>
            <Card
              sx={{
                backgroundColor: 'background.paper',
                border: '1px solid',
                borderColor: 'primary.main',
                borderRadius: 2,
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ color: 'primary.main', fontWeight: 600 }}>
                    Feature {index + 1}
                  </Typography>
                  <IconButton
                    onClick={() => removeFeature(index)}
                    size="small"
                    sx={{ color: 'error.main' }}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
                <TextField
                  fullWidth
                  label="Title"
                  value={feature.title}
                  onChange={(e) => updateFeature(index, { ...feature, title: e.target.value })}
                  margin="normal"
                  size="small"
                />
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Description"
                  value={feature.description}
                  onChange={(e) => updateFeature(index, { ...feature, description: e.target.value })}
                  margin="normal"
                  size="small"
                />
                <TextField
                  fullWidth
                  label="Target Persona"
                  value={feature.target_persona}
                  onChange={(e) => updateFeature(index, { ...feature, target_persona: e.target.value })}
                  margin="normal"
                  size="small"
                />
                <TextField
                  fullWidth
                  label="Target Outcome"
                  value={feature.target_outcome}
                  onChange={(e) => updateFeature(index, { ...feature, target_outcome: e.target.value })}
                  margin="normal"
                  size="small"
                />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      <Button
        startIcon={<AddIcon />}
        onClick={addFeature}
        variant="outlined"
        sx={{
          mt: '1.5rem',
          borderColor: 'primary.main',
          color: 'primary.main',
        }}
      >
        Add Feature
      </Button>
    </Box>
  );
}

