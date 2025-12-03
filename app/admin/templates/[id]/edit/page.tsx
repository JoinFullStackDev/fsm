'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Container,
  Box,
  Typography,
  Button,
  Paper,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  IconButton,
  TextField,
  Switch,
  FormControlLabel,
  Grid,
  Chip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import { useRole } from '@/lib/hooks/useRole';
import { useNotification } from '@/components/providers/NotificationProvider';
import PhaseManager from '@/components/templates/PhaseManager';
import { ensurePhasesExist } from '@/lib/templates/ensurePhasesExist';
import type { ProjectTemplate, TemplatePhase } from '@/types/project';

export default function EditTemplatePage() {
  const theme = useTheme();
  const router = useRouter();
  const params = useParams();
  const templateId = params.id as string;
  const supabase = createSupabaseClient();
  const { role, loading: roleLoading } = useRole();
  const { showSuccess, showError } = useNotification();
  const [template, setTemplate] = useState<ProjectTemplate | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [templatePhases, setTemplatePhases] = useState<TemplatePhase[]>([]);
  const [editingMetadata, setEditingMetadata] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templateCategory, setTemplateCategory] = useState('');
  const [templateIsPublic, setTemplateIsPublic] = useState(false);
  const [savingMetadata, setSavingMetadata] = useState(false);

  const loadTemplate = useCallback(async () => {
    setLoading(true);
    
    try {
      // Use API endpoint to avoid RLS recursion issues
      const response = await fetch(`/api/admin/templates/${templateId}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || 'Template not found');
        setLoading(false);
        return;
      }

      const data = await response.json();
      const templateData = data.template;
      const phasesData = data.phases || [];

      setTemplate(templateData);
      
      // Load template metadata for editing
      setTemplateName(templateData.name || '');
      setTemplateDescription(templateData.description || '');
      setTemplateCategory(templateData.category || '');
      setTemplateIsPublic(templateData.is_public || false);

      // Ensure phases exist (backward compatibility)
      const ensuredPhases = await ensurePhasesExist(templateId, supabase);

      // Store template phases (use loaded phases or fallback to ensured phases)
      const loadedPhases = (phasesData.length > 0 ? phasesData : ensuredPhases) as TemplatePhase[];
      setTemplatePhases(loadedPhases);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load template');
    } finally {
      setLoading(false);
    }
  }, [templateId, supabase]);

  useEffect(() => {
    // Wait for role to load before checking
    if (roleLoading) {
      return;
    }

    // Allow admins and PMs to edit templates
    if (role !== 'admin' && role !== 'pm') {
      router.push('/dashboard');
      return;
    }

    loadTemplate();
  }, [templateId, role, roleLoading, router, loadTemplate]);

  const handlePhasesChange = () => {
    // Reload phases when they change
    if (templateId) {
      loadTemplate();
    }
  };

  const handleSaveMetadata = async () => {
    if (!templateName.trim()) {
      showError('Template name is required');
      return;
    }

    // Check if template is global (cannot be edited)
    if (template?.is_publicly_available) {
      showError('Cannot edit global templates. Please duplicate the template to create your own copy.');
      return;
    }

    setSavingMetadata(true);
    try {
      const response = await fetch(`/api/admin/templates/${templateId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: templateName.trim(),
          description: templateDescription.trim(),
          category: templateCategory.trim(),
          is_public: templateIsPublic,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update template');
      }

      showSuccess('Template metadata updated successfully');
      setEditingMetadata(false);
      // Reload template to get updated data
      loadTemplate();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to update template metadata');
    } finally {
      setSavingMetadata(false);
    }
  };

  const renderContent = () => {
    // Tab 0 is Template Settings
    if (activeTab === 0) {
      return (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="h6" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
                Template Settings
              </Typography>
              {template?.is_publicly_available && (
                <Chip
                  label="Global Template"
                  size="small"
                  sx={{
                    backgroundColor: theme.palette.info.main,
                    color: theme.palette.background.default,
                    fontWeight: 600,
                  }}
                  title="This is a global template and cannot be edited. Duplicate it to create your own copy."
                />
              )}
            </Box>
            {!editingMetadata && !template?.is_publicly_available && (
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (template?.is_publicly_available) {
                    return;
                  }
                  setEditingMetadata(true);
                }}
                sx={{
                  borderColor: theme.palette.text.primary,
                  color: theme.palette.text.primary,
                  '&:hover': {
                    borderColor: theme.palette.text.primary,
                    backgroundColor: theme.palette.action.hover,
                  },
                }}
              >
                Edit
              </Button>
            )}
          </Box>

          {template?.is_publicly_available && (
            <Alert severity="info" sx={{ mb: 3 }}>
              This is a global template and cannot be edited. Please duplicate the template to create your own copy that you can edit.
            </Alert>
          )}
          {editingMetadata ? (
            <Box sx={{ maxWidth: 800 }}>
              <TextField
                fullWidth
                label="Template Name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                required
                margin="normal"
                disabled={template?.is_publicly_available}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Description"
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                multiline
                rows={3}
                margin="normal"
                disabled={template?.is_publicly_available}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Category"
                value={templateCategory}
                onChange={(e) => setTemplateCategory(e.target.value)}
                placeholder="e.g., SaaS, E-commerce, Mobile App"
                margin="normal"
                disabled={template?.is_publicly_available}
                sx={{ mb: 2 }}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={templateIsPublic}
                    onChange={(e) => setTemplateIsPublic(e.target.checked)}
                    disabled={template?.is_publicly_available}
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': {
                        color: theme.palette.text.primary,
                      },
                    }}
                  />
                }
                label="Make template public (visible to all users)"
                sx={{ color: theme.palette.text.secondary, mb: 3 }}
              />
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant="outlined"
                  startIcon={<SaveIcon />}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (template?.is_publicly_available) {
                      showError('Cannot edit global templates. Please duplicate the template to create your own copy.');
                      return;
                    }
                    handleSaveMetadata();
                  }}
                  disabled={savingMetadata || !templateName.trim() || template?.is_publicly_available}
                  onMouseDown={(e) => {
                    if (template?.is_publicly_available) {
                      e.preventDefault();
                      e.stopPropagation();
                    }
                  }}
                  sx={{
                    borderColor: theme.palette.text.primary,
                    color: theme.palette.text.primary,
                    fontWeight: 600,
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
                  {savingMetadata ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setEditingMetadata(false);
                    // Reset to original values
                    if (template) {
                      setTemplateName(template.name || '');
                      setTemplateDescription(template.description || '');
                      setTemplateCategory(template.category || '');
                      setTemplateIsPublic(template.is_public || false);
                    }
                  }}
                  disabled={savingMetadata}
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
                  Cancel
                </Button>
              </Box>
            </Box>
          ) : (
            <Box sx={{ maxWidth: 800 }}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                  Template Name
                </Typography>
                <Typography variant="body1" sx={{ color: 'text.primary' }}>
                  {template?.name || 'N/A'}
                </Typography>
              </Box>
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                  Description
                </Typography>
                <Typography variant="body1" sx={{ color: 'text.primary' }}>
                  {template?.description || 'No description'}
                </Typography>
              </Box>
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                  Category
                </Typography>
                <Typography variant="body1" sx={{ color: 'text.primary' }}>
                  {template?.category || 'No category'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                  Visibility
                </Typography>
                <Typography variant="body1" sx={{ color: 'text.primary' }}>
                  {template?.is_public ? 'Public' : 'Private'}
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
      );
    }

    // Tab 1 is Phase Management
    if (activeTab === 1) {
      return <PhaseManager templateId={templateId} onPhasesChange={handlePhasesChange} />;
    }

    return null;
  };

  // Show loading while role is being checked
  if (roleLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress sx={{ color: theme.palette.text.primary }} />
      </Box>
    );
  }

  // Allow admins and PMs to edit templates
  if (role !== 'admin' && role !== 'pm') {
    return null;
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress sx={{ color: theme.palette.text.primary }} />
      </Box>
    );
  }

  if (error || !template) {
    return (
      <Box sx={{ mt: 4 }}>
        <Alert 
          severity="error"
          sx={{
            backgroundColor: theme.palette.action.hover,
            border: `1px solid ${theme.palette.divider}`,
            color: theme.palette.text.primary,
          }}
        >
          {error || 'Template not found'}
        </Alert>
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4, px: { xs: 0, md: 3 } }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton
          onClick={() => router.push('/admin/templates')}
          sx={{
            color: theme.palette.text.primary,
            border: `1px solid ${theme.palette.divider}`,
            '&:hover': {
              backgroundColor: theme.palette.action.hover,
            },
          }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography
          variant="h4"
          component="h1"
          sx={{
            flex: 1,
            fontSize: '1.5rem',
            fontWeight: 600,
            color: theme.palette.text.primary,
          }}
        >
          Edit Template: {template.name}
        </Typography>
      </Box>

      {/* Template Overview Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            sx={{
              p: 2,
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
              Template Name
            </Typography>
            <Typography variant="body1" sx={{ color: theme.palette.text.primary, fontWeight: 500 }}>
              {template.name}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            sx={{
              p: 2,
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
              Category
            </Typography>
            <Typography variant="body1" sx={{ color: theme.palette.text.primary }}>
              {template.category || 'No category'}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            sx={{
              p: 2,
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
              Visibility
            </Typography>
            <Chip
              label={template.is_public ? 'Public' : 'Private'}
              size="small"
              sx={{
                backgroundColor: theme.palette.action.hover,
                color: theme.palette.text.primary,
                border: `1px solid ${theme.palette.divider}`,
              }}
            />
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            sx={{
              p: 2,
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
              Phases
            </Typography>
            <Typography variant="body1" sx={{ color: theme.palette.text.primary }}>
              {templatePhases.length} phase{templatePhases.length !== 1 ? 's' : ''}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: theme.palette.divider, mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            '& .MuiTab-root': {
              color: theme.palette.text.secondary,
              '&.Mui-selected': {
                color: theme.palette.text.primary,
              },
            },
            '& .MuiTabs-indicator': {
              backgroundColor: theme.palette.text.primary,
            },
          }}
        >
          <Tab key="template-settings" label="Template Settings" />
          <Tab key="phase-management" label="Phase Management" />
        </Tabs>
      </Box>

      {/* Tab Content */}
      <Paper
        sx={{
          p: 3,
          backgroundColor: theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`,
        }}
      >
        {renderContent()}
      </Paper>
    </Container>
  );
}

