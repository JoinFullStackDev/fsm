'use client';

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Grid, Box, Typography, Alert, Divider } from '@mui/material';
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
  ERDField,
} from '@/components/templates/fields';
import { evaluateConditionalLogic } from '@/lib/templates/conditionalLogic';
import FieldGroup from '@/components/templates/FieldGroup';
import TemplateSyncIndicator from '@/components/phases/TemplateSyncIndicator';
import HelpTooltip from '@/components/ui/HelpTooltip';
import logger from '@/lib/utils/logger';
import type { ERDData } from '@/types/phases';

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
  /** Callback when a field loses focus (for auto-save) */
  onBlur?: () => void;
  /** Pre-loaded field configs (bypasses RLS issues when passed from parent) */
  preloadedFieldConfigs?: TemplateFieldConfig[];
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
  onBlur,
  preloadedFieldConfigs,
}: TemplateBasedPhaseFormProps) {
  const theme = useTheme();
  const [fieldConfigs, setFieldConfigs] = useState<TemplateFieldConfig[]>([]);
  const [fieldGroups, setFieldGroups] = useState<TemplateFieldGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tableHeaderActions, setTableHeaderActions] = useState<Map<string, React.ReactNode>>(new Map());
  const supabase = useSupabaseClient();
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Prevent loading if we don't have required props
    if (!templateId || !phaseNumber) {
      logger.warn('[TemplateBasedPhaseForm] Missing templateId or phaseNumber, skipping load');
      return;
    }
    
    // If preloaded configs are provided, use them directly (bypasses RLS)
    if (preloadedFieldConfigs && preloadedFieldConfigs.length > 0) {
      logger.debug('[TemplateBasedPhaseForm] Using preloaded field configs', { 
        count: preloadedFieldConfigs.length,
        fieldKeys: preloadedFieldConfigs.map(f => f.field_key)
      });
      setFieldConfigs(preloadedFieldConfigs);
      setLoading(false);
      // Still load field groups from database (they typically have fewer RLS issues)
      loadFieldGroups();
      return;
    }
    
    logger.debug('[TemplateBasedPhaseForm] useEffect triggered, loading field configs', { templateId, phaseNumber });
    loadFieldConfigs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId, phaseNumber, preloadedFieldConfigs]);

  // Load only field groups (used when preloaded configs are provided)
  const loadFieldGroups = async () => {
    const { data: groupsData, error: groupsError } = await supabase
      .from('template_field_groups')
      .select('*')
      .eq('template_id', templateId)
      .eq('phase_number', phaseNumber)
      .order('display_order', { ascending: true });

    if (groupsError) {
      logger.warn('[TemplateBasedPhaseForm] Error loading groups:', groupsError);
    } else {
      setFieldGroups((groupsData || []) as TemplateFieldGroup[]);
    }
  };

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
    logger.debug('[TemplateBasedPhaseForm] Field configs:', configsResult.data?.map((f: any) => ({ key: f.field_key, order: f.display_order })));

    // Deduplicate field configs by field_key (in case of duplicates in database)
    const uniqueFieldConfigs = (configsResult.data || []).reduce((acc: TemplateFieldConfig[], field: any) => {
      // Check if we already have this field_key
      const existingIndex = acc.findIndex((f: TemplateFieldConfig) => f.field_key === field.field_key);
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

  const renderField = useCallback((field: TemplateFieldConfig, nextField?: TemplateFieldConfig) => {
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

    const handleBlur = () => {
      if (onBlur) {
        // Debounce blur events to avoid rapid-fire saves when tabbing between fields
        if (blurTimeoutRef.current) {
          clearTimeout(blurTimeoutRef.current);
        }
        blurTimeoutRef.current = setTimeout(() => {
          onBlur();
        }, 300); // Small delay to batch multiple blur events
      }
    };

    let fieldElement: React.ReactNode;
    switch (field.field_type) {
      case 'text':
        fieldElement = (
          <Box onBlur={handleBlur}>
            <TemplateTextField
              field={field}
              value={value as string}
              onChange={handleChange}
              phaseData={data}
            />
          </Box>
        );
        break;
      case 'textarea':
        fieldElement = (
          <Box onBlur={handleBlur}>
            <TextareaField
              field={field}
              value={value as string}
              onChange={handleChange}
              phaseData={data}
            />
          </Box>
        );
        break;
      case 'array':
        fieldElement = (
          <Box onBlur={handleBlur}>
            <ArrayField
              field={field}
              value={value as string[]}
              onChange={handleChange}
              phaseData={data}
            />
          </Box>
        );
        break;
      case 'select':
        fieldElement = (
          <Box onBlur={handleBlur}>
            <SelectField
              field={field}
              value={value as string}
              onChange={handleChange}
              phaseData={data}
            />
          </Box>
        );
        break;
      case 'checkbox':
        fieldElement = (
          <Box onBlur={handleBlur}>
            <CheckboxField
              field={field}
              value={value as boolean}
              onChange={handleChange}
              phaseData={data}
            />
          </Box>
        );
        break;
      case 'table': {
        // For table fields, we need to render header actions in the header
        // Use a stable callback that won't cause infinite loops
        const fieldKey = field.field_key;
        const setHeaderActions = (actions: React.ReactNode) => {
          setTableHeaderActions(prev => {
            const newMap = new Map(prev);
            // Only update if the actions actually changed
            if (newMap.get(fieldKey) !== actions) {
              newMap.set(fieldKey, actions);
              return newMap;
            }
            return prev; // Return same reference if unchanged
          });
        };
        fieldElement = (
          <Box onBlur={handleBlur}>
            <TableField
              field={field}
              value={value}
              onChange={handleChange}
              phaseData={data}
              renderHeaderActions={setHeaderActions}
            />
          </Box>
        );
        break;
      }
      case 'slider':
        fieldElement = (
          <Box onBlur={handleBlur}>
            <SliderField
              field={field}
              value={value as number | null}
              onChange={handleChange}
              phaseData={data}
            />
          </Box>
        );
        break;
      case 'date':
        fieldElement = (
          <Box onBlur={handleBlur}>
            <DateField
              field={field}
              value={value as string | null}
              onChange={handleChange}
              phaseData={data}
            />
          </Box>
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
      case 'erd':
        fieldElement = (
          <Box onBlur={handleBlur}>
            <ERDField
              field={field}
              value={value as ERDData | Record<string, unknown>}
              onChange={handleChange}
              phaseData={data}
            />
          </Box>
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
        xs={12}
        key={field.id || field.field_key}
        sx={{
          px: { xs: 2, md: 1 },
          display: 'flex',
          width: '100%',
        }}
      >
        <Box
          sx={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography
                variant="h3"
                component="h3"
                sx={{
                  fontSize: { xs: '1.125rem', md: '1.25rem' },
                  fontWeight: 600,
                  fontFamily: 'var(--font-rubik), Rubik, sans-serif',
                  color: theme.palette.text.primary,
                }}
              >
                {field.field_config.label}
                {field.field_config.required && (
                  <Typography component="span" sx={{ color: theme.palette.error.main, fontSize: { xs: '1.125rem', md: '1.25rem' } }}>
                    {' '}*
                  </Typography>
                )}
              </Typography>
              {field.field_config.helpText && (
                <HelpTooltip title={field.field_config.helpText} />
              )}
            </Box>
            {/* Render header actions for table fields */}
            {field.field_type === 'table' && tableHeaderActions.get(field.field_key) && (
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                {tableHeaderActions.get(field.field_key)}
              </Box>
            )}
          </Box>
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%', mb: { xs: 3, md: 2 } }}>
            {fieldElement}
          </Box>
          {nextField && (
            <Box
              sx={{
                position: 'relative',
                mt: { xs: 2, md: 3 },
                mb: { xs: 2, md: 3 },
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: '50%',
                  height: '1px',
                  borderTop: `2px dotted #FFFFFF`,
                  opacity: 0.6,
                }}
              />
              <Box
                sx={{
                  position: 'relative',
                  px: { xs: 2, md: 3 },
                  backgroundColor: theme.palette.background.default,
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    color: theme.palette.text.secondary,
                    fontSize: { xs: '0.75rem', md: '0.875rem' },
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  {nextField.field_config?.label || 'Next Section'}
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
      </Grid>
    );
  }, [data, updateField, getFieldValue, onBlur, tableHeaderActions, theme.palette.error.main, theme.palette.text.primary, theme.palette.background.default, theme.palette.text.secondary]);

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

    // Removed verbose debug log that was causing console clutter on every render

    return (
      <>
        {/* Render ungrouped fields */}
        {ungroupedFields.length > 0 && (
          <Box sx={{ mb: { xs: 2, md: 1 } }}>
            <Grid 
              container 
              spacing={0} 
              sx={{ 
                alignItems: 'stretch', 
                width: '100%',
              }}
            >
              {(() => {
                // Filter to visible fields first
                const visibleFields = ungroupedFields
                  .map((field) => {
                    const shouldShow = evaluateConditionalLogic(field, data);
                    return shouldShow ? field : null;
                  })
                  .filter((field): field is TemplateFieldConfig => field !== null);
                
                return visibleFields.map((field, index) => {
                  const nextField = index < visibleFields.length - 1 ? visibleFields[index + 1] : undefined;
                  return renderField(field, nextField);
                });
              })()}
            </Grid>
          </Box>
        )}

        {/* Render grouped fields */}
        {groupedFields.map(([groupId, fields]) => {
          const group = fieldGroups.find(g => g.group_key === groupId);
          if (!group) {
            // Group not found, render as ungrouped
            return (
              <Box key={groupId} sx={{ mb: { xs: 2, md: 1 } }}>
                <Grid 
                  container 
                  spacing={0} 
                  sx={{ 
                    alignItems: 'stretch', 
                    width: '100%',
                  }}
                >
                  {(() => {
                    // Filter to visible fields first
                    const visibleFields = fields
                      .map((field) => {
                        const shouldShow = evaluateConditionalLogic(field, data);
                        return shouldShow ? field : null;
                      })
                      .filter((field): field is TemplateFieldConfig => field !== null);
                    
                    return visibleFields.map((field, index) => {
                      const nextField = index < visibleFields.length - 1 ? visibleFields[index + 1] : undefined;
                      return renderField(field, nextField);
                    });
                  })()}
                </Grid>
              </Box>
            );
          }

          // First, filter to get visible fields with their indices
          const visibleFieldsWithIndices = fields
            .map((field, originalIndex) => {
              const rendered = renderField(field);
              if (rendered === null) {
                logger.debug('[TemplateBasedPhaseForm] Grouped field not rendered:', {
                  fieldKey: field.field_key,
                  groupId: groupId
                });
                return null;
              }
              return { field, originalIndex, rendered };
            })
            .filter((item) => item !== null) as Array<{ field: TemplateFieldConfig; originalIndex: number; rendered: React.ReactNode }>;
          
          if (visibleFieldsWithIndices.length === 0) {
            logger.debug('[TemplateBasedPhaseForm] No visible fields in group:', groupId);
            return null; // No visible fields in this group
          }

          // Render fields with next field info
          const renderedFields = visibleFieldsWithIndices.map((item, visibleIndex) => {
            const nextVisibleItem = visibleIndex < visibleFieldsWithIndices.length - 1 
              ? visibleFieldsWithIndices[visibleIndex + 1] 
              : null;
            const nextField = nextVisibleItem ? nextVisibleItem.field : undefined;
            
            // Re-render with next field info
            return renderField(item.field, nextField);
          });

          return (
            <Box key={groupId} sx={{ mb: { xs: 2, md: 1 } }}>
              <FieldGroup key={groupId} group={group}>
                <Grid 
                  container 
                  spacing={0} 
                  sx={{ 
                    alignItems: 'stretch', 
                    width: '100%',
                  }}
                >
                  {renderedFields}
                </Grid>
              </FieldGroup>
            </Box>
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
    <Box sx={{ width: '100%' }}>
      <Box sx={{ mb: { xs: 2, md: 3 }, mx: { xs: 2, md: 0 } }}>
        <TemplateSyncIndicator
          templateId={templateId}
          onRefresh={handleRefresh}
        />
      </Box>
      <Box sx={{ width: '100%' }}>
        {renderFields()}
      </Box>
    </Box>
  );
}

