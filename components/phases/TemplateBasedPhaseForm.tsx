'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Grid, Box, Typography, Alert, Paper } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useSupabaseClient } from '@/lib/supabaseClient';
import type { TemplateFieldConfig, TemplateFieldGroup } from '@/types/templates';
import {
  TemplateTextField,
  TextareaField,
  ArrayField,
  SelectField,
  CheckboxField,
  TableField,
  CustomField,
  SliderField,
  DateField,
  FileField,
} from '@/components/templates/fields';
import { evaluateConditionalLogic } from '@/lib/templates/conditionalLogic';
import FieldGroup from '@/components/templates/FieldGroup';
import TemplateSyncIndicator from '@/components/phases/TemplateSyncIndicator';
import HelpTooltip from '@/components/ui/HelpTooltip';
import logger from '@/lib/utils/logger';

// Phase data is dynamic JSONB from database, so Record<string, unknown> is appropriate
type PhaseData = Record<string, unknown>;

/**
 * Props for TemplateBasedPhaseForm component
 */
interface TemplateBasedPhaseFormProps {
  /** The ID of the template to use for field configuration */
  templateId: string;
  /** The phase number (1-based) */
  phaseNumber: number;
  /** Current phase data (key-value pairs) */
  data: PhaseData;
  /** Callback when phase data changes */
  onChange: (data: PhaseData) => void;
}

/**
 * Template-Based Phase Form Component
 * 
 * Dynamically renders form fields based on template field configurations stored in the database.
 * Supports conditional logic, field grouping, and various field types (text, textarea, select, etc.).
 * 
 * Features:
 * - Auto-loads field configurations from database
 * - Supports field grouping and conditional visibility
 * - Handles field value updates with debouncing
 * - Displays loading and error states
 * 
 * @param props - Component props
 * 
 * @example
 * ```tsx
 * <TemplateBasedPhaseForm
 *   templateId="template-123"
 *   phaseNumber={1}
 *   data={phaseData}
 *   onChange={(newData) => setPhaseData(newData)}
 * />
 * ```
 */
export default function TemplateBasedPhaseForm({
  templateId,
  phaseNumber,
  data,
  onChange,
}: TemplateBasedPhaseFormProps) {
  const theme = useTheme();
  const [fieldConfigs, setFieldConfigs] = useState<TemplateFieldConfig[]>([]);
  const [fieldGroups, setFieldGroups] = useState<TemplateFieldGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = useSupabaseClient();

  useEffect(() => {
    // Prevent loading if we don't have required props
    if (!templateId || !phaseNumber) {
      logger.warn('[TemplateBasedPhaseForm] Missing templateId or phaseNumber, skipping load');
      return;
    }
    
    logger.debug('[TemplateBasedPhaseForm] useEffect triggered, loading field configs', { templateId, phaseNumber });
    loadFieldConfigs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId, phaseNumber]);

  const loadFieldConfigs = async () => {
    setLoading(true);
    setError(null);

    logger.debug('[TemplateBasedPhaseForm] Loading field configs for template:', templateId, 'phase:', phaseNumber);
    logger.debug('[TemplateBasedPhaseForm] Query params:', {
      template_id: templateId,
      phase_number: phaseNumber,
      templateIdType: typeof templateId,
      phaseNumberType: typeof phaseNumber
    });

    const [configsResult, groupsResult] = await Promise.all([
      supabase
        .from('template_field_configs')
        .select('*')
        .eq('template_id', templateId)
        .eq('phase_number', phaseNumber)
        .order('display_order', { ascending: true }),
      supabase
        .from('template_field_groups')
        .select('*')
        .eq('template_id', templateId)
        .eq('phase_number', phaseNumber)
        .order('display_order', { ascending: true }),
    ]);

    logger.debug('[TemplateBasedPhaseForm] Query results:', {
      configsError: configsResult.error?.message,
      configsCount: configsResult.data?.length || 0,
      groupsError: groupsResult.error?.message,
      groupsCount: groupsResult.data?.length || 0,
      rawConfigs: configsResult.data
    });

    if (configsResult.error) {
      logger.error('[TemplateBasedPhaseForm] Error loading configs:', configsResult.error);
      setError(`Failed to load field configurations: ${configsResult.error.message}`);
      setLoading(false);
      return;
    }

    if (groupsResult.error) {
      logger.warn('[TemplateBasedPhaseForm] Error loading groups:', groupsResult.error);
    }

    logger.debug('[TemplateBasedPhaseForm] Loaded', configsResult.data?.length || 0, 'field configs');
    logger.debug('[TemplateBasedPhaseForm] Field configs:', configsResult.data?.map(f => ({ key: f.field_key, order: f.display_order })));

    // Deduplicate field configs by field_key (in case of duplicates in database)
    const uniqueFieldConfigs = (configsResult.data || []).reduce((acc: TemplateFieldConfig[], field) => {
      // Check if we already have this field_key
      const existingIndex = acc.findIndex(f => f.field_key === field.field_key);
      if (existingIndex === -1) {
        // New field, add it
        acc.push(field);
      } else {
        // Duplicate found - keep the one with the lower display_order or later id
        const existing = acc[existingIndex];
        if (field.display_order < existing.display_order || 
            (field.display_order === existing.display_order && field.id && existing.id && field.id > existing.id)) {
          acc[existingIndex] = field; // Replace with the better one
        }
      }
      return acc;
    }, [] as TemplateFieldConfig[]);

    logger.debug('[TemplateBasedPhaseForm] After deduplication:', uniqueFieldConfigs.length, 'unique field configs');

    setFieldConfigs(uniqueFieldConfigs as TemplateFieldConfig[]);
    setFieldGroups((groupsResult.data || []) as TemplateFieldGroup[]);
    setLoading(false);
  };

  const updateField = useCallback((fieldKey: string, value: unknown) => {
    onChange({ ...data, [fieldKey]: value });
  }, [data, onChange]);

  const getFieldValue = useCallback((fieldKey: string): unknown => {
    return data?.[fieldKey] ?? undefined;
  }, [data]);

  const renderField = useCallback((field: TemplateFieldConfig) => {
    // Check conditional logic
    const shouldShow = evaluateConditionalLogic(field, data);
    if (!shouldShow) {
      logger.debug('[TemplateBasedPhaseForm] Field hidden by conditional logic:', {
        fieldKey: field.field_key,
        fieldLabel: field.field_config?.label,
        conditionalLogic: field.conditional_logic
      });
      return null; // Field is hidden by conditional logic
    }

    const value = getFieldValue(field.field_key);
    const columns = field.layout_config?.columns || 12;
    const spacing = field.layout_config?.spacing || 2;

    const handleChange = (newValue: unknown) => {
      updateField(field.field_key, newValue);
    };

    let fieldElement: React.ReactNode;
    switch (field.field_type) {
      case 'text':
        fieldElement = (
          <TemplateTextField
            field={field}
            value={value as string}
            onChange={handleChange}
            phaseData={data}
          />
        );
        break;
      case 'textarea':
        fieldElement = (
          <TextareaField
            field={field}
            value={value as string}
            onChange={handleChange}
            phaseData={data}
          />
        );
        break;
      case 'array':
        fieldElement = (
          <ArrayField
            field={field}
            value={value as string[]}
            onChange={handleChange}
            phaseData={data}
          />
        );
        break;
      case 'select':
        fieldElement = (
          <SelectField
            field={field}
            value={value as string}
            onChange={handleChange}
            phaseData={data}
          />
        );
        break;
      case 'checkbox':
        fieldElement = (
          <CheckboxField
            field={field}
            value={value as boolean}
            onChange={handleChange}
            phaseData={data}
          />
        );
        break;
      case 'table':
        fieldElement = (
          <TableField
            field={field}
            value={value}
            onChange={handleChange}
            phaseData={data}
          />
        );
        break;
      case 'slider':
        fieldElement = (
          <SliderField
            field={field}
            value={value as number | null}
            onChange={handleChange}
            phaseData={data}
          />
        );
        break;
      case 'date':
        fieldElement = (
          <DateField
            field={field}
            value={value as string | null}
            onChange={handleChange}
            phaseData={data}
          />
        );
        break;
      case 'file':
        fieldElement = (
          <FileField
            field={field}
            value={value as string | null}
            onChange={handleChange}
            phaseData={data}
          />
        );
        break;
      case 'custom':
      case 'object':
        fieldElement = (
          <CustomField
            field={field}
            value={value}
            onChange={handleChange}
            phaseData={data}
          />
        );
        break;
      default:
        return (
          <Grid item xs={12} key={field.id || field.field_key}>
            <Alert severity="warning">
              Unknown field type: {field.field_type} for field {field.field_config.label}
            </Alert>
          </Grid>
        );
    }

    // Map columns (1-12) to MUI Grid system
    // columns: 12 = full width (xs=12), 6 = half width (xs=6), 4 = third width (xs=4), etc.
    const gridColumns = columns; // Direct mapping since MUI uses 12-column system
    
    return (
      <Grid 
        item 
        xs={gridColumns} 
        key={field.id || field.field_key}
        sx={{
          px: 1, // Add horizontal padding to all fields for consistent alignment
          display: 'flex', // Use flexbox to ensure matching heights
        }}
      >
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            mb: 2,
            width: '100%', // Take full width of Grid item
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 2,
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              borderColor: theme.palette.text.primary,
              backgroundColor: theme.palette.action.hover,
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Typography
              variant="h3"
              component="h3"
              sx={{
                fontSize: '1.25rem',
                fontWeight: 600,
                fontFamily: 'var(--font-rubik), Rubik, sans-serif',
                color: theme.palette.text.primary,
              }}
            >
              {field.field_config.label}
              {field.field_config.required && (
                <Typography component="span" sx={{ color: theme.palette.error.main, fontSize: '1.25rem' }}>
                  {' '}*
                </Typography>
              )}
            </Typography>
            {field.field_config.helpText && (
              <HelpTooltip title={field.field_config.helpText} />
            )}
          </Box>
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {fieldElement}
          </Box>
        </Paper>
      </Grid>
    );
  }, [data, updateField, getFieldValue]);

  if (loading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography sx={{ color: theme.palette.text.primary }}>Loading form fields...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert 
        severity="error" 
        sx={{ 
          m: 2,
          backgroundColor: theme.palette.action.hover,
          border: `1px solid ${theme.palette.divider}`,
          color: theme.palette.text.primary,
        }}
      >
        {error}
      </Alert>
    );
  }

  if (fieldConfigs.length === 0) {
    return (
      <Alert 
        severity="info" 
        sx={{ 
          m: 2,
          backgroundColor: theme.palette.action.hover,
          border: `1px solid ${theme.palette.divider}`,
          color: theme.palette.text.primary,
        }}
      >
        No fields configured for this phase in the template. Using default form.
      </Alert>
    );
  }

  // Use default spacing - we'll handle spacing via Paper margins instead
  const defaultSpacing = 0; // No gap, spacing handled by Paper margins

  // Group fields by group_id, ensuring no duplicates
  const fieldsByGroup = fieldConfigs.reduce((acc, field) => {
    const groupId = field.group_id || 'ungrouped';
    if (!acc[groupId]) {
      acc[groupId] = [];
    }
    // Check if this field_key already exists in this group
    const exists = acc[groupId].some(f => f.field_key === field.field_key);
    if (!exists) {
      acc[groupId].push(field);
    } else {
      console.warn('[TemplateBasedPhaseForm] Duplicate field_key detected:', field.field_key, 'in group:', groupId);
    }
    return acc;
  }, {} as Record<string, TemplateFieldConfig[]>);

  // Render fields grouped or ungrouped
  const renderFields = () => {
    const ungroupedFields = fieldsByGroup['ungrouped'] || [];
    const groupedFields = Object.entries(fieldsByGroup).filter(([key]) => key !== 'ungrouped');

    logger.debug('[TemplateBasedPhaseForm] Rendering fields:', {
      totalConfigs: fieldConfigs.length,
      ungroupedCount: ungroupedFields.length,
      groupedCount: groupedFields.length,
      allFieldKeys: fieldConfigs.map(f => f.field_key),
      ungroupedKeys: ungroupedFields.map(f => f.field_key),
      groupedKeys: groupedFields.flatMap(([_, fields]) => fields.map(f => f.field_key)),
      groupsByKey: Object.keys(fieldsByGroup)
    });

    return (
      <>
        {/* Render ungrouped fields */}
        {ungroupedFields.length > 0 && (
          <Grid container spacing={0} sx={{ mb: 1, alignItems: 'stretch' }}>
            {ungroupedFields
              .map((field) => {
                const rendered = renderField(field);
                if (rendered === null) {
                  logger.debug('[TemplateBasedPhaseForm] Ungrouped field not rendered:', field.field_key);
                }
                return rendered;
              })
              .filter((rendered) => rendered !== null)}
          </Grid>
        )}

        {/* Render grouped fields */}
        {groupedFields.map(([groupId, fields]) => {
          const group = fieldGroups.find(g => g.group_key === groupId);
          if (!group) {
            // Group not found, render as ungrouped
            return (
              <Grid container spacing={0} key={groupId} sx={{ mb: 1, alignItems: 'stretch' }}>
                {fields.map((field) => renderField(field))}
              </Grid>
            );
          }

          const visibleFields = fields
            .map((field) => {
              const rendered = renderField(field);
              if (rendered === null) {
                logger.debug('[TemplateBasedPhaseForm] Grouped field not rendered:', {
                  fieldKey: field.field_key,
                  groupId: groupId
                });
              }
              return rendered;
            })
            .filter((rendered) => rendered !== null);
          
          if (visibleFields.length === 0) {
            logger.debug('[TemplateBasedPhaseForm] No visible fields in group:', groupId);
            return null; // No visible fields in this group
          }

          return (
            <FieldGroup key={groupId} group={group}>
              <Grid container spacing={0} sx={{ alignItems: 'stretch' }}>
                {visibleFields}
              </Grid>
            </FieldGroup>
          );
        })}
      </>
    );
  };

  // Expose refresh function via useImperativeHandle or just use the callback directly
  const handleRefresh = () => {
    console.log('[TemplateBasedPhaseForm] Manual refresh triggered');
    loadFieldConfigs();
  };

  return (
    <Box sx={{ p: 3 }}>
      <TemplateSyncIndicator
        templateId={templateId}
        onRefresh={handleRefresh}
      />
      <Box sx={{ mt: 2 }}>
        {renderFields()}
      </Box>
    </Box>
  );
}

