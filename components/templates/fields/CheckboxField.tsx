'use client';

import React from 'react';
import { FormControlLabel, Checkbox, Box, Typography } from '@mui/material';
import HelpTooltip from '@/components/ui/HelpTooltip';
import type { TemplateFieldConfig } from '@/types/templates';

interface CheckboxFieldProps {
  field: TemplateFieldConfig;
  value: boolean;
  onChange: (value: boolean) => void;
  error?: string;
  phaseData?: any;
}

function CheckboxField({ field, value, onChange, error, phaseData }: CheckboxFieldProps) {
  const config = field.field_config;

  return (
    <Box>
      <FormControlLabel
        control={
          <Checkbox
            checked={value || false}
            onChange={(e) => onChange(e.target.checked)}
            sx={{
              color: 'primary.main',
              '&.Mui-checked': {
                color: 'primary.main',
              },
            }}
          />
        }
        label={config.label}
        sx={{ color: 'text.primary' }}
      />
      {error && (
        <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
          {error}
        </Typography>
      )}
    </Box>
  );
}

export default React.memo(CheckboxField);

