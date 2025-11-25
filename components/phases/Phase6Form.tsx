'use client';

import { useState } from 'react';
import {
  TextField,
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  IconButton,
  Grid,
  Chip,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Add as AddIcon,
  Assignment as AssignmentIcon,
  CheckCircle as CheckCircleIcon,
  Security as SecurityIcon,
  Speed as SpeedIcon,
  RocketLaunch as RocketLaunchIcon,
} from '@mui/icons-material';
import AIAssistButton from '@/components/ai/AIAssistButton';
import InputModal from '@/components/ui/InputModal';
import HelpTooltip from '@/components/ui/HelpTooltip';
import type { Phase6Data, TestCase } from '@/types/phases';

interface Phase6FormProps {
  data: Phase6Data;
  onChange: (data: Phase6Data) => void;
}

export default function Phase6Form({ data, onChange }: Phase6FormProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalField, setModalField] = useState<'security_checklist' | 'launch_readiness' | null>(null);

  const updateField = <K extends keyof Phase6Data>(field: K, value: Phase6Data[K]) => {
    onChange({ ...data, [field]: value });
  };

  const addTestCase = () => {
    const newTestCase: TestCase = {
      name: '',
      description: '',
      type: 'unit',
      steps: [],
      expected_result: '',
    };
    updateField('test_cases', [...data.test_cases, newTestCase]);
  };

  const updateTestCase = (index: number, testCase: TestCase) => {
    const updated = [...data.test_cases];
    updated[index] = testCase;
    updateField('test_cases', updated);
  };

  const removeTestCase = (index: number) => {
    updateField('test_cases', data.test_cases.filter((_, i) => i !== index));
  };

  const handleOpenModal = (field: 'security_checklist' | 'launch_readiness') => {
    setModalField(field);
    setModalOpen(true);
  };

  const handleModalConfirm = (value: string) => {
    if (modalField) {
      updateField(modalField, [...data[modalField], value]);
    }
    setModalOpen(false);
    setModalField(null);
  };

  const addArrayItem = (field: 'security_checklist' | 'launch_readiness') => {
    handleOpenModal(field);
  };

  const removeArrayItem = (field: 'security_checklist' | 'launch_readiness', index: number) => {
    updateField(field, data[field].filter((_, i) => i !== index));
  };

  const SectionCard = ({
    title,
    icon,
    children,
    borderColor = '#00E5FF',
    fullWidth = false,
  }: {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    borderColor?: string;
    fullWidth?: boolean;
  }) => (
    <Card
      sx={{
        border: `2px solid ${borderColor}40`,
        borderLeft: `4px solid ${borderColor}`,
        backgroundColor: '#1A1F3A',
        height: '100%',
        transition: 'all 0.3s ease',
        '&:hover': {
          borderColor: `${borderColor}80`,
          boxShadow: `0 8px 32px ${borderColor}20`,
          transform: 'translateY(-2px)',
        },
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Box sx={{ color: borderColor }}>{icon}</Box>
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#E0E0E0' }}>
            {title}
          </Typography>
        </Box>
        {children}
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ p: 2 }}>
      <Grid container spacing={3}>
        {/* Test Plan - Full Width */}
        <Grid item xs={12}>
          <SectionCard
            title="Test Plan"
            icon={<AssignmentIcon />}
            borderColor="#00E5FF"
          >
            <TextField
              fullWidth
              multiline
              rows={10}
              label="Test Strategy"
              value={data.test_plan}
              onChange={(e) => updateField('test_plan', e.target.value)}
              placeholder="Test strategy (unit, integration, e2e)..."
            />
          </SectionCard>
        </Grid>

        {/* Test Cases - Full Width Grid */}
        <Grid item xs={12}>
          <SectionCard
            title="Test Cases"
            icon={<CheckCircleIcon />}
            borderColor="#00FF88"
          >
            <Grid container spacing={2} sx={{ mb: 2 }}>
              {data.test_cases.map((testCase, index) => (
                <Grid item xs={12} md={6} key={index}>
                  <Card
                    sx={{
                      backgroundColor: '#000',
                      border: '1px solid rgba(0, 255, 136, 0.3)',
                      borderRadius: 2,
                    }}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="subtitle2" sx={{ color: '#00FF88', fontWeight: 600 }}>
                          {testCase.name || `Test Case ${index + 1}`}
                        </Typography>
                        <IconButton
                          onClick={() => removeTestCase(index)}
                          size="small"
                          sx={{ color: '#FF1744' }}
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
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <Button
                startIcon={<AddIcon />}
                onClick={addTestCase}
                variant="outlined"
                sx={{
                  borderColor: '#00FF88',
                  color: '#00FF88',
                  '&:hover': {
                    borderColor: '#00FF88',
                    backgroundColor: 'rgba(0, 255, 136, 0.1)',
                  },
                }}
              >
                Add Test Case
              </Button>
              <AIAssistButton
                label="AI Generate Test Cases"
                onGenerate={async (additionalPrompt) => {
                  const response = await fetch('/api/ai/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      prompt: `Generate test cases based on user stories and flows. Return as JSON array of test case objects with name, description, type (unit/integration/e2e), steps (array), and expected_result. ${additionalPrompt || ''}`,
                      options: {
                        context: 'Generate test cases for QA phase.',
                        phaseData: data,
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
                    const testCases = JSON.parse(result);
                    if (Array.isArray(testCases)) {
                      updateField('test_cases', [...data.test_cases, ...testCases]);
                    }
                  } catch {}
                }}
                context="AI will generate test cases based on your user stories and flows"
              />
            </Box>
          </SectionCard>
        </Grid>

        {/* Security Checklist - Left Column */}
        <Grid item xs={12} md={6}>
          <SectionCard
            title="Security Checklist"
            icon={<SecurityIcon />}
            borderColor="#FF1744"
          >
            {data.security_checklist.map((item, index) => (
              <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <TextField
                  fullWidth
                  value={item}
                  onChange={(e) => {
                    const updated = [...data.security_checklist];
                    updated[index] = e.target.value;
                    updateField('security_checklist', updated);
                  }}
                  size="small"
                />
                <IconButton
                  onClick={() => removeArrayItem('security_checklist', index)}
                  size="small"
                  sx={{ color: '#FF1744' }}
                >
                  <DeleteIcon />
                </IconButton>
              </Box>
            ))}
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', mt: 2 }}>
              <Button
                startIcon={<AddIcon />}
                onClick={() => addArrayItem('security_checklist')}
                variant="outlined"
                size="small"
                sx={{
                  borderColor: '#FF1744',
                  color: '#FF1744',
                  '&:hover': {
                    borderColor: '#FF1744',
                    backgroundColor: 'rgba(255, 23, 68, 0.1)',
                  },
                }}
              >
                Add Item
              </Button>
              <AIAssistButton
                label="AI Security Checklist"
                onGenerate={async (additionalPrompt) => {
                  const response = await fetch('/api/ai/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      prompt: `Generate a security checklist based on the tech stack and features. Return as JSON array of checklist item strings. ${additionalPrompt || ''}`,
                      options: {
                        context: 'Generate security checklist for QA phase.',
                        phaseData: data,
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
                    const items = JSON.parse(result);
                    if (Array.isArray(items)) {
                      updateField('security_checklist', items);
                    }
                  } catch {}
                }}
                context="AI will generate a security checklist based on your tech stack and features"
              />
            </Box>
          </SectionCard>
        </Grid>

        {/* Performance Requirements - Right Column */}
        <Grid item xs={12} md={6}>
          <SectionCard
            title="Performance Requirements"
            icon={<SpeedIcon />}
            borderColor="#FF6B35"
          >
            <TextField
              fullWidth
              multiline
              rows={10}
              label="Performance Requirements"
              value={data.performance_requirements}
              onChange={(e) => updateField('performance_requirements', e.target.value)}
              placeholder="Response times, load expectations..."
            />
          </SectionCard>
        </Grid>

        {/* Launch Readiness - Full Width */}
        <Grid item xs={12}>
          <SectionCard
            title="Launch Readiness Checklist"
            icon={<RocketLaunchIcon />}
            borderColor="#E91E63"
          >
            {data.launch_readiness.map((item, index) => (
              <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <TextField
                  fullWidth
                  value={item}
                  onChange={(e) => {
                    const updated = [...data.launch_readiness];
                    updated[index] = e.target.value;
                    updateField('launch_readiness', updated);
                  }}
                  size="small"
                />
                <IconButton
                  onClick={() => removeArrayItem('launch_readiness', index)}
                  size="small"
                  sx={{ color: '#FF1744' }}
                >
                  <DeleteIcon />
                </IconButton>
              </Box>
            ))}
            <Button
              startIcon={<AddIcon />}
              onClick={() => addArrayItem('launch_readiness')}
              variant="outlined"
              sx={{
                borderColor: '#E91E63',
                color: '#E91E63',
                '&:hover': {
                  borderColor: '#E91E63',
                  backgroundColor: 'rgba(233, 30, 99, 0.1)',
                },
              }}
            >
              Add Launch Readiness Item
            </Button>
          </SectionCard>
        </Grid>
      </Grid>

      {/* Master Prompt Section */}
      <Card
        sx={{
          borderLeft: '4px solid',
          borderLeftColor: 'secondary.main',
          backgroundColor: 'rgba(233, 30, 99, 0.05)',
          mt: 3,
        }}
      >
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, color: 'secondary.main' }}>
              Master Prompt (Optional)
            </Typography>
            <HelpTooltip title="Customize how AI generates the phase summary. Use {{phase_data}} placeholder to inject phase data. If not provided, uses default summary format." />
          </Box>
          <TextField
            fullWidth
            multiline
            rows={6}
            label="Master Prompt"
            value={data.master_prompt || ''}
            onChange={(e) => updateField('master_prompt', e.target.value)}
            placeholder="Enter a custom prompt for AI summary generation. Use {{phase_data}} to include phase data..."
            variant="outlined"
            helperText="Use {{phase_data}} placeholder to inject phase data into your prompt. Leave empty to use default summary format."
          />
        </CardContent>
      </Card>

      <InputModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setModalField(null);
        }}
        onConfirm={handleModalConfirm}
        title="Add New Item"
        label={modalField === 'security_checklist' ? 'Security Checklist Item' : modalField === 'launch_readiness' ? 'Launch Readiness Item' : 'Item'}
        placeholder={`Enter ${modalField === 'security_checklist' ? 'security checklist item' : modalField === 'launch_readiness' ? 'launch readiness item' : 'item'}...`}
      />
    </Box>
  );
}
