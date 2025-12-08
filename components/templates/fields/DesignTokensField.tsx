'use client';
import type { PhaseDataUnion } from '@/types/phases';

import { Box, TextField, Typography } from '@mui/material';
import type { TemplateFieldConfig } from '@/types/templates';
import type { DesignTokens } from '@/types/phases';

interface DesignTokensFieldProps {
  field: TemplateFieldConfig;
  value: DesignTokens;
  onChange: (value: DesignTokens) => void;
  error?: string;
  phaseData?: Record<string, unknown>;
}

export default function DesignTokensField({ field, value, onChange, error, phaseData }: DesignTokensFieldProps) {
  const config = field.field_config;
  const tokens = value || { colors: {}, typography: {}, spacing: {} };

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
        rows={8}
        label={config.label}
        value={JSON.stringify(tokens, null, 2)}
        onChange={(e) => {
          try {
            const parsed = JSON.parse(e.target.value);
            onChange(parsed);
          } catch {}
        }}
        placeholder='{"colors": {}, "spacing": {}, "typography": {}}'
        error={!!error}
        helperText={error || config.helpText}
        size="small"
      />
    </Box>
  );
}

