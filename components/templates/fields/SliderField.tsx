'use client';

import React from 'react';
import { Box, Typography, Slider } from '@mui/material';
import type { TemplateFieldConfig } from '@/types/templates';

interface SliderFieldProps {
  field: TemplateFieldConfig;
  value: number | null;
  onChange: (value: number | null) => void;
  error?: string;
  phaseData?: any;
}

function SliderField({ field, value, onChange, error, phaseData }: SliderFieldProps) {
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
        <Typography variant="caption" color="error" sx={{ mb: 1, display: 'block' }}>
          {error}
        </Typography>
      )}
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
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
              color: 'primary.main',
            },
            '& .MuiSlider-track': {
              color: 'primary.main',
            },
            '& .MuiSlider-rail': {
              color: 'action.disabledBackground',
            },
          }}
        />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            {min}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {max}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

export default React.memo(SliderField);

