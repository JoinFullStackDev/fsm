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
  Slider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import HelpTooltip from '@/components/ui/HelpTooltip';
import type { TemplateFieldConfig } from '@/types/templates';
import type { ScoredFeature } from '@/types/phases';

interface ScoredFeaturesFieldProps {
  field: TemplateFieldConfig;
  value: ScoredFeature[];
  onChange: (value: ScoredFeature[]) => void;
  error?: string;
  phaseData?: any;
}

export default function ScoredFeaturesField({ field, value, onChange, error, phaseData }: ScoredFeaturesFieldProps) {
  const config = field.field_config;
  const features = Array.isArray(value) ? value : [];

  const addScoredFeature = () => {
    const newFeature: ScoredFeature = {
      title: '',
      description: '',
      target_persona: '',
      target_outcome: '',
      impact: 5,
      effort: 5,
      confidence: 5,
      mvp_group: 'v2',
    };
    onChange([...features, newFeature]);
  };

  const updateFeature = (index: number, feature: ScoredFeature) => {
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
          <Grid item xs={12} key={index}>
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
                    {feature.title || `Scored Feature ${index + 1}`}
                  </Typography>
                  <IconButton
                    onClick={() => removeFeature(index)}
                    size="small"
                    sx={{ color: 'error.main' }}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Title"
                      value={feature.title}
                      onChange={(e) => updateFeature(index, { ...feature, title: e.target.value })}
                      margin="normal"
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth margin="normal" size="small">
                      <InputLabel>MVP Group</InputLabel>
                      <Select
                        value={feature.mvp_group}
                        onChange={(e) => updateFeature(index, { ...feature, mvp_group: e.target.value as 'mvp' | 'v2' | 'v3' })}
                        label="MVP Group"
                      >
                        <MenuItem value="mvp">MVP</MenuItem>
                        <MenuItem value="v2">V2</MenuItem>
                        <MenuItem value="v3">V3</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12}>
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
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Target Persona"
                      value={feature.target_persona}
                      onChange={(e) => updateFeature(index, { ...feature, target_persona: e.target.value })}
                      margin="normal"
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Target Outcome"
                      value={feature.target_outcome}
                      onChange={(e) => updateFeature(index, { ...feature, target_outcome: e.target.value })}
                      margin="normal"
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography gutterBottom>Impact: {feature.impact}</Typography>
                    <Slider
                      value={feature.impact}
                      onChange={(_, newValue) => updateFeature(index, { ...feature, impact: newValue as number })}
                      min={1}
                      max={10}
                      step={1}
                      marks
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography gutterBottom>Effort: {feature.effort}</Typography>
                    <Slider
                      value={feature.effort}
                      onChange={(_, newValue) => updateFeature(index, { ...feature, effort: newValue as number })}
                      min={1}
                      max={10}
                      step={1}
                      marks
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography gutterBottom>Confidence: {feature.confidence}</Typography>
                    <Slider
                      value={feature.confidence}
                      onChange={(_, newValue) => updateFeature(index, { ...feature, confidence: newValue as number })}
                      min={1}
                      max={10}
                      step={1}
                      marks
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      <Button
        startIcon={<AddIcon />}
        onClick={addScoredFeature}
        variant="outlined"
        sx={{
          mt: '1.5rem',
          borderColor: 'primary.main',
          color: 'primary.main',
        }}
      >
        Add Scored Feature
      </Button>
    </Box>
  );
}

