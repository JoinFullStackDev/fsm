'use client';

import React from 'react';
import { Box, Typography, Alert } from '@mui/material';
import HelpTooltip from '@/components/ui/HelpTooltip';
import type { TemplateFieldConfig } from '@/types/templates';
import { renderCustomField } from './customFieldRegistry';

// Phase data is dynamic JSONB, so any is appropriate here
type PhaseData = Record<string, unknown>;

interface CustomFieldProps {
  field: TemplateFieldConfig;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  phaseData?: PhaseData;
  renderCustomComponent?: (field: TemplateFieldConfig, value: unknown, onChange: (value: unknown) => void) => React.ReactNode;
}

/**
 * CustomField handles complex field types like:
 * - personas (array of objects)
 * - jtbd (array of objects)
 * - screens (array of objects)
 * - flows (array of objects)
 * - components (array of objects)
 * - entities (array of objects)
 * - user_stories (array of objects)
 * - etc.
 */
function CustomField({ 
  field, 
  value, 
  onChange, 
  error, 
  phaseData,
  renderCustomComponent 
}: CustomFieldProps) {
  const config = field.field_config;

  // If a custom renderer is provided, use it
  if (renderCustomComponent) {
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary' }}>
            {config.label}
            {config.required && <span style={{ color: 'red' }}> *</span>}
          </Typography>
          {config.helpText && <HelpTooltip title={config.helpText} />}
        </Box>
        {error && (
          <Typography variant="caption" color="error" sx={{ mb: 1, display: 'block' }}>
            {error}
          </Typography>
        )}
        {renderCustomComponent(field, value, onChange)}
      </Box>
    );
  }

  // Try to use registry-based custom field
  const customFieldElement = renderCustomField({
    field,
    value,
    onChange,
    error,
    phaseData,
  });

  if (customFieldElement) {
    return <Box>{customFieldElement}</Box>;
  }

  // Default: show a message that this field type needs custom rendering
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary' }}>
          {config.label}
          {config.required && <span style={{ color: 'red' }}> *</span>}
        </Typography>
        {config.helpText && <HelpTooltip title={config.helpText} />}
      </Box>
      {error && (
        <Typography variant="caption" color="error" sx={{ mb: 1, display: 'block' }}>
          {error}
        </Typography>
      )}
      <Alert severity="info" sx={{ mt: 1 }}>
        Custom field type &quot;{field.field_key}&quot; is not yet implemented. 
        This field is configured in the template but needs a custom component.
      </Alert>
    </Box>
  );
};

export default React.memo(CustomField);

