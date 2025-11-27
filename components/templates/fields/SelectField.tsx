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
  useTheme,
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
  const theme = useTheme();
  const config = field.field_config;
  const options = config.options || [];

  return (
    <FormControl fullWidth size="small" error={!!error} required={config.required}>
      <InputLabel sx={{ color: theme.palette.text.secondary }}>{config.label}</InputLabel>
      <Select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        label={config.label}
        MenuProps={{
          PaperProps: {
            sx: {
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              '& .MuiMenuItem-root': {
                color: theme.palette.text.primary,
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
                },
                '&.Mui-selected': {
                  backgroundColor: theme.palette.action.hover,
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover,
                  },
                },
              },
            },
          },
        }}
        sx={{
          color: theme.palette.text.primary,
          backgroundColor: theme.palette.background.paper,
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: error ? theme.palette.error.main : theme.palette.divider,
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: error ? theme.palette.error.main : theme.palette.text.secondary,
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: error ? theme.palette.error.main : theme.palette.text.primary,
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
        <FormHelperText sx={{ color: theme.palette.text.secondary }}>
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

