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
import { useTheme } from '@mui/material/styles';
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
  const theme = useTheme();
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
      const fieldConfigs = data.fieldConfigs || [];
      const groups = data.fieldGroups || [];

      setTemplate(templateData);

      const fieldsByPhase: Record<number, TemplateFieldConfig[]> = {};
      const groupsByPhase: Record<number, TemplateFieldGroup[]> = {};
      const initialDataByPhase: Record<number, any> = {};
      
      for (let i = 1; i <= 6; i++) {
        fieldsByPhase[i] = [];
        groupsByPhase[i] = [];
        initialDataByPhase[i] = {};
      }

      fieldConfigs?.forEach((config: TemplateFieldConfig) => {
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
          case 'erd':
            // ERD has structured data with entities and relationships
            initialDataByPhase[config.phase_number][fieldKey] = { entities: [], relationships: [] };
            break;
          case 'custom':
            // For custom fields, initialize based on field_key
            if (['personas', 'jtbd', 'features', 'scored_features', 'screens', 'flows', 'components', 'entities', 'api_spec', 'user_stories', 'acceptance_criteria', 'test_cases'].includes(fieldKey)) {
              initialDataByPhase[config.phase_number][fieldKey] = [];
            } else if (['design_tokens', 'erd', 'rbac', 'navigation'].includes(fieldKey)) {
              initialDataByPhase[config.phase_number][fieldKey] = fieldKey === 'navigation' 
                ? { primary_nav: [], secondary_nav: [], route_map: {} }
                : fieldKey === 'erd'
                ? { entities: [], relationships: [] }
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

      groups?.forEach((group: TemplateFieldGroup) => {
        if (!groupsByPhase[group.phase_number]) {
          groupsByPhase[group.phase_number] = [];
        }
        groupsByPhase[group.phase_number].push(group);
      });

      setFields(fieldsByPhase);
      setFieldGroups(groupsByPhase);
      setPreviewData(initialDataByPhase);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load template');
    } finally {
      setLoading(false);
    }
  }, [templateId]);

  useEffect(() => {
    if (roleLoading) {
      return;
    }

    // Allow admins and PMs to preview templates
    if (role !== 'admin' && role !== 'pm') {
      router.push('/dashboard');
      return;
    }
    loadTemplate();
  }, [templateId, role, roleLoading, router, loadTemplate]);

  if (roleLoading || loading) {
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

  const currentFields = fields[activePhase] || [];
  const sortedFields = [...currentFields].sort((a, b) => a.display_order - b.display_order);

  return (
    <Box sx={{ pb: 4 }}>
      <Container maxWidth="lg" sx={{ pt: 4, px: { xs: 0, md: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <IconButton
            onClick={() => router.push(`/admin/templates/${templateId}/builder`)}
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
              fontFamily: 'var(--font-rubik), Rubik, sans-serif',
              color: theme.palette.text.primary,
            }}
          >
            Template Preview: {template.name}
          </Typography>
        </Box>

        <Paper
          sx={{
            mb: 3,
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Tabs
            value={activePhase - 1}
            onChange={(_, newValue) => setActivePhase(newValue + 1)}
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
            {PHASE_NAMES.map((name, index) => (
              <Tab key={index + 1} label={name} />
            ))}
          </Tabs>
        </Paper>

        <Paper
          sx={{
            p: 4,
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" sx={{ color: theme.palette.text.primary, fontWeight: 600, fontFamily: 'var(--font-rubik), Rubik, sans-serif' }}>
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
                borderColor: theme.palette.text.primary,
                color: theme.palette.text.primary,
                '&:hover': {
                  borderColor: theme.palette.text.primary,
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              Reset Preview
            </Button>
          </Box>

          {sortedFields.length === 0 ? (
            <Alert 
              severity="info"
              sx={{
                backgroundColor: theme.palette.action.hover,
                border: `1px solid ${theme.palette.divider}`,
                color: theme.palette.text.primary,
              }}
            >
              No fields configured for this phase yet. Go back to the builder to add fields.
            </Alert>
          ) : (
            <Box>
              <Alert 
                severity="info" 
                sx={{ 
                  mb: 3, 
                  backgroundColor: theme.palette.action.hover, 
                  border: `1px solid ${theme.palette.divider}`,
                  color: theme.palette.text.primary,
                }}
              >
                <Typography variant="body2" sx={{ color: theme.palette.text.primary }}>
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
  );
}

