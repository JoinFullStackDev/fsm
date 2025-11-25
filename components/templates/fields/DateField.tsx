'use client';

import React from 'react';
import { TextField as MuiTextField, Box } from '@mui/material';
import type { TemplateFieldConfig } from '@/types/templates';

interface DateFieldProps {
  field: TemplateFieldConfig;
  value: string | null;
  onChange: (value: string | null) => void;
  error?: string;
  phaseData?: any;
}

function DateField({ field, value, onChange, error, phaseData }: DateFieldProps) {
  const config = field.field_config;
  
  // Format value for date input (YYYY-MM-DD)
  const formatDateForInput = (dateString: string | null): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      return date.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    if (!inputValue) {
      onChange(null);
      return;
    }
    // Date input returns YYYY-MM-DD format, which is already ISO-compatible
    onChange(inputValue);
  };

  return (
    <Box sx={{ width: '100%' }}>
      <MuiTextField
        fullWidth
        type="date"
        label={config.label}
        value={formatDateForInput(value)}
        onChange={handleChange}
        placeholder={config.placeholder}
        required={config.required}
        error={!!error}
        helperText={error || config.helpText}
        size="small"
        InputLabelProps={{
          shrink: true,
        }}
        sx={{
          '& .MuiInputBase-input': {
            color: 'text.primary',
          },
          '& .MuiInputLabel-root': {
            fontSize: '0.875rem',
          },
        }}
      />
    </Box>
  );
}

export default React.memo(DateField);

