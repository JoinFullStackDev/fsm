'use client';

import { Box, TextField, Typography } from '@mui/material';
import type { TemplateFieldConfig } from '@/types/templates';

interface RBACFieldProps {
  field: TemplateFieldConfig;
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  error?: string;
  phaseData?: any;
}

export default function RBACField({ field, value, onChange, error, phaseData }: RBACFieldProps) {
  const config = field.field_config;
  const rbac = value || {};

  return (
    <Box sx={{ width: '100%' }}>
      {error && (
        <Typography variant="caption" color="error" sx={{ mb: 1, display: 'block' }}>
          {error}
        </Typography>
      )}
      <TextField
        fullWidth
        multiline
        rows={10}
        label={config.label}
        value={JSON.stringify(rbac, null, 2)}
        onChange={(e) => {
          try {
            const parsed = JSON.parse(e.target.value);
            onChange(parsed);
          } catch {}
        }}
        placeholder='{"role": {"entity": ["view", "create", "edit", "delete"]}}'
        error={!!error}
        helperText={error || config.helpText}
        size="small"
      />
    </Box>
  );
}

