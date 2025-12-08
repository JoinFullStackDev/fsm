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
import type { TestCase } from '@/types/phases';

interface TestCasesFieldProps {
  field: TemplateFieldConfig;
  value: TestCase[];
  onChange: (value: TestCase[]) => void;
  error?: string;
  phaseData?: Record<string, unknown>;
}

export default function TestCasesField({ field, value, onChange, error, phaseData }: TestCasesFieldProps) {
  const config = field.field_config;
  const testCases = Array.isArray(value) ? value : [];
  const aiEnabled = config.aiSettings?.enabled;

  const addTestCase = () => {
    const newTestCase: TestCase = {
      name: '',
      description: '',
      type: 'unit',
      steps: [],
      expected_result: '',
    };
    onChange([...testCases, newTestCase]);
  };

  const updateTestCase = (index: number, testCase: TestCase) => {
    const updated = [...testCases];
    updated[index] = testCase;
    onChange(updated);
  };

  const removeTestCase = (index: number) => {
    onChange(testCases.filter((_, i) => i !== index));
  };

  return (
    <Box sx={{ width: '100%' }}>
      {error && (
        <Typography variant="caption" color="error" sx={{ mb: 2, display: 'block' }}>
          {error}
        </Typography>
      )}
      <Grid container spacing={{ xs: 1, md: 2 }} sx={{ mb: 2 }}>
        {testCases.map((testCase, index) => (
          <Grid item xs={12} md={6} key={index}>
            <Card
              sx={{
                backgroundColor: 'background.paper',
                border: '1px solid',
                borderColor: 'primary.main',
                borderRadius: 2,
              }}
            >
              <CardContent sx={{ p: { xs: 1.5, md: 2 }, '&:last-child': { pb: { xs: 1.5, md: 2 } } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ color: 'primary.main', fontWeight: 600 }}>
                    {testCase.name || `Test Case ${index + 1}`}
                  </Typography>
                  <IconButton
                    onClick={() => removeTestCase(index)}
                    size="small"
                    sx={{ color: 'error.main' }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
                <Grid container spacing={1}>
                  <Grid item xs={12} sm={8}>
                    <TextField
                      fullWidth
                      label="Name"
                      value={testCase.name}
                      onChange={(e) => updateTestCase(index, { ...testCase, name: e.target.value })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Type</InputLabel>
                      <Select
                        value={testCase.type}
                        label="Type"
                        onChange={(e) => updateTestCase(index, { ...testCase, type: e.target.value as 'unit' | 'integration' | 'e2e' })}
                      >
                        <MenuItem value="unit">Unit</MenuItem>
                        <MenuItem value="integration">Integration</MenuItem>
                        <MenuItem value="e2e">E2E</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      label="Description"
                      value={testCase.description}
                      onChange={(e) => updateTestCase(index, { ...testCase, description: e.target.value })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      label="Steps (one per line)"
                      value={testCase.steps.join('\n')}
                      onChange={(e) => updateTestCase(index, { ...testCase, steps: e.target.value.split('\n').filter(s => s.trim()) })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      label="Expected Result"
                      value={testCase.expected_result}
                      onChange={(e) => updateTestCase(index, { ...testCase, expected_result: e.target.value })}
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
          onClick={addTestCase}
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
          Add Test Case
        </Button>
        {aiEnabled && (
          <AIAssistButton
            label="AI Generate Test Cases"
            onGenerate={async (additionalPrompt) => {
              const response = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  prompt: `${config.aiSettings?.customPrompt || 'Generate test cases based on user stories and flows'}. Return as JSON array of test case objects with name, description, type (unit/integration/e2e), steps (array), and expected_result. ${additionalPrompt || ''}`,
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
                  onChange([...testCases, ...generated]);
                }
              } catch {}
            }}
            context="AI will generate test cases based on your user stories and flows"
          />
        )}
      </Box>
    </Box>
  );
}

