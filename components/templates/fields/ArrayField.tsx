'use client';

import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Chip,
  IconButton,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import AIAssistButton from '@/components/ai/AIAssistButton';
import InputModal from '@/components/ui/InputModal';
import HelpTooltip from '@/components/ui/HelpTooltip';
import type { TemplateFieldConfig } from '@/types/templates';

interface ArrayFieldProps {
  field: TemplateFieldConfig;
  value: string[];
  onChange: (value: string[]) => void;
  error?: string;
  phaseData?: any;
}

function ArrayField({ field, value, onChange, error, phaseData }: ArrayFieldProps) {
  const config = field.field_config;
  const aiEnabled = config.aiSettings?.enabled;
  const [modalOpen, setModalOpen] = useState(false);

  const addItem = (item: string) => {
    const currentValue = Array.isArray(value) ? value : [];
    onChange([...currentValue, item]);
  };

  const removeItem = (index: number) => {
    const currentValue = Array.isArray(value) ? value : [];
    onChange(currentValue.filter((_, i) => i !== index));
  };

  return (
    <Box sx={{ width: '100%' }}>
      {error && (
        <Typography variant="caption" color="error" sx={{ mb: 1, display: 'block' }}>
          {error}
        </Typography>
      )}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
        {(Array.isArray(value) ? value : []).map((item, index) => (
          <Chip
            key={index}
            label={item}
            onDelete={() => removeItem(index)}
            deleteIcon={<DeleteIcon />}
            sx={{
              backgroundColor: 'rgba(0, 229, 255, 0.1)',
              color: 'text.primary',
              border: '1px solid',
              borderColor: 'primary.main',
            }}
          />
        ))}
      </Box>
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mt: '1.5rem' }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => setModalOpen(true)}
          sx={{
            borderColor: 'primary.main',
            color: 'primary.main',
            '&:hover': {
              borderColor: 'primary.light',
              backgroundColor: 'rgba(0, 229, 255, 0.1)',
            },
          }}
        >
          Add {config.label}
        </Button>
        {aiEnabled && (
          <AIAssistButton
            label="AI Generate"
            onGenerate={async (additionalPrompt) => {
              const response = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  prompt: `${config.aiSettings?.customPrompt || `Generate a list of ${config.label.toLowerCase()}`}. ${additionalPrompt || ''}`,
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
              // Parse array from response (could be JSON array or newline-separated)
              try {
                const parsed = JSON.parse(json.result);
                return Array.isArray(parsed) ? parsed : [json.result];
              } catch {
                return json.result.split('\n').filter(Boolean);
              }
            }}
            onAccept={(result) => {
              const items = Array.isArray(result) ? result : [result];
              const currentValue = Array.isArray(value) ? value : [];
              onChange([...currentValue, ...items]);
            }}
            context={`AI will generate ${config.label.toLowerCase()} based on your input`}
          />
        )}
      </Box>
      <InputModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={addItem}
        title={`Add ${config.label}`}
        label={config.label}
        placeholder={config.placeholder || `Enter ${config.label.toLowerCase()}...`}
      />
    </Box>
  );
}

export default React.memo(ArrayField);

