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
  Grid,
  IconButton,
  Chip,
  Slider,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Add as AddIcon,
  Person as PersonIcon,
  Work as WorkIcon,
  TrendingUp as TrendingUpIcon,
  Assessment as AssessmentIcon,
  Build as BuildIcon,
} from '@mui/icons-material';
import AIAssistButton from '@/components/ai/AIAssistButton';
import InputModal from '@/components/ui/InputModal';
import HelpTooltip from '@/components/ui/HelpTooltip';
import type { Phase2Data, Persona, JTBD, Feature, ScoredFeature } from '@/types/phases';

interface Phase2FormProps {
  data: Phase2Data;
  onChange: (data: Phase2Data) => void;
}

export default function Phase2Form({ data, onChange }: Phase2FormProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalField, setModalField] = useState<'business_outcomes' | 'kpis' | null>(null);

  const updateField = <K extends keyof Phase2Data>(field: K, value: Phase2Data[K]) => {
    onChange({ ...data, [field]: value });
  };

  const addPersona = () => {
    const newPersona: Persona = {
      name: '',
      description: '',
      goals: [],
      pains: [],
    };
    updateField('personas', [...data.personas, newPersona]);
  };

  const updatePersona = (index: number, persona: Persona) => {
    const updated = [...data.personas];
    updated[index] = persona;
    updateField('personas', updated);
  };

  const removePersona = (index: number) => {
    updateField('personas', data.personas.filter((_, i) => i !== index));
  };

  const addJTBD = () => {
    const newJTBD: JTBD = {
      statement: '',
      persona: '',
      outcome: '',
    };
    updateField('jtbd', [...data.jtbd, newJTBD]);
  };

  const updateJTBD = (index: number, jtbd: JTBD) => {
    const updated = [...data.jtbd];
    updated[index] = jtbd;
    updateField('jtbd', updated);
  };

  const removeJTBD = (index: number) => {
    updateField('jtbd', data.jtbd.filter((_, i) => i !== index));
  };

  const addFeature = () => {
    const newFeature: Feature = {
      title: '',
      description: '',
      target_persona: '',
      target_outcome: '',
    };
    updateField('features', [...data.features, newFeature]);
  };

  const updateFeature = (index: number, feature: Feature) => {
    const updated = [...data.features];
    updated[index] = feature;
    updateField('features', updated);
  };

  const removeFeature = (index: number) => {
    updateField('features', data.features.filter((_, i) => i !== index));
  };

  const addScoredFeature = () => {
    const newScoredFeature: ScoredFeature = {
      title: '',
      description: '',
      target_persona: '',
      target_outcome: '',
      impact: 0,
      effort: 0,
      confidence: 0,
      mvp_group: 'mvp',
    };
    updateField('scored_features', [...data.scored_features, newScoredFeature]);
  };

  const updateScoredFeature = (index: number, feature: ScoredFeature) => {
    const updated = [...data.scored_features];
    updated[index] = feature;
    updateField('scored_features', updated);
  };

  const removeScoredFeature = (index: number) => {
    updateField('scored_features', data.scored_features.filter((_, i) => i !== index));
  };

  const handleOpenModal = (field: 'business_outcomes' | 'kpis') => {
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

  const addArrayItem = (field: 'business_outcomes' | 'kpis') => {
    handleOpenModal(field);
  };

  const removeArrayItem = (field: 'business_outcomes' | 'kpis', index: number) => {
    updateField(field, data[field].filter((_, i) => i !== index));
  };

  const SectionCard = ({
    title,
    icon,
    children,
    borderColor = '#00E5FF',
    fullWidth = false,
    helpText,
  }: {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    borderColor?: string;
    fullWidth?: boolean;
    helpText?: string;
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
          {helpText && <HelpTooltip title={helpText} />}
        </Box>
        {children}
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ p: 2 }}>
      <Grid container spacing={3}>
        {/* Personas - Full Width Grid */}
        <Grid item xs={12}>
          <SectionCard
            title="Personas"
            icon={<PersonIcon />}
            borderColor="#E91E63"
            fullWidth
            helpText="Create detailed user personas representing your target users. Include their goals, pain points, behaviors, and motivations. These personas will guide product decisions throughout development."
          >
            <Grid container spacing={2} sx={{ mb: 2 }}>
              {data.personas.map((persona, index) => (
                <Grid item xs={12} md={6} key={index}>
                  <Card
                    sx={{
                      backgroundColor: '#121633',
                      border: '1px solid rgba(233, 30, 99, 0.3)',
                      borderRadius: 2,
                    }}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                        <Typography variant="subtitle1" sx={{ color: '#E91E63', fontWeight: 600 }}>
                          Persona {index + 1}
                        </Typography>
                        <IconButton
                          onClick={() => removePersona(index)}
                          size="small"
                          sx={{ color: '#FF1744' }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                      <TextField
                        fullWidth
                        label="Name"
                        value={persona.name}
                        onChange={(e) => updatePersona(index, { ...persona, name: e.target.value })}
                        margin="normal"
                        size="small"
                      />
                      <TextField
                        fullWidth
                        multiline
                        rows={3}
                        label="Description"
                        value={persona.description}
                        onChange={(e) => updatePersona(index, { ...persona, description: e.target.value })}
                        margin="normal"
                        size="small"
                      />
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <Button
                startIcon={<AddIcon />}
                onClick={addPersona}
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
                Add Persona
              </Button>
              <AIAssistButton
                label="AI Generate Personas"
                onGenerate={async (additionalPrompt) => {
                  const response = await fetch('/api/ai/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      prompt: `Generate detailed personas. Return as JSON array of persona objects with name, description, goals (array), and pains (array). ${additionalPrompt || ''}`,
                      options: {
                        context: 'Generate user personas for product strategy.',
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
                    const personas = JSON.parse(result);
                    if (Array.isArray(personas)) {
                      updateField('personas', [...data.personas, ...personas]);
                    }
                  } catch {}
                }}
                context="AI will generate personas based on your target users"
              />
            </Box>
          </SectionCard>
        </Grid>

        {/* JTBD - Full Width */}
        <Grid item xs={12}>
          <SectionCard
            title="Jobs To Be Done (JTBD)"
            icon={<WorkIcon />}
            borderColor="#00E5FF"
            helpText="Define the functional, emotional, and social jobs users are trying to accomplish. Each JTBD should link to a persona and describe the desired outcome."
          >
            <Grid container spacing={2} sx={{ mb: 2 }}>
              {data.jtbd.map((jtbd, index) => (
                <Grid item xs={12} md={4} key={index}>
                  <Card
                    sx={{
                      backgroundColor: '#121633',
                      border: '1px solid rgba(0, 229, 255, 0.3)',
                      borderRadius: 2,
                    }}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="caption" sx={{ color: '#00E5FF' }}>
                          JTBD {index + 1}
                        </Typography>
                        <IconButton
                          onClick={() => removeJTBD(index)}
                          size="small"
                          sx={{ color: '#FF1744' }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                      <TextField
                        fullWidth
                        label="Statement"
                        value={jtbd.statement}
                        onChange={(e) => updateJTBD(index, { ...jtbd, statement: e.target.value })}
                        margin="normal"
                        size="small"
                      />
                      <TextField
                        fullWidth
                        label="Persona"
                        value={jtbd.persona}
                        onChange={(e) => updateJTBD(index, { ...jtbd, persona: e.target.value })}
                        margin="normal"
                        size="small"
                      />
                      <TextField
                        fullWidth
                        label="Outcome"
                        value={jtbd.outcome}
                        onChange={(e) => updateJTBD(index, { ...jtbd, outcome: e.target.value })}
                        margin="normal"
                        size="small"
                      />
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <Button
                startIcon={<AddIcon />}
                onClick={addJTBD}
                variant="outlined"
                sx={{
                  borderColor: '#00E5FF',
                  color: '#00E5FF',
                  '&:hover': {
                    borderColor: '#00E5FF',
                    backgroundColor: 'rgba(0, 229, 255, 0.1)',
                  },
                }}
              >
                Add JTBD
              </Button>
              <AIAssistButton
                label="AI Generate JTBD"
                onGenerate={async (additionalPrompt) => {
                  const response = await fetch('/api/ai/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      prompt: `Generate Jobs To Be Done (JTBD) based on personas. Return as JSON array of JTBD objects with statement, persona, and outcome. ${additionalPrompt || ''}`,
                      options: {
                        context: 'Generate JTBD for product strategy phase.',
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
                    const jtbd = JSON.parse(result);
                    if (Array.isArray(jtbd)) {
                      updateField('jtbd', [...data.jtbd, ...jtbd]);
                    }
                  } catch {}
                }}
                context="AI will generate Jobs To Be Done based on your personas"
              />
            </Box>
          </SectionCard>
        </Grid>

        {/* Business Outcomes & KPIs - Side by Side */}
        <Grid item xs={12} md={6}>
          <SectionCard
            title="Business Outcomes"
            icon={<TrendingUpIcon />}
            borderColor="#00FF88"
            helpText="Define measurable business goals this product should achieve. Outcomes should be specific, measurable, and aligned with company objectives."
          >
            {data.business_outcomes.map((outcome, index) => (
              <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <TextField
                  fullWidth
                  value={outcome}
                  onChange={(e) => {
                    const updated = [...data.business_outcomes];
                    updated[index] = e.target.value;
                    updateField('business_outcomes', updated);
                  }}
                  size="small"
                />
                <IconButton
                  onClick={() => removeArrayItem('business_outcomes', index)}
                  size="small"
                  sx={{ color: '#FF1744' }}
                >
                  <DeleteIcon />
                </IconButton>
              </Box>
            ))}
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <Button
                startIcon={<AddIcon />}
                onClick={() => addArrayItem('business_outcomes')}
                variant="outlined"
                size="small"
                sx={{
                  borderColor: '#00FF88',
                  color: '#00FF88',
                  '&:hover': {
                    borderColor: '#00FF88',
                    backgroundColor: 'rgba(0, 255, 136, 0.1)',
                  },
                }}
              >
                Add Outcome
              </Button>
              <AIAssistButton
                label="AI Generate Outcomes"
                onGenerate={async (additionalPrompt) => {
                  const response = await fetch('/api/ai/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      prompt: `Generate business outcomes based on personas, JTBD, and features. Return as JSON array of outcome strings. ${additionalPrompt || ''}`,
                      options: {
                        context: 'Generate business outcomes for product strategy phase.',
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
                    const outcomes = JSON.parse(result);
                    if (Array.isArray(outcomes)) {
                      updateField('business_outcomes', outcomes);
                    }
                  } catch {}
                }}
                context="AI will generate business outcomes based on your personas, JTBD, and features"
              />
            </Box>
          </SectionCard>
        </Grid>

        <Grid item xs={12} md={6}>
          <SectionCard
            title="KPIs"
            icon={<AssessmentIcon />}
            borderColor="#2196F3"
            helpText="Key Performance Indicators that measure success. KPIs should be specific metrics tied to business outcomes, such as user engagement, revenue, or conversion rates."
          >
            {data.kpis.map((kpi, index) => (
              <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <TextField
                  fullWidth
                  value={kpi}
                  onChange={(e) => {
                    const updated = [...data.kpis];
                    updated[index] = e.target.value;
                    updateField('kpis', updated);
                  }}
                  size="small"
                />
                <IconButton
                  onClick={() => removeArrayItem('kpis', index)}
                  size="small"
                  sx={{ color: '#FF1744' }}
                >
                  <DeleteIcon />
                </IconButton>
              </Box>
            ))}
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <Button
                startIcon={<AddIcon />}
                onClick={() => addArrayItem('kpis')}
                variant="outlined"
                size="small"
                sx={{
                  borderColor: '#2196F3',
                  color: '#2196F3',
                  '&:hover': {
                    borderColor: '#2196F3',
                    backgroundColor: 'rgba(33, 150, 243, 0.1)',
                  },
                }}
              >
                Add KPI
              </Button>
              <AIAssistButton
                label="AI Generate KPIs"
                onGenerate={async (additionalPrompt) => {
                  const response = await fetch('/api/ai/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      prompt: `Generate KPIs (Key Performance Indicators) based on business outcomes and features. Return as JSON array of KPI strings with specific metrics. ${additionalPrompt || ''}`,
                      options: {
                        context: 'Generate KPIs for product strategy phase.',
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
                    const kpis = JSON.parse(result);
                    if (Array.isArray(kpis)) {
                      updateField('kpis', kpis);
                    }
                  } catch {}
                }}
                context="AI will generate KPIs based on your business outcomes and features"
              />
            </Box>
          </SectionCard>
        </Grid>

        {/* Features - Full Width */}
        <Grid item xs={12}>
          <SectionCard
            title="Features"
            icon={<BuildIcon />}
            borderColor="#FF6B35"
          >
            <Grid container spacing={2} sx={{ mb: 2 }}>
              {data.features.map((feature, index) => (
                <Grid item xs={12} md={6} key={index}>
                  <Card
                    sx={{
                      backgroundColor: '#121633',
                      border: '1px solid rgba(255, 107, 53, 0.3)',
                      borderRadius: 2,
                    }}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="caption" sx={{ color: '#FF6B35' }}>
                          Feature {index + 1}
                        </Typography>
                        <IconButton
                          onClick={() => removeFeature(index)}
                          size="small"
                          sx={{ color: '#FF1744' }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                      <TextField
                        fullWidth
                        label="Title"
                        value={feature.title}
                        onChange={(e) => updateFeature(index, { ...feature, title: e.target.value })}
                        margin="normal"
                        size="small"
                      />
                      <TextField
                        fullWidth
                        multiline
                        rows={2}
                        label="Description"
                        value={feature.description}
                        onChange={(e) => updateFeature(index, { ...feature, description: e.target.value })}
                        margin="normal"
                        size="small"
                      />
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <Button
                startIcon={<AddIcon />}
                onClick={addFeature}
                variant="outlined"
                sx={{
                  borderColor: '#FF6B35',
                  color: '#FF6B35',
                  '&:hover': {
                    borderColor: '#FF6B35',
                    backgroundColor: 'rgba(255, 107, 53, 0.1)',
                  },
                }}
              >
                Add Feature
              </Button>
              <AIAssistButton
                label="AI Feature Ideas"
                onGenerate={async (additionalPrompt) => {
                  const response = await fetch('/api/ai/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      prompt: `Suggest features based on personas and outcomes. Return as JSON array of feature objects with title, description, target_persona, and target_outcome. ${additionalPrompt || ''}`,
                      options: {
                        context: 'Generate feature ideas for product strategy phase.',
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
                    const features = JSON.parse(result);
                    if (Array.isArray(features)) {
                      updateField('features', [...data.features, ...features]);
                    }
                  } catch {}
                }}
                context="AI will suggest features based on your personas and outcomes"
              />
            </Box>
          </SectionCard>
        </Grid>

        {/* Scored Features - Full Width */}
        <Grid item xs={12}>
          <SectionCard
            title="Scored Features"
            icon={<AssessmentIcon />}
            borderColor="#00E5FF"
          >
            <Grid container spacing={2} sx={{ mb: 2 }}>
              {data.scored_features.map((feature, index) => (
                <Grid item xs={12} key={index}>
                  <Card
                    sx={{
                      backgroundColor: '#121633',
                      border: '1px solid rgba(0, 229, 255, 0.3)',
                      borderRadius: 2,
                    }}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                        <Typography variant="subtitle1" sx={{ color: '#00E5FF', fontWeight: 600 }}>
                          {feature.title || `Scored Feature ${index + 1}`}
                        </Typography>
                        <IconButton
                          onClick={() => removeScoredFeature(index)}
                          size="small"
                          sx={{ color: '#FF1744' }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                          <TextField
                            fullWidth
                            label="Title"
                            value={feature.title}
                            onChange={(e) => updateScoredFeature(index, { ...feature, title: e.target.value })}
                            size="small"
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            fullWidth
                            label="Description"
                            value={feature.description}
                            onChange={(e) => updateScoredFeature(index, { ...feature, description: e.target.value })}
                            size="small"
                          />
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <Typography variant="caption" sx={{ color: '#B0B0B0', mb: 1, display: 'block' }}>
                            Impact: {feature.impact}/10
                          </Typography>
                          <Slider
                            value={feature.impact}
                            onChange={(_, value) => updateScoredFeature(index, { ...feature, impact: value as number })}
                            min={1}
                            max={10}
                            step={1}
                            marks
                            sx={{
                              color: '#00E5FF',
                              '& .MuiSlider-thumb': {
                                boxShadow: '0 0 10px rgba(0, 229, 255, 0.5)',
                              },
                            }}
                          />
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <Typography variant="caption" sx={{ color: '#B0B0B0', mb: 1, display: 'block' }}>
                            Effort: {feature.effort}/10
                          </Typography>
                          <Slider
                            value={feature.effort}
                            onChange={(_, value) => updateScoredFeature(index, { ...feature, effort: value as number })}
                            min={1}
                            max={10}
                            step={1}
                            marks
                            sx={{
                              color: '#FF6B35',
                              '& .MuiSlider-thumb': {
                                boxShadow: '0 0 10px rgba(255, 107, 53, 0.5)',
                              },
                            }}
                          />
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <FormControl fullWidth size="small">
                            <InputLabel>MVP Group</InputLabel>
                            <Select
                              value={feature.mvp_group}
                              label="MVP Group"
                              onChange={(e) => updateScoredFeature(index, { ...feature, mvp_group: e.target.value as 'mvp' | 'v2' | 'v3' })}
                            >
                              <MenuItem value="mvp">MVP</MenuItem>
                              <MenuItem value="v2">V2</MenuItem>
                              <MenuItem value="v3">V3</MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
            <Button
              startIcon={<AddIcon />}
              onClick={addScoredFeature}
              variant="outlined"
              sx={{
                borderColor: '#00E5FF',
                color: '#00E5FF',
                '&:hover': {
                  borderColor: '#00E5FF',
                  backgroundColor: 'rgba(0, 229, 255, 0.1)',
                },
              }}
            >
              Add Scored Feature
            </Button>
          </SectionCard>
        </Grid>

        {/* Tech Stack - Full Width */}
        <Grid item xs={12}>
          <SectionCard
            title="Tech Stack Preferences"
            icon={<BuildIcon />}
            borderColor="#2196F3"
          >
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Tech Stack Preferences"
              value={data.tech_stack_preferences}
              onChange={(e) => updateField('tech_stack_preferences', e.target.value)}
              placeholder="e.g., React + Supabase, must be HIPAA-friendly..."
            />
          </SectionCard>
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
        label={modalField === 'business_outcomes' ? 'Business Outcome' : modalField === 'kpis' ? 'KPI' : 'Item'}
        placeholder={`Enter ${modalField === 'business_outcomes' ? 'business outcome' : modalField === 'kpis' ? 'KPI' : 'item'}...`}
      />
    </Box>
  );
}
