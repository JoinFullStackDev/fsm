'use client';
import type { PhaseDataUnion } from '@/types/phases';

import {
  Box,
  TextField,
  Button,
  Card,
  CardContent,
  IconButton,
  Grid,
  Typography,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import AIAssistButton from '@/components/ai/AIAssistButton';
import type { TemplateFieldConfig } from '@/types/templates';
import type { APISpec } from '@/types/phases';

interface APISpecFieldProps {
  field: TemplateFieldConfig;
  value: APISpec[];
  onChange: (value: APISpec[]) => void;
  error?: string;
  phaseData?: Record<string, unknown>;
}

export default function APISpecField({ field, value, onChange, error, phaseData }: APISpecFieldProps) {
  const config = field.field_config;
  const apiSpecs = Array.isArray(value) ? value : [];
  const aiEnabled = config.aiSettings?.enabled;

  const addAPISpec = () => {
    const newAPISpec: APISpec = {
      endpoint: '',
      method: 'GET',
      path: '',
      description: '',
      request_params: {},
      body_schema: {},
      response_schema: {},
      error_codes: [],
    };
    onChange([...apiSpecs, newAPISpec]);
  };

  const updateAPISpec = (index: number, spec: APISpec) => {
    const updated = [...apiSpecs];
    updated[index] = spec;
    onChange(updated);
  };

  const removeAPISpec = (index: number) => {
    onChange(apiSpecs.filter((_, i) => i !== index));
  };

  return (
    <Box sx={{ width: '100%' }}>
      {error && (
        <Typography variant="caption" color="error" sx={{ mb: 2, display: 'block' }}>
          {error}
        </Typography>
      )}
      <Grid container spacing={{ xs: 1, md: 2 }} sx={{ mb: 2 }}>
        {apiSpecs.map((spec, index) => (
          <Grid item xs={12} key={index}>
            <Card
              sx={{
                backgroundColor: 'background.paper',
                border: '1px solid',
                borderColor: 'primary.main',
                borderRadius: 2,
              }}
            >
              <CardContent sx={{ p: { xs: 1.5, md: 2 }, '&:last-child': { pb: { xs: 1.5, md: 2 } } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ color: 'primary.main', fontWeight: 600 }}>
                    {spec.endpoint || `API ${index + 1}`}
                  </Typography>
                  <IconButton
                    onClick={() => removeAPISpec(index)}
                    size="small"
                    sx={{ color: 'error.main' }}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
                <Grid container spacing={{ xs: 1, md: 2 }}>
                  <Grid item xs={12} md={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Method</InputLabel>
                      <Select
                        value={spec.method}
                        label="Method"
                        onChange={(e) => updateAPISpec(index, { ...spec, method: e.target.value as any })}
                      >
                        <MenuItem value="GET">GET</MenuItem>
                        <MenuItem value="POST">POST</MenuItem>
                        <MenuItem value="PUT">PUT</MenuItem>
                        <MenuItem value="PATCH">PATCH</MenuItem>
                        <MenuItem value="DELETE">DELETE</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={9}>
                    <TextField
                      fullWidth
                      label="Endpoint"
                      value={spec.endpoint}
                      onChange={(e) => updateAPISpec(index, { ...spec, endpoint: e.target.value })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Path"
                      value={spec.path}
                      onChange={(e) => updateAPISpec(index, { ...spec, path: e.target.value })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      label="Description"
                      value={spec.description}
                      onChange={(e) => updateAPISpec(index, { ...spec, description: e.target.value })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      multiline
                      rows={3}
                      label="Request Params (JSON)"
                      value={JSON.stringify(spec.request_params, null, 2)}
                      onChange={(e) => {
                        try {
                          const params = JSON.parse(e.target.value);
                          updateAPISpec(index, { ...spec, request_params: params });
                        } catch {}
                      }}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      multiline
                      rows={3}
                      label="Body Schema (JSON)"
                      value={JSON.stringify(spec.body_schema, null, 2)}
                      onChange={(e) => {
                        try {
                          const schema = JSON.parse(e.target.value);
                          updateAPISpec(index, { ...spec, body_schema: schema });
                        } catch {}
                      }}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      multiline
                      rows={3}
                      label="Response Schema (JSON)"
                      value={JSON.stringify(spec.response_schema, null, 2)}
                      onChange={(e) => {
                        try {
                          const schema = JSON.parse(e.target.value);
                          updateAPISpec(index, { ...spec, response_schema: schema });
                        } catch {}
                      }}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Error Codes (comma-separated)"
                      value={spec.error_codes.join(', ')}
                      onChange={(e) => updateAPISpec(index, { ...spec, error_codes: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                      size="small"
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mt: '1.5rem' }}>
        <Button
          startIcon={<AddIcon />}
          onClick={addAPISpec}
          variant="outlined"
          sx={{
            borderColor: 'primary.main',
            color: 'primary.main',
            '&:hover': {
              borderColor: 'primary.light',
              backgroundColor: 'rgba(0, 229, 255, 0.1)',
            },
          }}
        >
          Add API Spec
        </Button>
        {aiEnabled && (
          <AIAssistButton
            label="AI Suggest APIs"
            onGenerate={async (additionalPrompt) => {
              const response = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  prompt: `${config.aiSettings?.customPrompt || 'Suggest REST API endpoints based on entities and user stories'}. Return as JSON array of API spec objects with endpoint, method, path, description, request_params (object), body_schema (object), response_schema (object), and error_codes (array). ${additionalPrompt || ''}`,
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
                  structured: true,
                }),
              });
              const json = await response.json();
              if (!response.ok) throw new Error(json.error);
              return JSON.stringify(json.result, null, 2);
            }}
            onAccept={(result) => {
              try {
                const generated = JSON.parse(result);
                if (Array.isArray(generated)) {
                  onChange([...apiSpecs, ...generated]);
                }
              } catch {}
            }}
            context="AI will suggest API endpoints based on your entities and user stories"
          />
        )}
      </Box>
    </Box>
  );
}

