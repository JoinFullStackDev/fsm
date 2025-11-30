'use client';

import {
  Box,
  TextField,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
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
import type { Screen } from '@/types/phases';

interface ScreensFieldProps {
  field: TemplateFieldConfig;
  value: Screen[];
  onChange: (value: Screen[]) => void;
  error?: string;
  phaseData?: any;
}

export default function ScreensField({ field, value, onChange, error, phaseData }: ScreensFieldProps) {
  const config = field.field_config;
  const screens = Array.isArray(value) ? value : [];
  const aiEnabled = config.aiSettings?.enabled;

  const addScreen = () => {
    const newScreen: Screen = {
      screen_key: '',
      title: '',
      description: '',
      roles: [],
      is_core: false,
    };
    onChange([...screens, newScreen]);
  };

  const updateScreen = (index: number, screen: Screen) => {
    const updated = [...screens];
    updated[index] = screen;
    onChange(updated);
  };

  const removeScreen = (index: number) => {
    onChange(screens.filter((_, i) => i !== index));
  };

  return (
    <Box sx={{ width: '100%' }}>
      {error && (
        <Typography variant="caption" color="error" sx={{ mb: 2, display: 'block' }}>
          {error}
        </Typography>
      )}
      <Grid container spacing={{ xs: 1, md: 2 }} sx={{ mb: 2 }}>
        {screens.map((screen, index) => (
          <Grid item xs={12} md={6} lg={4} key={index}>
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
                    {screen.title || `Screen ${index + 1}`}
                  </Typography>
                  <IconButton
                    onClick={() => removeScreen(index)}
                    size="small"
                    sx={{ color: 'error.main' }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
                <TextField
                  fullWidth
                  label="Screen Key"
                  value={screen.screen_key}
                  onChange={(e) => updateScreen(index, { ...screen, screen_key: e.target.value })}
                  margin="normal"
                  size="small"
                />
                <TextField
                  fullWidth
                  label="Title"
                  value={screen.title}
                  onChange={(e) => updateScreen(index, { ...screen, title: e.target.value })}
                  margin="normal"
                  size="small"
                />
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Description"
                  value={screen.description}
                  onChange={(e) => updateScreen(index, { ...screen, description: e.target.value })}
                  margin="normal"
                  size="small"
                />
                <TextField
                  fullWidth
                  label="Roles (comma-separated)"
                  value={screen.roles.join(', ')}
                  onChange={(e) => updateScreen(index, { ...screen, roles: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                  margin="normal"
                  size="small"
                  placeholder="admin, pm, designer"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={screen.is_core}
                      onChange={(e) => updateScreen(index, { ...screen, is_core: e.target.checked })}
                      sx={{
                        color: 'primary.main',
                        '&.Mui-checked': {
                          color: 'primary.main',
                        },
                      }}
                    />
                  }
                  label={<Typography sx={{ color: 'text.primary', fontSize: '0.875rem' }}>Core Screen</Typography>}
                />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mt: '1.5rem' }}>
        <Button
          startIcon={<AddIcon />}
          onClick={addScreen}
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
          Add Screen
        </Button>
        {aiEnabled && (
          <AIAssistButton
            label="AI Suggest Screens"
            onGenerate={async (additionalPrompt) => {
              const response = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  prompt: `${config.aiSettings?.customPrompt || 'Suggest screens for this application'}. Return as JSON array of screen objects with screen_key, title, description, roles (array), and is_core (boolean). ${additionalPrompt || ''}`,
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
                  onChange([...screens, ...generated]);
                }
              } catch {}
            }}
            context="AI will suggest screens based on your application requirements"
          />
        )}
      </Box>
    </Box>
  );
}

