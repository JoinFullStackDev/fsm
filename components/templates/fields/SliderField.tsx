'use client';
import type { PhaseDataUnion } from '@/types/phases';

import React from 'react';
import { Box, Typography, Slider, useTheme } from '@mui/material';
import type { TemplateFieldConfig } from '@/types/templates';

interface SliderFieldProps {
  field: TemplateFieldConfig;
  value: number | null;
  onChange: (value: number | null) => void;
  error?: string;
  phaseData?: Record<string, unknown>;
}

function SliderField({ field, value, onChange, error, phaseData }: SliderFieldProps) {
  const theme = useTheme();
  const config = field.field_config;
  const min = config.min ?? 0;
  const max = config.max ?? 100;
  const step = config.step ?? 1;
  const currentValue = value ?? min;

  const handleChange = (_: Event, newValue: number | number[]) => {
    onChange(newValue as number);
  };

  return (
    <Box sx={{ width: '100%', px: 1 }}>
      {error && (
        <Typography variant="caption" sx={{ mb: 1, display: 'block', color: theme.palette.error.main }}>
          {error}
        </Typography>
      )}
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" sx={{ mb: 1, color: theme.palette.text.secondary }}>
          {config.label}: {currentValue}
        </Typography>
        <Slider
          value={currentValue}
          onChange={handleChange}
          min={min}
          max={max}
          step={step}
          marks={max - min <= 20}
          valueLabelDisplay="auto"
          sx={{
            '& .MuiSlider-thumb': {
              color: theme.palette.text.primary,
            },
            '& .MuiSlider-track': {
              color: theme.palette.text.primary,
            },
            '& .MuiSlider-rail': {
              color: theme.palette.divider,
            },
            '& .MuiSlider-valueLabel': {
              backgroundColor: theme.palette.background.paper,
              color: theme.palette.text.primary,
              border: `1px solid ${theme.palette.divider}`,
            },
          }}
        />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
          <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
            {min}
          </Typography>
          <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
            {max}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

export default React.memo(SliderField);

