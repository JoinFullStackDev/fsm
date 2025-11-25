'use client';

import React from 'react';
import { TextField, Box } from '@mui/material';
import AIAssistButton from '@/components/ai/AIAssistButton';
import type { TemplateFieldConfig } from '@/types/templates';

interface TextareaFieldProps {
  field: TemplateFieldConfig;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  phaseData?: any;
}

function TextareaField({ field, value, onChange, error, phaseData }: TextareaFieldProps) {
  const config = field.field_config;
  const aiEnabled = config.aiSettings?.enabled;

  return (
    <Box sx={{ width: '100%' }}>
      <TextField
        fullWidth
        multiline
        rows={field.field_type === 'textarea' ? 5 : 3}
        label={config.label}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={config.placeholder}
        required={config.required}
        error={!!error}
        helperText={error}
        size="small"
        sx={{
          '& .MuiInputBase-input': {
            color: 'text.primary',
          },
          '& .MuiInputLabel-root': {
            fontSize: '0.875rem',
          },
        }}
      />
      {aiEnabled && (
        <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'flex-start' }}>
          <AIAssistButton
            label="AI Generate"
            onGenerate={async (additionalPrompt) => {
              const response = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  prompt: `${config.aiSettings?.customPrompt || `Generate ${config.label.toLowerCase()}`}. ${additionalPrompt || ''}`,
                  options: {
                    context: config.aiSettings?.contextFields
                      ? `Context from other fields: ${JSON.stringify(
                          config.aiSettings.contextFields.reduce((acc, key) => {
                            acc[key] = phaseData?.[key];
                            return acc;
                          }, {} as Record<string, any>)
                        )}`
                      : undefined,
                    phaseData: phaseData,
                  },
                }),
              });
              const json = await response.json();
              if (!response.ok) throw new Error(json.error);
              return json.result;
            }}
            onAccept={(result) => onChange(result)}
            context={`AI will generate ${config.label.toLowerCase()} based on your input`}
          />
        </Box>
      )}
    </Box>
  );
}

export default React.memo(TextareaField);

