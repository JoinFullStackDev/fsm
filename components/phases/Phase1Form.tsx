'use client';

import { useState } from 'react';
import {
  TextField,
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  Grid,
  InputAdornment,
  Paper,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Add as AddIcon,
  Lightbulb as LightbulbIcon,
  People as PeopleIcon,
  Schedule as ScheduleIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Extension as ExtensionIcon,
} from '@mui/icons-material';
import AIAssistButton from '@/components/ai/AIAssistButton';
import InputModal from '@/components/ui/InputModal';
import HelpTooltip from '@/components/ui/HelpTooltip';
import type { Phase1Data } from '@/types/phases';

interface Phase1FormProps {
  data: Phase1Data;
  onChange: (data: Phase1Data) => void;
}

export default function Phase1Form({ data, onChange }: Phase1FormProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalField, setModalField] = useState<'target_users' | 'constraints' | 'risks' | 'assumptions' | 'initial_features' | null>(null);

  const updateField = <K extends keyof Phase1Data>(field: K, value: Phase1Data[K]) => {
    onChange({ ...data, [field]: value });
  };

  const handleOpenModal = (field: 'target_users' | 'constraints' | 'risks' | 'assumptions' | 'initial_features') => {
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

  const addArrayItem = (field: 'target_users' | 'constraints' | 'risks' | 'assumptions' | 'initial_features') => {
    handleOpenModal(field);
  };

  const removeArrayItem = (
    field: 'target_users' | 'constraints' | 'risks' | 'assumptions' | 'initial_features',
    index: number
  ) => {
    updateField(field, data[field].filter((_, i) => i !== index));
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Problem Statement - Full Width Card with Cyan Border */}
      <Card
        sx={{
          borderLeft: '4px solid',
          borderLeftColor: 'primary.main',
          backgroundColor: 'rgba(0, 229, 255, 0.05)',
        }}
      >
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <LightbulbIcon sx={{ color: 'primary.main', fontSize: 28 }} />
            <Typography variant="h5" sx={{ fontWeight: 600, color: 'primary.main' }}>
              Problem Statement
            </Typography>
            <HelpTooltip title="Clearly define the problem your product solves. Be specific about pain points, who experiences them, and why existing solutions fall short." />
          </Box>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
            <TextField
              fullWidth
              multiline
              rows={5}
              label="Problem Statement"
              value={data.problem_statement}
              onChange={(e) => updateField('problem_statement', e.target.value)}
              placeholder="Describe the problem this product solves..."
              variant="outlined"
              sx={{ flex: 1 }}
            />
            <AIAssistButton
              label="AI Generate"
              onGenerate={async (additionalPrompt) => {
                const response = await fetch('/api/ai/generate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    prompt: `Generate a clear, concise problem statement for a product. ${additionalPrompt || ''}`,
                    options: {
                      context: 'You are helping define a product concept. Generate a problem statement that clearly articulates the problem this product will solve.',
                      phaseData: data,
                    },
                  }),
                });
                const json = await response.json();
                if (!response.ok) throw new Error(json.error);
                return json.result;
              }}
              onAccept={(result) => updateField('problem_statement', result)}
              context="AI will generate a problem statement based on your input"
            />
          </Box>
        </CardContent>
      </Card>

      {/* Target Users - Card with Purple Accent */}
      <Card
        sx={{
          borderLeft: '4px solid',
          borderLeftColor: 'secondary.main',
          backgroundColor: 'rgba(233, 30, 99, 0.05)',
        }}
      >
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <PeopleIcon sx={{ color: 'secondary.main', fontSize: 28 }} />
            <Typography variant="h5" sx={{ fontWeight: 600, color: 'secondary.main' }}>
              Target Users
            </Typography>
            <HelpTooltip title="Identify the primary user segments who will benefit from your product. Be specific about demographics, behaviors, or characteristics that define each segment." />
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
            {data.target_users.map((user, index) => (
              <Chip
                key={index}
                label={user}
                onDelete={() => removeArrayItem('target_users', index)}
                sx={{
                  backgroundColor: 'rgba(233, 30, 99, 0.2)',
                  color: 'secondary.light',
                  border: '1px solid',
                  borderColor: 'secondary.main',
                  fontSize: '0.9rem',
                  height: 32,
                  '&:hover': {
                    backgroundColor: 'rgba(233, 30, 99, 0.3)',
                  },
                }}
              />
            ))}
          </Box>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Button
              startIcon={<AddIcon />}
              onClick={() => addArrayItem('target_users')}
              variant="outlined"
              sx={{
                borderColor: 'secondary.main',
                color: 'secondary.main',
                '&:hover': {
                  borderColor: 'secondary.light',
                  backgroundColor: 'rgba(233, 30, 99, 0.1)',
                },
              }}
            >
              Add Target User
            </Button>
            <AIAssistButton
              label="AI Suggest Users"
              onGenerate={async (additionalPrompt) => {
                const response = await fetch('/api/ai/generate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    prompt: `Based on this problem statement: "${data.problem_statement}", suggest target user segments. Return as a JSON array of strings. ${additionalPrompt || ''}`,
                    options: {
                      context: 'Generate target user segments for this product concept.',
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
                  const users = JSON.parse(result);
                  if (Array.isArray(users)) {
                    updateField('target_users', users);
                  }
                } catch {
                  updateField('target_users', [result]);
                }
              }}
              context="AI will suggest target user segments based on your problem statement"
            />
          </Box>
        </CardContent>
      </Card>

      {/* Why Now - Card with Orange Accent */}
      <Card
        sx={{
          borderLeft: '4px solid',
          borderLeftColor: 'warning.main',
          backgroundColor: 'rgba(255, 107, 53, 0.05)',
        }}
      >
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <ScheduleIcon sx={{ color: 'warning.main', fontSize: 28 }} />
            <Typography variant="h5" sx={{ fontWeight: 600, color: 'warning.main' }}>
              Why Now / Market Timing
            </Typography>
            <HelpTooltip title="Explain why this is the right time to build this product. Consider market conditions, technology readiness, regulatory changes, or competitive landscape shifts." />
          </Box>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Why Now / Market Timing"
            value={data.why_now}
            onChange={(e) => updateField('why_now', e.target.value)}
            placeholder="Why is now the right time for this product? Market conditions, technology readiness, etc."
            variant="outlined"
          />
        </CardContent>
      </Card>

      {/* Value Hypothesis - Card with Cyan Accent */}
      <Card
        sx={{
          borderLeft: '4px solid',
          borderLeftColor: 'primary.main',
          backgroundColor: 'rgba(0, 229, 255, 0.05)',
        }}
      >
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <CheckCircleIcon sx={{ color: 'primary.main', fontSize: 28 }} />
            <Typography variant="h5" sx={{ fontWeight: 600, color: 'primary.main' }}>
              Value Hypothesis
            </Typography>
            <HelpTooltip title="Describe the core value your product provides. What makes it unique? How will it improve users' lives or solve their problems better than alternatives?" />
          </Box>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Value Hypothesis"
            value={data.value_hypothesis}
            onChange={(e) => updateField('value_hypothesis', e.target.value)}
            placeholder="What value does this product provide?"
            variant="outlined"
          />
        </CardContent>
      </Card>

      {/* RAC Sections - Side by Side Grid */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card
            sx={{
              borderLeft: '4px solid',
              borderLeftColor: 'error.main',
              backgroundColor: 'rgba(255, 23, 68, 0.05)',
              height: '100%',
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <WarningIcon sx={{ color: 'error.main', fontSize: 24 }} />
                <Typography variant="h6" sx={{ fontWeight: 600, color: 'error.main' }}>
                  Risks
                </Typography>
                <HelpTooltip title="Identify potential risks that could derail the project: technical challenges, market risks, resource constraints, or competitive threats." />
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2, minHeight: 60 }}>
                {data.risks.map((risk, index) => (
                  <Chip
                    key={index}
                    label={risk}
                    onDelete={() => removeArrayItem('risks', index)}
                    size="small"
                    sx={{
                      backgroundColor: 'rgba(255, 23, 68, 0.2)',
                      color: 'error.light',
                      border: '1px solid',
                      borderColor: 'error.main',
                    }}
                  />
                ))}
              </Box>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <Button
                  startIcon={<AddIcon />}
                  onClick={() => addArrayItem('risks')}
                  variant="outlined"
                  size="small"
                  sx={{
                    borderColor: 'error.main',
                    color: 'error.main',
                    '&:hover': {
                      borderColor: 'error.light',
                      backgroundColor: 'rgba(255, 23, 68, 0.1)',
                    },
                  }}
                >
                  Add Risk
                </Button>
                <AIAssistButton
                  label="AI Identify"
                  onGenerate={async (additionalPrompt) => {
                    const response = await fetch('/api/ai/generate', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        prompt: `Based on this problem statement and constraints, identify potential risks. Return as a JSON array of risk strings. ${additionalPrompt || ''}`,
                        options: {
                          context: 'Identify risks for concept framing phase.',
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
                      const risks = JSON.parse(result);
                      if (Array.isArray(risks)) {
                        updateField('risks', risks);
                      }
                    } catch {}
                  }}
                  context="AI will identify potential risks based on your problem and constraints"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card
            sx={{
              borderLeft: '4px solid',
              borderLeftColor: 'info.main',
              backgroundColor: 'rgba(33, 150, 243, 0.05)',
              height: '100%',
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <WarningIcon sx={{ color: 'info.main', fontSize: 24 }} />
                <Typography variant="h6" sx={{ fontWeight: 600, color: 'info.main' }}>
                  Assumptions
                </Typography>
                <HelpTooltip title="List key assumptions you're making about users, market, technology, or business model. These should be validated through research or early testing." />
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2, minHeight: 60 }}>
                {data.assumptions.map((assumption, index) => (
                  <Chip
                    key={index}
                    label={assumption}
                    onDelete={() => removeArrayItem('assumptions', index)}
                    size="small"
                    sx={{
                      backgroundColor: 'rgba(33, 150, 243, 0.2)',
                      color: 'info.light',
                      border: '1px solid',
                      borderColor: 'info.main',
                    }}
                  />
                ))}
              </Box>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <Button
                  startIcon={<AddIcon />}
                  onClick={() => addArrayItem('assumptions')}
                  variant="outlined"
                  size="small"
                  sx={{
                    borderColor: 'info.main',
                    color: 'info.main',
                    '&:hover': {
                      borderColor: 'info.light',
                      backgroundColor: 'rgba(33, 150, 243, 0.1)',
                    },
                  }}
                >
                  Add Assumption
                </Button>
                <AIAssistButton
                  label="AI Identify"
                  onGenerate={async (additionalPrompt) => {
                    const response = await fetch('/api/ai/generate', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        prompt: `Based on this problem statement and value hypothesis, identify key assumptions. Return as a JSON array of assumption strings. ${additionalPrompt || ''}`,
                        options: {
                          context: 'Identify assumptions for concept framing phase.',
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
                      const assumptions = JSON.parse(result);
                      if (Array.isArray(assumptions)) {
                        updateField('assumptions', assumptions);
                      }
                    } catch {}
                  }}
                  context="AI will identify key assumptions based on your problem and value hypothesis"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card
            sx={{
              borderLeft: '4px solid',
              borderLeftColor: 'warning.main',
              backgroundColor: 'rgba(255, 107, 53, 0.05)',
              height: '100%',
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <WarningIcon sx={{ color: 'warning.main', fontSize: 24 }} />
                <Typography variant="h6" sx={{ fontWeight: 600, color: 'warning.main' }}>
                  Constraints
                </Typography>
                <HelpTooltip title="Document limitations: budget, timeline, technical constraints, regulatory requirements, or dependencies that will shape your solution." />
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2, minHeight: 60 }}>
                {data.constraints.map((constraint, index) => (
                  <Chip
                    key={index}
                    label={constraint}
                    onDelete={() => removeArrayItem('constraints', index)}
                    size="small"
                    sx={{
                      backgroundColor: 'rgba(255, 107, 53, 0.2)',
                      color: 'warning.light',
                      border: '1px solid',
                      borderColor: 'warning.main',
                    }}
                  />
                ))}
              </Box>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <Button
                  startIcon={<AddIcon />}
                  onClick={() => addArrayItem('constraints')}
                  variant="outlined"
                  size="small"
                  sx={{
                    borderColor: 'warning.main',
                    color: 'warning.main',
                    '&:hover': {
                      borderColor: 'warning.light',
                      backgroundColor: 'rgba(255, 107, 53, 0.1)',
                    },
                  }}
                >
                  Add Constraint
                </Button>
                <AIAssistButton
                  label="AI Identify"
                  onGenerate={async (additionalPrompt) => {
                    const response = await fetch('/api/ai/generate', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        prompt: `Based on this problem statement and risks, identify potential constraints (technical, business, regulatory, etc.). Return as a JSON array of constraint strings. ${additionalPrompt || ''}`,
                        options: {
                          context: 'Identify constraints for concept framing phase.',
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
                      const constraints = JSON.parse(result);
                      if (Array.isArray(constraints)) {
                        updateField('constraints', constraints);
                      }
                    } catch {}
                  }}
                  context="AI will identify potential constraints based on your problem and risks"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Initial Features - Card with Green Accent */}
      <Card
        sx={{
          borderLeft: '4px solid',
          borderLeftColor: 'success.main',
          backgroundColor: 'rgba(0, 255, 136, 0.05)',
        }}
      >
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <ExtensionIcon sx={{ color: 'success.main', fontSize: 28 }} />
            <Typography variant="h5" sx={{ fontWeight: 600, color: 'success.main' }}>
              Initial Features
            </Typography>
            <HelpTooltip title="List the core features needed for your MVP. Focus on features that directly address the problem statement and provide value to target users." />
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
            {data.initial_features.map((feature, index) => (
              <Chip
                key={index}
                label={feature}
                onDelete={() => removeArrayItem('initial_features', index)}
                sx={{
                  backgroundColor: 'rgba(0, 255, 136, 0.2)',
                  color: 'success.light',
                  border: '1px solid',
                  borderColor: 'success.main',
                  fontSize: '0.9rem',
                  height: 32,
                  '&:hover': {
                    backgroundColor: 'rgba(0, 255, 136, 0.3)',
                  },
                }}
              />
            ))}
          </Box>
          <Button
            startIcon={<AddIcon />}
            onClick={() => addArrayItem('initial_features')}
            variant="outlined"
            sx={{
              borderColor: 'success.main',
              color: 'success.main',
              '&:hover': {
                borderColor: 'success.light',
                backgroundColor: 'rgba(0, 255, 136, 0.1)',
              },
            }}
          >
            Add Feature
          </Button>
        </CardContent>
      </Card>

      {/* Feasibility & Timeline - Side by Side */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card
            sx={{
              borderLeft: '4px solid',
              borderLeftColor: 'primary.main',
              backgroundColor: 'rgba(0, 229, 255, 0.05)',
              height: '100%',
            }}
          >
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, color: 'primary.main', mb: 2 }}>
                Feasibility Notes
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={6}
                label="Feasibility Notes"
                value={data.feasibility_notes}
                onChange={(e) => updateField('feasibility_notes', e.target.value)}
                placeholder="Very rough technical feasibility notes..."
                variant="outlined"
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card
            sx={{
              borderLeft: '4px solid',
              borderLeftColor: 'warning.main',
              backgroundColor: 'rgba(255, 107, 53, 0.05)',
              height: '100%',
            }}
          >
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, color: 'warning.main', mb: 2 }}>
                High-Level Timeline
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={6}
                label="High-Level Timeline"
                value={data.high_level_timeline}
                onChange={(e) => updateField('high_level_timeline', e.target.value)}
                placeholder="Very rough timeline expectations..."
                variant="outlined"
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Master Prompt Section */}
      <Card
        sx={{
          borderLeft: '4px solid',
          borderLeftColor: 'secondary.main',
          backgroundColor: 'rgba(233, 30, 99, 0.05)',
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
        label={modalField === 'target_users' ? 'Target User' : modalField === 'constraints' ? 'Constraint' : modalField === 'risks' ? 'Risk' : modalField === 'assumptions' ? 'Assumption' : modalField === 'initial_features' ? 'Feature' : 'Item'}
        placeholder={`Enter ${modalField === 'target_users' ? 'target user' : modalField === 'constraints' ? 'constraint' : modalField === 'risks' ? 'risk' : modalField === 'assumptions' ? 'assumption' : modalField === 'initial_features' ? 'feature' : 'item'}...`}
      />
    </Box>
  );
}
