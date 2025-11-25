'use client';

import React from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Box,
  Typography,
} from '@mui/material';
import HelpTooltip from '@/components/ui/HelpTooltip';
import type { TemplateFieldConfig } from '@/types/templates';

interface SelectFieldProps {
  field: TemplateFieldConfig;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  phaseData?: any;
}

function SelectField({ field, value, onChange, error, phaseData }: SelectFieldProps) {
  const config = field.field_config;
  const options = config.options || [];

  return (
    <FormControl fullWidth size="small" error={!!error} required={config.required}>
      <InputLabel sx={{ color: 'text.secondary' }}>{config.label}</InputLabel>
      <Select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        label={config.label}
        sx={{
          color: 'text.primary',
          '.MuiOutlinedInput-notchedOutline': {
            borderColor: error ? 'error.main' : 'rgba(0, 229, 255, 0.3)',
          },
        }}
      >
        {options.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
      {error && (
        <FormHelperText error>
          {error}
        </FormHelperText>
      )}
      {config.helpText && !error && (
        <FormHelperText>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <span>{config.helpText}</span>
            <HelpTooltip title={config.helpText} />
          </Box>
        </FormHelperText>
      )}
    </FormControl>
  );
}

export default React.memo(SelectField);

