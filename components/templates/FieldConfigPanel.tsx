'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Grid,
  IconButton,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  Settings as SettingsIcon,
  ViewModule as ViewModuleIcon,
  CheckCircle as CheckCircleIcon,
  SmartToy as SmartToyIcon,
  Tune as TuneIcon,
} from '@mui/icons-material';
import { validateFieldLabel } from '@/lib/utils/validation';
import type { TemplateFieldConfig } from '@/types/templates';

interface FieldConfigPanelProps {
  field: TemplateFieldConfig;
  onUpdate: (field: TemplateFieldConfig) => void;
  onClose: () => void;
}

export default function FieldConfigPanel({ field, onUpdate, onClose }: FieldConfigPanelProps) {
  const [localField, setLocalField] = useState<TemplateFieldConfig>(field);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Sync local field when prop changes
  useEffect(() => {
    setLocalField(field);
  }, [field]);

  // Handle keyboard navigation - Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const updateField = (updates: Partial<TemplateFieldConfig>) => {
    const updated = { ...localField, ...updates };
    setLocalField(updated);
    onUpdate(updated);
  };

  const updateFieldConfig = (updates: Partial<TemplateFieldConfig['field_config']>) => {
    const updatedConfig = {
      ...localField.field_config,
      ...updates,
    };
    
    // Validate label if it's being updated
    if ('label' in updates) {
      const labelValidation = validateFieldLabel(updatedConfig.label || '');
      if (!labelValidation.valid) {
        setValidationErrors({ ...validationErrors, label: labelValidation.error || 'Invalid label' });
      } else {
        setValidationErrors({ ...validationErrors, label: '' });
      }
    }
    
    updateField({
      field_config: updatedConfig,
    });
  };

  const updateLayoutConfig = (updates: Partial<TemplateFieldConfig['layout_config']>) => {
    updateField({
      layout_config: {
        ...localField.layout_config,
        ...updates,
      },
    });
  };

  return (
    <Paper
      sx={{
        p: 3,
        backgroundColor: '#000',
        border: '1px solid',
        borderColor: 'primary.main',
        borderRadius: 2,
        maxHeight: 'calc(100vh - 120px)',
        overflow: 'auto',
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 600 }}>
          Field Configuration
        </Typography>
        <IconButton onClick={onClose} sx={{ color: 'text.secondary' }} aria-label="Close field configuration panel">
          <CloseIcon />
        </IconButton>
      </Box>

      <Divider sx={{ mb: 3, borderColor: 'primary.main' }} />

      {/* Basic Settings */}
      <Accordion defaultExpanded sx={{ mb: 2, backgroundColor: 'transparent', color: 'text.primary' }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: 'primary.main' }} />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SettingsIcon sx={{ color: 'primary.main', fontSize: 20 }} />
            <Typography sx={{ color: 'primary.main', fontWeight: 500 }}>Basic Settings</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Field Key"
                value={localField.field_key}
                onChange={(e) => updateField({ field_key: e.target.value })}
                size="small"
                disabled
                sx={{ '& .MuiInputBase-input': { color: 'text.secondary' } }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Label"
                value={localField.field_config.label || ''}
                onChange={(e) => updateFieldConfig({ label: e.target.value })}
                size="small"
                error={!!validationErrors.label}
                helperText={validationErrors.label}
                required
                sx={{ '& .MuiInputBase-input': { color: 'text.primary' } }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Help Text"
                value={localField.field_config.helpText || ''}
                onChange={(e) => updateFieldConfig({ helpText: e.target.value })}
                size="small"
                sx={{ '& .MuiInputBase-input': { color: 'text.primary' } }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Placeholder"
                value={localField.field_config.placeholder || ''}
                onChange={(e) => updateFieldConfig({ placeholder: e.target.value })}
                size="small"
                sx={{ '& .MuiInputBase-input': { color: 'text.primary' } }}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={localField.field_config.required || false}
                    onChange={(e) => updateFieldConfig({ required: e.target.checked })}
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': {
                        color: 'primary.main',
                      },
                    }}
                  />
                }
                label="Required"
                sx={{ color: 'text.primary' }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Default Value"
                value={localField.field_config.defaultValue || ''}
                onChange={(e) => updateFieldConfig({ defaultValue: e.target.value })}
                size="small"
                sx={{ '& .MuiInputBase-input': { color: 'text.primary' } }}
              />
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Layout Settings */}
      <Accordion sx={{ mb: 2, backgroundColor: 'transparent', color: 'text.primary' }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: 'primary.main' }} />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ViewModuleIcon sx={{ color: 'primary.main', fontSize: 20 }} />
            <Typography sx={{ color: 'primary.main', fontWeight: 500 }}>Layout</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel sx={{ color: 'text.secondary' }}>Grid Columns</InputLabel>
                <Select
                  value={localField.layout_config.columns || 12}
                  label="Grid Columns"
                  onChange={(e) => updateLayoutConfig({ columns: e.target.value as number })}
                  sx={{ color: 'text.primary' }}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => (
                    <MenuItem key={num} value={num}>
                      {num} / 12
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="number"
                label="Spacing"
                value={localField.layout_config.spacing || 2}
                onChange={(e) => updateLayoutConfig({ spacing: parseInt(e.target.value) || 2 })}
                size="small"
                inputProps={{ min: 0, max: 10 }}
                sx={{ '& .MuiInputBase-input': { color: 'text.primary' } }}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel sx={{ color: 'text.secondary' }}>Alignment</InputLabel>
                <Select
                  value={localField.layout_config.alignment || 'left'}
                  label="Alignment"
                  onChange={(e) => updateLayoutConfig({ alignment: e.target.value as 'left' | 'center' | 'right' })}
                  sx={{ color: 'text.primary' }}
                >
                  <MenuItem value="left">Left</MenuItem>
                  <MenuItem value="center">Center</MenuItem>
                  <MenuItem value="right">Right</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Validation Settings */}
      <Accordion sx={{ mb: 2, backgroundColor: 'transparent', color: 'text.primary' }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: 'primary.main' }} />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckCircleIcon sx={{ color: 'primary.main', fontSize: 20 }} />
            <Typography sx={{ color: 'primary.main', fontWeight: 500 }}>Validation</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="Min Length"
                value={localField.field_config.validation?.minLength || ''}
                onChange={(e) =>
                  updateFieldConfig({
                    validation: {
                      ...localField.field_config.validation,
                      minLength: e.target.value ? parseInt(e.target.value) : undefined,
                    },
                  })
                }
                size="small"
                inputProps={{ min: 0 }}
                sx={{ '& .MuiInputBase-input': { color: 'text.primary' } }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="Max Length"
                value={localField.field_config.validation?.maxLength || ''}
                onChange={(e) =>
                  updateFieldConfig({
                    validation: {
                      ...localField.field_config.validation,
                      maxLength: e.target.value ? parseInt(e.target.value) : undefined,
                    },
                  })
                }
                size="small"
                inputProps={{ min: 0 }}
                sx={{ '& .MuiInputBase-input': { color: 'text.primary' } }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Pattern (Regex)"
                value={localField.field_config.validation?.pattern || ''}
                onChange={(e) =>
                  updateFieldConfig({
                    validation: {
                      ...localField.field_config.validation,
                      pattern: e.target.value || undefined,
                    },
                  })
                }
                size="small"
                placeholder="^[a-zA-Z0-9]+$"
                sx={{ '& .MuiInputBase-input': { color: 'text.primary' } }}
              />
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Field Type Specific Settings */}
      {(localField.field_type === 'select' || localField.field_type === 'slider') && (
        <Accordion sx={{ mb: 2, backgroundColor: 'transparent', color: 'text.primary' }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: 'primary.main' }} />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TuneIcon sx={{ color: 'primary.main', fontSize: 20 }} />
              <Typography sx={{ color: 'primary.main', fontWeight: 500 }}>
                {localField.field_type === 'select' ? 'Select Options' : 'Slider Settings'}
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              {localField.field_type === 'select' && (
                <Grid item xs={12}>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                    Options (one per line, format: label|value or just label)
                  </Typography>
                  <TextField
                    fullWidth
                    multiline
                    rows={6}
                    value={
                      localField.field_config.options
                        ?.map(opt => `${opt.label}|${opt.value}`)
                        .join('\n') || ''
                    }
                    onChange={(e) => {
                      const options = e.target.value
                        .split('\n')
                        .filter(Boolean)
                        .map(line => {
                          const parts = line.split('|');
                          return {
                            label: parts[0]?.trim() || line.trim(),
                            value: parts[1]?.trim() || parts[0]?.trim().toLowerCase().replace(/\s+/g, '_') || line.trim(),
                          };
                        });
                      updateFieldConfig({ options });
                    }}
                    size="small"
                    placeholder="Option 1|value1&#10;Option 2|value2"
                    sx={{ '& .MuiInputBase-input': { color: 'text.primary' } }}
                  />
                </Grid>
              )}
              {localField.field_type === 'slider' && (
                <>
                  <Grid item xs={4}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Min"
                      value={localField.field_config.min || 0}
                      onChange={(e) =>
                        updateFieldConfig({ min: parseFloat(e.target.value) || 0 })
                      }
                      size="small"
                      sx={{ '& .MuiInputBase-input': { color: 'text.primary' } }}
                    />
                  </Grid>
                  <Grid item xs={4}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Max"
                      value={localField.field_config.max || 100}
                      onChange={(e) =>
                        updateFieldConfig({ max: parseFloat(e.target.value) || 100 })
                      }
                      size="small"
                      sx={{ '& .MuiInputBase-input': { color: 'text.primary' } }}
                    />
                  </Grid>
                  <Grid item xs={4}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Step"
                      value={localField.field_config.step || 1}
                      onChange={(e) =>
                        updateFieldConfig({ step: parseFloat(e.target.value) || 1 })
                      }
                      size="small"
                      sx={{ '& .MuiInputBase-input': { color: 'text.primary' } }}
                    />
                  </Grid>
                </>
              )}
            </Grid>
          </AccordionDetails>
        </Accordion>
      )}

      {/* AI Settings */}
      <Accordion sx={{ mb: 2, backgroundColor: 'transparent', color: 'text.primary' }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: 'primary.main' }} />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SmartToyIcon sx={{ color: 'primary.main', fontSize: 20 }} />
            <Typography sx={{ color: 'primary.main', fontWeight: 500 }}>AI Generation</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={localField.field_config.aiSettings?.enabled || false}
                    onChange={(e) =>
                      updateFieldConfig({
                        aiSettings: {
                          ...(localField.field_config.aiSettings || {}),
                          enabled: e.target.checked,
                        },
                      })
                    }
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': {
                        color: 'primary.main',
                      },
                    }}
                  />
                }
                label="Enable AI Assist"
                sx={{ color: 'text.primary' }}
              />
            </Grid>
            {localField.field_config.aiSettings?.enabled && (
              <>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Custom Prompt"
                    value={localField.field_config.aiSettings?.customPrompt || ''}
                    onChange={(e) =>
                      updateFieldConfig({
                        aiSettings: {
                          enabled: true,
                          ...(localField.field_config.aiSettings || {}),
                          customPrompt: e.target.value,
                        },
                      })
                    }
                    size="small"
                    placeholder="Custom prompt for AI generation..."
                    sx={{ '& .MuiInputBase-input': { color: 'text.primary' } }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Context Fields (comma-separated)"
                    value={localField.field_config.aiSettings?.contextFields?.join(', ') || ''}
                    onChange={(e) =>
                      updateFieldConfig({
                        aiSettings: {
                          enabled: true,
                          ...(localField.field_config.aiSettings || {}),
                          contextFields: e.target.value
                            ? e.target.value.split(',').map(f => f.trim()).filter(Boolean)
                            : undefined,
                        },
                      })
                    }
                    size="small"
                    placeholder="field1, field2, field3"
                    sx={{ '& .MuiInputBase-input': { color: 'text.primary' } }}
                  />
                </Grid>
              </>
            )}
          </Grid>
        </AccordionDetails>
      </Accordion>
    </Paper>
  );
}

