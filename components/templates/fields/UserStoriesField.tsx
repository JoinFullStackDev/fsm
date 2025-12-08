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
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import AIAssistButton from '@/components/ai/AIAssistButton';
import type { TemplateFieldConfig } from '@/types/templates';
import type { UserStory } from '@/types/phases';

interface UserStoriesFieldProps {
  field: TemplateFieldConfig;
  value: UserStory[];
  onChange: (value: UserStory[]) => void;
  error?: string;
  phaseData?: Record<string, unknown>;
}

export default function UserStoriesField({ field, value, onChange, error, phaseData }: UserStoriesFieldProps) {
  const config = field.field_config;
  const stories = Array.isArray(value) ? value : [];
  const aiEnabled = config.aiSettings?.enabled;

  const addUserStory = () => {
    const newStory: UserStory = {
      user_role: '',
      statement: '',
    };
    onChange([...stories, newStory]);
  };

  const updateUserStory = (index: number, story: UserStory) => {
    const updated = [...stories];
    updated[index] = story;
    onChange(updated);
  };

  const removeUserStory = (index: number) => {
    onChange(stories.filter((_, i) => i !== index));
  };

  return (
    <Box sx={{ width: '100%' }}>
      {error && (
        <Typography variant="caption" color="error" sx={{ mb: 2, display: 'block' }}>
          {error}
        </Typography>
      )}
      <Grid container spacing={{ xs: 1, md: 2 }} sx={{ mb: 2 }}>
        {stories.map((story, index) => (
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
                  <Typography variant="caption" sx={{ color: 'primary.main' }}>
                    Story {index + 1}
                  </Typography>
                  <IconButton
                    onClick={() => removeUserStory(index)}
                    size="small"
                    sx={{ color: 'error.main' }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
                <TextField
                  fullWidth
                  label="User Role"
                  value={story.user_role}
                  onChange={(e) => updateUserStory(index, { ...story, user_role: e.target.value })}
                  margin="normal"
                  size="small"
                />
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Statement"
                  value={story.statement}
                  onChange={(e) => updateUserStory(index, { ...story, statement: e.target.value })}
                  margin="normal"
                  size="small"
                  placeholder="As a [role], I want [action], so that [outcome]"
                />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mt: '1.5rem' }}>
        <Button
          startIcon={<AddIcon />}
          onClick={addUserStory}
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
          Add User Story
        </Button>
        {aiEnabled && (
          <AIAssistButton
            label="AI Generate User Stories"
            onGenerate={async (additionalPrompt) => {
              const response = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  prompt: `${config.aiSettings?.customPrompt || 'Generate user stories in "As a [role], I want [action], so that [outcome]" format'}. Return as JSON array of user story objects with user_role and statement. ${additionalPrompt || ''}`,
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
                  onChange([...stories, ...generated]);
                }
              } catch {}
            }}
            context="AI will generate user stories based on your personas and features"
          />
        )}
      </Box>
    </Box>
  );
}

