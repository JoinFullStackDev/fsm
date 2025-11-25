'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Container,
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  IconButton,
  TextField,
  Switch,
  FormControlLabel,
} from '@mui/material';
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
    
    // Load template metadata
    const { data: templateData, error: templateError } = await supabase
      .from('project_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (templateError || !templateData) {
      setError(templateError?.message || 'Template not found');
      setLoading(false);
      return;
    }

    setTemplate(templateData);
    
    // Load template metadata for editing
    setTemplateName(templateData.name || '');
    setTemplateDescription(templateData.description || '');
    setTemplateCategory(templateData.category || '');
    setTemplateIsPublic(templateData.is_public || false);

    // Ensure phases exist (backward compatibility)
    const ensuredPhases = await ensurePhasesExist(templateId, supabase);

    // Load template phases (ordered by display_order, only active)
    const { data: phasesData, error: phasesError } = await supabase
      .from('template_phases')
      .select('*')
      .eq('template_id', templateId)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (phasesError) {
      setError(phasesError.message);
      setLoading(false);
      return;
    }

    // Store template phases (use loaded phases or fallback to ensured phases)
    const loadedPhases = (phasesData || ensuredPhases) as TemplatePhase[];
    setTemplatePhases(loadedPhases);

    setLoading(false);
  }, [templateId, supabase]);

  useEffect(() => {
    // Wait for role to load before checking
    if (roleLoading) {
      return;
    }

    if (role !== 'admin') {
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

    setSavingMetadata(true);
    try {
      const { error: updateError } = await supabase
        .from('project_templates')
        .update({
          name: templateName.trim(),
          description: templateDescription.trim(),
          category: templateCategory.trim(),
          is_public: templateIsPublic,
        })
        .eq('id', templateId);

      if (updateError) {
        throw updateError;
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
            <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 600 }}>
              Template Settings
            </Typography>
            {!editingMetadata && (
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={() => setEditingMetadata(true)}
                sx={{
                  borderColor: 'primary.main',
                  color: 'primary.main',
                  '&:hover': {
                    borderColor: 'primary.dark',
                    backgroundColor: 'rgba(0, 229, 255, 0.1)',
                  },
                }}
              >
                Edit
              </Button>
            )}
          </Box>

          {editingMetadata ? (
            <Box sx={{ maxWidth: 800 }}>
              <TextField
                fullWidth
                label="Template Name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                required
                margin="normal"
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
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Category"
                value={templateCategory}
                onChange={(e) => setTemplateCategory(e.target.value)}
                placeholder="e.g., SaaS, E-commerce, Mobile App"
                margin="normal"
                sx={{ mb: 2 }}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={templateIsPublic}
                    onChange={(e) => setTemplateIsPublic(e.target.checked)}
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': {
                        color: '#00E5FF',
                      },
                    }}
                  />
                }
                label="Make template public (visible to all users)"
                sx={{ color: '#B0B0B0', mb: 3 }}
              />
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={handleSaveMetadata}
                  disabled={savingMetadata || !templateName.trim()}
                  sx={{
                    backgroundColor: '#00E5FF',
                    color: '#000',
                    fontWeight: 600,
                    '&:hover': {
                      backgroundColor: '#00B2CC',
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
                    borderColor: '#B0B0B0',
                    color: '#B0B0B0',
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
      <>
        <Container>
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <CircularProgress />
          </Box>
        </Container>
      </>
    );
  }

  if (role !== 'admin') {
    return null;
  }

  if (loading) {
    return (
      <>
        <Container>
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <CircularProgress />
          </Box>
        </Container>
      </>
    );
  }

  if (error || !template) {
    return (
      <>
        <Container>
          <Alert severity="error" sx={{ mt: 4 }}>
            {error || 'Template not found'}
          </Alert>
        </Container>
      </>
    );
  }

  return (
    <>
      <Box sx={{ backgroundColor: '#0A0E27', minHeight: '100vh', pb: 4 }}>
        <Container maxWidth="xl" sx={{ pt: 4, pb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <IconButton
              onClick={() => router.push('/admin/templates')}
              sx={{
                color: '#00E5FF',
                border: '1px solid',
                borderColor: '#00E5FF',
                '&:hover': {
                  backgroundColor: 'rgba(0, 229, 255, 0.1)',
                },
              }}
            >
              <ArrowBackIcon />
            </IconButton>
            <Typography
              variant="h4"
              sx={{
                flex: 1,
                fontWeight: 700,
                background: 'linear-gradient(135deg, #00E5FF 0%, #E91E63 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Edit Template: {template.name}
            </Typography>
          </Box>

          <Card
            sx={{
              backgroundColor: '#121633',
              border: '1px solid rgba(0, 229, 255, 0.2)',
              borderRadius: 3,
            }}
          >
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs
                value={activeTab}
                onChange={(_, newValue) => setActiveTab(newValue)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{
                  '& .MuiTab-root': {
                    color: '#B0B0B0',
                    '&.Mui-selected': {
                      color: '#00E5FF',
                    },
                  },
                  '& .MuiTabs-indicator': {
                    backgroundColor: '#00E5FF',
                  },
                }}
              >
                <Tab key="template-settings" label="Template Settings" />
                <Tab key="phase-management" label="Phase Management" />
              </Tabs>
            </Box>
            <CardContent sx={{ pt: 3 }}>
              {renderContent()}
            </CardContent>
          </Card>
        </Container>
      </Box>
    </>
  );
}

