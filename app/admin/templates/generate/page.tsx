'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Container,
  Box,
  Typography,
  Button,
  TextField,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  FormControlLabel,
  Switch,
  Paper,
  Divider,
  Chip,
  Grid,
  IconButton,
  Tooltip,
  useTheme,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  AutoAwesome as AutoAwesomeIcon,
  CheckCircle as CheckCircleIcon,
  Refresh as RefreshIcon,
  ContentCopy as ContentCopyIcon,
} from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import { useRole } from '@/lib/hooks/useRole';
import { useNotification } from '@/components/providers/NotificationProvider';

interface GeneratedPhase {
  phase_number: number;
  phase_name: string;
  display_order: number;
}

interface GeneratedFieldConfig {
  phase_number: number;
  field_key: string;
  field_type: string;
  display_order: number;
  layout_config: {
    columns: number;
    spacing?: number;
  };
  field_config: {
    label: string;
    helpText?: string;
    placeholder?: string;
    required?: boolean;
    aiSettings?: {
      enabled: boolean;
    };
  };
}

interface GeneratedTemplate {
  template: {
    name: string;
    description: string;
    category?: string;
  };
  phases: GeneratedPhase[];
  field_configs: GeneratedFieldConfig[];
}

export default function GenerateTemplatePage() {
  const theme = useTheme();
  const router = useRouter();
  const supabase = createSupabaseClient();
  const { role, loading: roleLoading } = useRole();
  const { showSuccess, showError } = useNotification();

  const [step, setStep] = useState<'input' | 'preview'>('input');
  const [templateName, setTemplateName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedTemplate, setGeneratedTemplate] = useState<GeneratedTemplate | null>(null);

  const handleCopyPrompt = async () => {
    const prompt = `You are helping me create a detailed project template description for an AI-powered template generator.

The template generator will create a project management template with phases and fields based on my description. I need your help crafting the perfect description that will result in a comprehensive, well-structured template.

Please help me create a detailed description that includes:
1. Project type and domain (e.g., SaaS product, E-commerce platform, Mobile app, Enterprise software)
2. Methodology or framework (e.g., Agile, Waterfall, Design Thinking, The FullStack Method™)
3. Key phases needed (typically 4 to 8 phases that represent the project lifecycle)
4. Specific fields or data points needed in each phase (see field types and column layouts below)
5. Any special requirements or constraints

You must also select which specific fields will be included in each phase. Here are the available field types for each phase:
- Short Text
- Long Text / Rich Text
- Number
- Date / Date Range
- Dropdown / Select (single or multi)
- Checkbox
- Attachment / File Upload
- User Reference (assign to person or team)
- Tag(s)
- Section Header
- AI Assistant (text field with AI enhancement)
- URL / Link
- Email
- Phone
- Slider / Rating
- Progress Bar
- Scorecard / Metrics

Additionally, for each field, specify the recommended number of columns (between 4 and 12) it should span in the phase layout. Typical column layout patterns are: 4/4/4, 6/6, 5/7, 7/5, 4/8, 8/4, or a single field spanning all 12 columns. Indicate for each field which pattern or column span you recommend and whether fields are grouped together on the same row.

Format your response as a clear, detailed description that I can paste directly into the template generator. Be specific about:
- What type of project this is
- What phases are needed and what happens in each phase
- What information needs to be collected in each phase (and using which field types)
- How you recommend the fields be laid out using the column patterns (e.g., "Field A (4 columns), Field B (4 columns), Field C (4 columns) on the same row" or "Field D (12 columns)")
- Any industry-specific requirements or best practices

Example structure:
"A [PROJECT TYPE] template using [METHODOLOGY]. The template should include phases for [PHASE 1], [PHASE 2], [PHASE 3], etc.

Phase 1 should collect:
- [Field 1 name] ([field type], [column span]), [help text/description]
- [Field 2 name] ([field type], [column span]), [help text/description]
  [Group Field 1 and Field 2 on the same row if appropriate]
Phase 2 should collect:
- ...

Include fields for [any special requirements]."

Please help me craft this description based on my project needs, making sure to select from the above field types and use the recommended column layouts for each field or group of fields.`;

    try {
      await navigator.clipboard.writeText(prompt);
      showSuccess('Prompt copied to clipboard! Paste it into your preferred AI tool.');
    } catch (err) {
      showError('Failed to copy prompt to clipboard');
    }
  };

  if (roleLoading) {
    return (
      <Container>
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress sx={{ color: theme.palette.text.primary }} />
        </Box>
      </Container>
    );
  }

  // Allow admins and PMs to generate templates
  if (role !== 'admin' && role !== 'pm') {
    router.push('/dashboard');
    return null;
  }

  const handleGenerate = async () => {
    if (!templateName.trim()) {
      showError('Template name is required');
      return;
    }

    if (!description.trim()) {
      showError('Please provide a description or requirements for the template');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/templates/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: templateName.trim(),
          description: description.trim(),
          category: category.trim() || null,
          is_public: isPublic,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate template');
      }

      setGeneratedTemplate(data.result);
      setStep('preview');
      showSuccess('Template generated successfully! Review and confirm to create.');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate template';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerate = () => {
    setStep('input');
    setGeneratedTemplate(null);
    setError(null);
  };

  const handleConfirm = async () => {
    if (!generatedTemplate) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Include is_public from the original form
      const templateToSave = {
        ...generatedTemplate,
        template: {
          ...generatedTemplate.template,
          is_public: isPublic,
        },
      };

      const response = await fetch('/api/admin/templates/generate/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(templateToSave),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save template');
      }

      showSuccess('Template created successfully!');
      router.push(`/admin/templates/${data.templateId}/builder`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save template';
      setError(errorMessage);
      showError(errorMessage);
      setSaving(false);
    }
  };

  if (step === 'preview' && generatedTemplate) {
    return (
      <Box sx={{ backgroundColor: theme.palette.background.default, minHeight: '100vh', pb: 4 }}>
        <Container maxWidth="lg" sx={{ pt: 4, pb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={handleRegenerate}
              sx={{
                color: theme.palette.text.primary,
                border: `1px solid ${theme.palette.text.primary}`,
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              Back
            </Button>
            <Typography
              variant="h4"
              sx={{
                flex: 1,
                fontWeight: 700,
                fontFamily: 'var(--font-rubik), Rubik, sans-serif',
                color: theme.palette.text.primary,
              }}
            >
              Review Generated Template
            </Typography>
          </Box>

          {error && (
            <Alert 
              severity="error" 
              sx={{ 
                mb: 3,
                backgroundColor: theme.palette.action.hover,
                border: `1px solid ${theme.palette.divider}`,
                color: theme.palette.text.primary,
              }}
            >
              {error}
            </Alert>
          )}

          <Card
            sx={{
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 3,
              mb: 3,
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <AutoAwesomeIcon sx={{ color: theme.palette.text.primary, fontSize: 32 }} />
                <Box>
                  <Typography variant="h5" sx={{ color: theme.palette.text.primary, fontWeight: 600, fontFamily: 'var(--font-rubik), Rubik, sans-serif' }}>
                    {generatedTemplate.template.name}
                  </Typography>
                  <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mt: 0.5 }}>
                    {generatedTemplate.template.description}
                  </Typography>
                  {generatedTemplate.template.category && (
                    <Chip
                      label={generatedTemplate.template.category}
                      size="small"
                      sx={{
                        mt: 1,
                        backgroundColor: theme.palette.action.hover,
                        color: theme.palette.text.primary,
                        border: `1px solid ${theme.palette.divider}`,
                      }}
                    />
                  )}
                </Box>
              </Box>

              <Divider sx={{ my: 3, borderColor: theme.palette.divider }} />

              <Typography variant="h6" sx={{ color: theme.palette.text.primary, mb: 2, fontWeight: 600, fontFamily: 'var(--font-rubik), Rubik, sans-serif' }}>
                Phases ({generatedTemplate.phases.length})
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 4 }}>
                {generatedTemplate.phases
                  .sort((a, b) => a.display_order - b.display_order)
                  .map((phase) => {
                    const phaseFields = generatedTemplate.field_configs
                      .filter((f) => f.phase_number === phase.phase_number)
                      .sort((a, b) => a.display_order - b.display_order);

                    return (
                      <Paper
                        key={phase.phase_number}
                        sx={{
                          p: 3,
                          backgroundColor: theme.palette.background.paper,
                          border: `1px solid ${theme.palette.divider}`,
                          borderRadius: 2,
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                          <Chip
                            label={`Phase ${phase.phase_number}`}
                            size="small"
                            sx={{
                              backgroundColor: theme.palette.action.hover,
                              color: theme.palette.text.primary,
                              fontWeight: 600,
                              border: `1px solid ${theme.palette.divider}`,
                            }}
                          />
                          <Typography variant="h6" sx={{ color: theme.palette.text.primary, fontWeight: 600, fontFamily: 'var(--font-rubik), Rubik, sans-serif' }}>
                            {phase.phase_name}
                          </Typography>
                          <Chip
                            label={`${phaseFields.length} field${phaseFields.length !== 1 ? 's' : ''}`}
                            size="small"
                            sx={{
                              backgroundColor: theme.palette.action.hover,
                              color: theme.palette.text.primary,
                              border: `1px solid ${theme.palette.divider}`,
                            }}
                          />
                        </Box>

                        <Box sx={{ pl: 4 }}>
                          {phaseFields.length > 0 ? (
                            <Grid container spacing={2}>
                              {phaseFields.map((field) => (
                                <Grid item xs={12} sm={6} md={4} key={field.field_key}>
                                  <Paper
                                    sx={{
                                      p: 2,
                                      backgroundColor: theme.palette.background.paper,
                                      border: `1px solid ${theme.palette.divider}`,
                                      borderRadius: 1,
                                    }}
                                  >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                      <Typography
                                        variant="body2"
                                        sx={{ color: theme.palette.text.primary, fontWeight: 600 }}
                                      >
                                        {field.field_config.label}
                                      </Typography>
                                      {field.field_config.required && (
                                        <Typography
                                          component="span"
                                          sx={{ color: theme.palette.error.main, fontSize: '0.875rem' }}
                                        >
                                          *
                                        </Typography>
                                      )}
                                    </Box>
                                    <Chip
                                      label={field.field_type}
                                      size="small"
                                      sx={{
                                        backgroundColor: theme.palette.action.hover,
                                        color: theme.palette.text.primary,
                                        fontSize: '0.7rem',
                                        height: 20,
                                        border: `1px solid ${theme.palette.divider}`,
                                      }}
                                    />
                                    {field.field_config.helpText && (
                                      <Typography
                                        variant="caption"
                                        sx={{ color: theme.palette.text.secondary, display: 'block', mt: 1 }}
                                      >
                                        {field.field_config.helpText}
                                      </Typography>
                                    )}
                                  </Paper>
                                </Grid>
                              ))}
                            </Grid>
                          ) : (
                            <Typography variant="body2" sx={{ color: theme.palette.text.secondary, fontStyle: 'italic' }}>
                              No fields configured for this phase
                            </Typography>
                          )}
                        </Box>
                      </Paper>
                    );
                  })}
              </Box>

              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', pt: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={handleRegenerate}
                  disabled={saving}
                  sx={{
                    borderColor: theme.palette.text.primary,
                    color: theme.palette.text.primary,
                    '&:hover': {
                      borderColor: theme.palette.text.primary,
                      backgroundColor: theme.palette.action.hover,
                    },
                    '&.Mui-disabled': {
                      borderColor: theme.palette.divider,
                      color: theme.palette.text.secondary,
                    },
                  }}
                >
                  Regenerate
                </Button>
                <Button
                  variant="contained"
                  startIcon={saving ? <CircularProgress size={20} sx={{ color: theme.palette.background.default }} /> : <CheckCircleIcon />}
                  onClick={handleConfirm}
                  disabled={saving}
                  sx={{
                    backgroundColor: theme.palette.text.primary,
                    color: theme.palette.background.default,
                    fontWeight: 600,
                    '&:hover': {
                      backgroundColor: theme.palette.action.hover,
                    },
                    '&.Mui-disabled': {
                      backgroundColor: theme.palette.divider,
                      color: theme.palette.text.secondary,
                    },
                  }}
                >
                  {saving ? 'Creating...' : 'Confirm & Create'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ backgroundColor: theme.palette.background.default, minHeight: '100vh', pb: 4 }}>
      <Container maxWidth="md" sx={{ pt: 4, pb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => router.push('/admin/templates')}
            sx={{
              color: theme.palette.text.primary,
              border: `1px solid ${theme.palette.text.primary}`,
              '&:hover': {
                backgroundColor: theme.palette.action.hover,
              },
            }}
          >
            Back
          </Button>
          <Typography
            variant="h4"
            sx={{
              flex: 1,
              fontWeight: 700,
              fontFamily: 'var(--font-rubik), Rubik, sans-serif',
              color: theme.palette.text.primary,
            }}
          >
            AI Template Generator
          </Typography>
        </Box>

        <Card
          sx={{
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 3,
          }}
        >
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <AutoAwesomeIcon sx={{ color: theme.palette.text.primary, fontSize: 32 }} />
              <Box>
                <Typography variant="h5" sx={{ color: theme.palette.text.primary, fontWeight: 600, fontFamily: 'var(--font-rubik), Rubik, sans-serif' }}>
                  Generate Template with AI
                </Typography>
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mt: 0.5 }}>
                  Describe your project type and requirements, and AI will generate a custom template with phases and fields.
                </Typography>
              </Box>
            </Box>

            {error && (
              <Alert 
                severity="error" 
                sx={{ 
                  mb: 3,
                  backgroundColor: theme.palette.action.hover,
                  border: `1px solid ${theme.palette.divider}`,
                  color: theme.palette.text.primary,
                }}
              >
                {error}
              </Alert>
            )}

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <TextField
                fullWidth
                label="Template Name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                required
                placeholder="e.g., SaaS Product Template, E-commerce Template"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: theme.palette.background.paper,
                    color: theme.palette.text.primary,
                    '& fieldset': {
                      borderColor: theme.palette.divider,
                    },
                    '&:hover fieldset': {
                      borderColor: theme.palette.text.secondary,
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: theme.palette.text.primary,
                    },
                  },
                  '& .MuiInputLabel-root': {
                    color: theme.palette.text.secondary,
                  },
                  '& .MuiInputLabel-root.Mui-focused': {
                    color: theme.palette.text.primary,
                  },
                  '& .MuiInputBase-input': {
                    color: theme.palette.text.primary,
                  },
                  '& .MuiInputBase-input::placeholder': {
                    color: theme.palette.text.secondary,
                    opacity: 0.7,
                  },
                }}
              />

              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      color: theme.palette.text.secondary,
                      fontWeight: 500,
                    }}
                  >
                    Description & Requirements
                  </Typography>
                  <Tooltip title="Copy prompt to use with your preferred AI tool to generate the perfect description">
                    <IconButton
                      size="small"
                      onClick={handleCopyPrompt}
                      sx={{
                        color: theme.palette.text.primary,
                        '&:hover': {
                          backgroundColor: theme.palette.action.hover,
                        },
                      }}
                    >
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Typography
                    component="span"
                    sx={{
                      color: theme.palette.error.main,
                      fontSize: '0.875rem',
                      ml: 0.5,
                    }}
                  >
                    *
                  </Typography>
                </Box>
                <TextField
                  fullWidth
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  multiline
                  rows={6}
                  placeholder="Describe the type of project, methodology, phases needed, and any specific fields or requirements. For example: 'A SaaS product template with phases for discovery, design, development, and launch. Include fields for user personas, feature prioritization, API specifications, and deployment checklist.'"
                  helperText="Be as detailed as possible. The AI will use this to generate appropriate phases and fields."
                  sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: theme.palette.background.paper,
                    color: theme.palette.text.primary,
                    '& fieldset': {
                      borderColor: theme.palette.divider,
                    },
                    '&:hover fieldset': {
                      borderColor: theme.palette.text.secondary,
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: theme.palette.text.primary,
                    },
                  },
                  '& .MuiInputLabel-root': {
                    color: theme.palette.text.secondary,
                  },
                  '& .MuiInputLabel-root.Mui-focused': {
                    color: theme.palette.text.primary,
                  },
                  '& .MuiInputBase-input': {
                    color: theme.palette.text.primary,
                  },
                  '& .MuiInputBase-input::placeholder': {
                    color: theme.palette.text.secondary,
                    opacity: 0.7,
                  },
                  '& .MuiFormHelperText-root': {
                    color: theme.palette.text.secondary,
                  },
                }}
              />
              </Box>

              <TextField
                fullWidth
                label="Category (Optional)"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g., SaaS, E-commerce, Mobile App, Enterprise"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: theme.palette.background.paper,
                    color: theme.palette.text.primary,
                    '& fieldset': {
                      borderColor: theme.palette.divider,
                    },
                    '&:hover fieldset': {
                      borderColor: theme.palette.text.secondary,
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: theme.palette.text.primary,
                    },
                  },
                  '& .MuiInputLabel-root': {
                    color: theme.palette.text.secondary,
                  },
                  '& .MuiInputLabel-root.Mui-focused': {
                    color: theme.palette.text.primary,
                  },
                  '& .MuiInputBase-input': {
                    color: theme.palette.text.primary,
                  },
                  '& .MuiInputBase-input::placeholder': {
                    color: theme.palette.text.secondary,
                    opacity: 0.7,
                  },
                }}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': {
                        color: theme.palette.text.primary,
                      },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                        backgroundColor: theme.palette.text.primary,
                      },
                    }}
                  />
                }
                label="Make template public (visible to all users)"
                sx={{ color: theme.palette.text.secondary }}
              />

              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', pt: 2 }}>
                <Button
                  variant="outlined"
                  onClick={() => router.push('/admin/templates')}
                  sx={{
                    borderColor: theme.palette.text.primary,
                    color: theme.palette.text.primary,
                    '&:hover': {
                      borderColor: theme.palette.text.primary,
                      backgroundColor: theme.palette.action.hover,
                    },
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  startIcon={generating ? <CircularProgress size={20} sx={{ color: theme.palette.background.default }} /> : <AutoAwesomeIcon />}
                  onClick={handleGenerate}
                  disabled={generating || !templateName.trim() || !description.trim()}
                  sx={{
                    backgroundColor: theme.palette.text.primary,
                    color: theme.palette.background.default,
                    fontWeight: 600,
                    '&:hover': {
                      backgroundColor: theme.palette.action.hover,
                    },
                    '&.Mui-disabled': {
                      backgroundColor: theme.palette.divider,
                      color: theme.palette.text.secondary,
                    },
                  }}
                >
                  {generating ? 'Generating...' : 'Generate Template'}
                </Button>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}

