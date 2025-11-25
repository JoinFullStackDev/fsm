'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Container,
  Box,
  Typography,
  Button,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  IconButton,
  Paper,
  Divider,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import { useRole } from '@/lib/hooks/useRole';
import TemplateBasedPhaseForm from '@/components/phases/TemplateBasedPhaseForm';
import type { ProjectTemplate } from '@/types/project';
import type { TemplateFieldConfig, TemplateFieldGroup } from '@/types/templates';

const PHASE_NAMES = [
  'Concept Framing',
  'Product Strategy',
  'Rapid Prototype Definition',
  'Analysis & User Stories',
  'Build Accelerator',
  'QA & Hardening',
];

export default function TemplatePreviewPage() {
  const router = useRouter();
  const params = useParams();
  const templateId = params.id as string;
  const supabase = createSupabaseClient();
  const { role, loading: roleLoading } = useRole();

  const [template, setTemplate] = useState<ProjectTemplate | null>(null);
  const [activePhase, setActivePhase] = useState(1);
  const [fields, setFields] = useState<Record<number, TemplateFieldConfig[]>>({});
  const [fieldGroups, setFieldGroups] = useState<Record<number, TemplateFieldGroup[]>>({});
  const [previewData, setPreviewData] = useState<Record<number, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTemplate = useCallback(async () => {
    setLoading(true);
    
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

    const { data: fieldConfigs, error: configsError } = await supabase
      .from('template_field_configs')
      .select('*')
      .eq('template_id', templateId)
      .order('phase_number', { ascending: true })
      .order('display_order', { ascending: true });

    if (configsError) {
      console.error('Error loading field configs:', configsError);
    }

    const { data: groups, error: groupsError } = await supabase
      .from('template_field_groups')
      .select('*')
      .eq('template_id', templateId)
      .order('phase_number', { ascending: true })
      .order('display_order', { ascending: true });

    if (groupsError) {
      console.error('Error loading field groups:', groupsError);
    }

    const fieldsByPhase: Record<number, TemplateFieldConfig[]> = {};
    const groupsByPhase: Record<number, TemplateFieldGroup[]> = {};
    const initialDataByPhase: Record<number, any> = {};
    
    for (let i = 1; i <= 6; i++) {
      fieldsByPhase[i] = [];
      groupsByPhase[i] = [];
      initialDataByPhase[i] = {};
    }

    fieldConfigs?.forEach((config) => {
      if (!fieldsByPhase[config.phase_number]) {
        fieldsByPhase[config.phase_number] = [];
      }
      fieldsByPhase[config.phase_number].push(config as TemplateFieldConfig);
      
      // Initialize preview data with default values
      if (!initialDataByPhase[config.phase_number]) {
        initialDataByPhase[config.phase_number] = {};
      }
      
      // Set default values based on field type
      const fieldKey = config.field_key;
      const fieldConfig = config.field_config;
      
      if (fieldConfig.defaultValue !== undefined) {
        initialDataByPhase[config.phase_number][fieldKey] = fieldConfig.defaultValue;
      } else {
        // Set empty defaults based on field type
        switch (config.field_type) {
          case 'text':
          case 'textarea':
            initialDataByPhase[config.phase_number][fieldKey] = '';
            break;
          case 'array':
            initialDataByPhase[config.phase_number][fieldKey] = [];
            break;
          case 'checkbox':
            initialDataByPhase[config.phase_number][fieldKey] = false;
            break;
          case 'select':
            initialDataByPhase[config.phase_number][fieldKey] = '';
            break;
          case 'custom':
            // For custom fields, initialize based on field_key
            if (['personas', 'jtbd', 'features', 'scored_features', 'screens', 'flows', 'components', 'entities', 'api_spec', 'user_stories', 'acceptance_criteria', 'test_cases'].includes(fieldKey)) {
              initialDataByPhase[config.phase_number][fieldKey] = [];
            } else if (['design_tokens', 'erd', 'rbac', 'navigation'].includes(fieldKey)) {
              initialDataByPhase[config.phase_number][fieldKey] = fieldKey === 'navigation' 
                ? { primary_nav: [], secondary_nav: [], route_map: {} }
                : {};
            } else {
              initialDataByPhase[config.phase_number][fieldKey] = {};
            }
            break;
          default:
            initialDataByPhase[config.phase_number][fieldKey] = '';
        }
      }
    });

    groups?.forEach((group) => {
      if (!groupsByPhase[group.phase_number]) {
        groupsByPhase[group.phase_number] = [];
      }
      groupsByPhase[group.phase_number].push(group as TemplateFieldGroup);
    });

    setFields(fieldsByPhase);
    setFieldGroups(groupsByPhase);
    setPreviewData(initialDataByPhase);
    setLoading(false);
  }, [templateId, supabase]);

  useEffect(() => {
    if (roleLoading) {
      return;
    }

    if (role !== 'admin') {
      router.push('/dashboard');
      return;
    }
    loadTemplate();
  }, [templateId, role, roleLoading, router, loadTemplate]);

  if (roleLoading || loading) {
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

  const currentFields = fields[activePhase] || [];
  const sortedFields = [...currentFields].sort((a, b) => a.display_order - b.display_order);

  return (
    <>
      <Box sx={{ backgroundColor: '#0A0E27', minHeight: '100vh', pb: 4 }}>
        <Container maxWidth="lg" sx={{ pt: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <IconButton
              onClick={() => router.push(`/admin/templates/${templateId}/builder`)}
              sx={{
                color: '#00E5FF',
                border: '1px solid',
                borderColor: '#00E5FF',
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
              Template Preview: {template.name}
            </Typography>
          </Box>

          <Paper
            sx={{
              mb: 3,
              backgroundColor: '#121633',
              border: '1px solid',
              borderColor: 'primary.main',
            }}
          >
            <Tabs
              value={activePhase - 1}
              onChange={(_, newValue) => setActivePhase(newValue + 1)}
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
              {PHASE_NAMES.map((name, index) => (
                <Tab key={index + 1} label={`Phase ${index + 1}: ${name}`} />
              ))}
            </Tabs>
          </Paper>

          <Paper
            sx={{
              p: 4,
              backgroundColor: '#121633',
              border: '1px solid',
              borderColor: 'primary.main',
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6" sx={{ color: 'primary.main' }}>
                Phase {activePhase} Preview
              </Typography>
              <Button
                startIcon={<RefreshIcon />}
                onClick={() => {
                  // Reset preview data to defaults
                  const resetData: Record<number, any> = {};
                  for (let phaseNum = 1; phaseNum <= 6; phaseNum++) {
                    resetData[phaseNum] = {};
                    const phaseFields = fields[phaseNum] || [];
                    phaseFields.forEach(field => {
                      const fieldKey = field.field_key;
                      const fieldConfig = field.field_config || {};
                      
                      if (fieldConfig.defaultValue !== undefined) {
                        resetData[phaseNum][fieldKey] = fieldConfig.defaultValue;
                      } else {
                        switch (field.field_type) {
                          case 'text':
                          case 'textarea':
                            resetData[phaseNum][fieldKey] = '';
                            break;
                          case 'array':
                            resetData[phaseNum][fieldKey] = [];
                            break;
                          case 'checkbox':
                            resetData[phaseNum][fieldKey] = false;
                            break;
                          case 'select':
                            resetData[phaseNum][fieldKey] = '';
                            break;
                          case 'custom':
                            if (['personas', 'jtbd', 'features', 'scored_features', 'screens', 'flows', 'components', 'entities', 'api_spec', 'user_stories', 'acceptance_criteria', 'test_cases'].includes(fieldKey)) {
                              resetData[phaseNum][fieldKey] = [];
                            } else if (['design_tokens', 'erd', 'rbac', 'navigation'].includes(fieldKey)) {
                              resetData[phaseNum][fieldKey] = fieldKey === 'navigation' 
                                ? { primary_nav: [], secondary_nav: [], route_map: {} }
                                : {};
                            } else {
                              resetData[phaseNum][fieldKey] = {};
                            }
                            break;
                          default:
                            resetData[phaseNum][fieldKey] = '';
                        }
                      }
                    });
                  }
                  setPreviewData(resetData);
                }}
                size="small"
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
                Reset Preview
              </Button>
            </Box>

            {sortedFields.length === 0 ? (
              <Alert severity="info">
                No fields configured for this phase yet. Go back to the builder to add fields.
              </Alert>
            ) : (
              <Box>
                <Alert severity="info" sx={{ mb: 3, backgroundColor: 'rgba(0, 229, 255, 0.1)', borderColor: 'primary.main' }}>
                  <Typography variant="body2">
                    This is a live preview of how the form will appear to users. You can interact with the fields to test the template.
                  </Typography>
                </Alert>
                <TemplateBasedPhaseForm
                  templateId={templateId}
                  phaseNumber={activePhase}
                  data={previewData[activePhase] || {}}
                  onChange={(newData) => {
                    setPreviewData(prev => ({
                      ...prev,
                      [activePhase]: newData,
                    }));
                  }}
                />
              </Box>
            )}
          </Paper>
        </Container>
      </Box>
    </>
  );
}

