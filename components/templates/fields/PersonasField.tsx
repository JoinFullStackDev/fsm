'use client';
import type { PhaseDataUnion } from '@/types/phases';

import { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Card,
  CardContent,
  IconButton,
  Typography,
  Grid,
  Chip,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import AIAssistButton from '@/components/ai/AIAssistButton';
import InputModal from '@/components/ui/InputModal';
import HelpTooltip from '@/components/ui/HelpTooltip';
import type { TemplateFieldConfig } from '@/types/templates';
import type { Persona } from '@/types/phases';

interface PersonasFieldProps {
  field: TemplateFieldConfig;
  value: Persona[];
  onChange: (value: Persona[]) => void;
  error?: string;
  phaseData?: Record<string, unknown>;
}

export default function PersonasField({ field, value, onChange, error, phaseData }: PersonasFieldProps) {
  const config = field.field_config;
  const aiEnabled = config.aiSettings?.enabled;
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [painModalOpen, setPainModalOpen] = useState(false);
  const [activePersonaIndex, setActivePersonaIndex] = useState<number | null>(null);
  const [activeField, setActiveField] = useState<'goal' | 'pain' | null>(null);

  const personas = Array.isArray(value) ? value : [];

  const addPersona = () => {
    const newPersona: Persona = {
      name: '',
      description: '',
      goals: [],
      pains: [],
    };
    onChange([...personas, newPersona]);
  };

  const updatePersona = (index: number, persona: Persona) => {
    const updated = [...personas];
    updated[index] = persona;
    onChange(updated);
  };

  const removePersona = (index: number) => {
    onChange(personas.filter((_, i) => i !== index));
  };

  const handleAddGoal = (index: number) => {
    setActivePersonaIndex(index);
    setActiveField('goal');
    setGoalModalOpen(true);
  };

  const handleAddPain = (index: number) => {
    setActivePersonaIndex(index);
    setActiveField('pain');
    setPainModalOpen(true);
  };

  const handleGoalConfirm = (goal: string) => {
    if (activePersonaIndex !== null) {
      const persona = personas[activePersonaIndex];
      updatePersona(activePersonaIndex, {
        ...persona,
        goals: [...persona.goals, goal],
      });
    }
    setGoalModalOpen(false);
    setActivePersonaIndex(null);
    setActiveField(null);
  };

  const handlePainConfirm = (pain: string) => {
    if (activePersonaIndex !== null) {
      const persona = personas[activePersonaIndex];
      updatePersona(activePersonaIndex, {
        ...persona,
        pains: [...persona.pains, pain],
      });
    }
    setPainModalOpen(false);
    setActivePersonaIndex(null);
    setActiveField(null);
  };

  const removeGoal = (personaIndex: number, goalIndex: number) => {
    const persona = personas[personaIndex];
    updatePersona(personaIndex, {
      ...persona,
      goals: persona.goals.filter((_, i) => i !== goalIndex),
    });
  };

  const removePain = (personaIndex: number, painIndex: number) => {
    const persona = personas[personaIndex];
    updatePersona(personaIndex, {
      ...persona,
      pains: persona.pains.filter((_, i) => i !== painIndex),
    });
  };

  return (
    <Box>
      {error && (
        <Typography variant="caption" color="error" sx={{ mb: 2, display: 'block' }}>
          {error}
        </Typography>
      )}
      <Grid container spacing={{ xs: 1, md: 2 }} sx={{ mb: 2 }}>
        {personas.map((persona, index) => (
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
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ color: 'primary.main', fontWeight: 600 }}>
                    Persona {index + 1}
                  </Typography>
                  <IconButton
                    onClick={() => removePersona(index)}
                    size="small"
                    sx={{ color: 'error.main' }}
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
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                    Goals
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                    {persona.goals.map((goal, goalIndex) => (
                      <Chip
                        key={goalIndex}
                        label={goal}
                        onDelete={() => removeGoal(index, goalIndex)}
                        size="small"
                        sx={{
                          backgroundColor: 'rgba(0, 229, 255, 0.1)',
                          color: 'text.primary',
                        }}
                      />
                    ))}
                  </Box>
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => handleAddGoal(index)}
                    variant="outlined"
                  >
                    Add Goal
                  </Button>
                </Box>
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                    Pains
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                    {persona.pains.map((pain, painIndex) => (
                      <Chip
                        key={painIndex}
                        label={pain}
                        onDelete={() => removePain(index, painIndex)}
                        size="small"
                        sx={{
                          backgroundColor: 'rgba(255, 107, 53, 0.1)',
                          color: 'text.primary',
                        }}
                      />
                    ))}
                  </Box>
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => handleAddPain(index)}
                    variant="outlined"
                  >
                    Add Pain
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mt: '1.5rem' }}>
        <Button
          startIcon={<AddIcon />}
          onClick={addPersona}
          variant="outlined"
          sx={{
            borderColor: 'primary.main',
            color: 'primary.main',
          }}
        >
          Add Persona
        </Button>
        {aiEnabled && (
          <AIAssistButton
            label="AI Generate Personas"
            onGenerate={async (additionalPrompt) => {
              const response = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  prompt: `${config.aiSettings?.customPrompt || 'Generate detailed personas'}. Return as JSON array of persona objects with name, description, goals (array), and pains (array). ${additionalPrompt || ''}`,
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
                  onChange([...personas, ...generated]);
                }
              } catch {}
            }}
            context="AI will generate personas based on your input"
          />
        )}
      </Box>
      <InputModal
        open={goalModalOpen}
        onClose={() => {
          setGoalModalOpen(false);
          setActivePersonaIndex(null);
          setActiveField(null);
        }}
        onConfirm={handleGoalConfirm}
        title="Add Goal"
        label="Goal"
        placeholder="Enter a goal..."
      />
      <InputModal
        open={painModalOpen}
        onClose={() => {
          setPainModalOpen(false);
          setActivePersonaIndex(null);
          setActiveField(null);
        }}
        onConfirm={handlePainConfirm}
        title="Add Pain"
        label="Pain"
        placeholder="Enter a pain point..."
      />
    </Box>
  );
}

