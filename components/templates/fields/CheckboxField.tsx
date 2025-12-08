'use client';
import type { PhaseDataUnion } from '@/types/phases';

import React from 'react';
import { FormControlLabel, Checkbox, Box, Typography, useTheme } from '@mui/material';
import HelpTooltip from '@/components/ui/HelpTooltip';
import type { TemplateFieldConfig } from '@/types/templates';

interface CheckboxFieldProps {
  field: TemplateFieldConfig;
  value: boolean;
  onChange: (value: boolean) => void;
  error?: string;
  phaseData?: Record<string, unknown>;
}

function CheckboxField({ field, value, onChange, error, phaseData }: CheckboxFieldProps) {
  const theme = useTheme();
  const config = field.field_config;

  return (
    <Box>
      <FormControlLabel
        control={
          <Checkbox
            checked={value || false}
            onChange={(e) => onChange(e.target.checked)}
            sx={{
              color: theme.palette.text.primary,
              '&.Mui-checked': {
                color: theme.palette.text.primary,
              },
            }}
          />
        }
        label={config.label}
        sx={{ color: theme.palette.text.primary }}
      />
      {error && (
        <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: theme.palette.error.main }}>
          {error}
        </Typography>
      )}
    </Box>
  );
}

export default React.memo(CheckboxField);

