'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  Container,
  Box,
  Typography,
  Button,
  Tabs,
  Tab,
  Grid,
  CircularProgress,
  Alert,
  IconButton,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  Skeleton,
  Chip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Preview as PreviewIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import { useRole } from '@/lib/hooks/useRole';
import { useNotification } from '@/components/providers/NotificationProvider';
import { useOrganization } from '@/components/providers/OrganizationProvider';
import ComponentPalette from '@/components/templates/ComponentPalette';
import FieldCanvas from '@/components/templates/FieldCanvas';
import FieldConfigPanel from '@/components/templates/FieldConfigPanel';
import PhaseManager from '@/components/templates/PhaseManager';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { ensurePhasesExist } from '@/lib/templates/ensurePhasesExist';
import type { TemplateFieldConfig } from '@/types/templates';
import type { ProjectTemplate, TemplatePhase } from '@/types/project';

export default function TemplateBuilderPage() {
  const theme = useTheme();
  const router = useRouter();
  const params = useParams();
  const templateId = params.id as string;
  const supabase = createSupabaseClient();
  const { role, loading: roleLoading } = useRole();
  const { features } = useOrganization();
  const { showSuccess, showError } = useNotification();

  const [template, setTemplate] = useState<ProjectTemplate | null>(null);
  const [templatePhases, setTemplatePhases] = useState<TemplatePhase[]>([]);
  const [activePhase, setActivePhase] = useState(1);
  const [fields, setFields] = useState<Record<number, TemplateFieldConfig[]>>({});
  const [selectedField, setSelectedField] = useState<TemplateFieldConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [phaseManagerOpen, setPhaseManagerOpen] = useState(false);
  const [deleteFieldConfirm, setDeleteFieldConfirm] = useState<{ open: boolean; fieldId: string | null }>({
    open: false,
    fieldId: null,
  });
  const handleSaveRef = useRef<() => Promise<void>>();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
      const fieldConfigs = data.fieldConfigs || [];

      setTemplate(templateData);

      // Ensure phases exist (backward compatibility)
      const phases = await ensurePhasesExist(templateId, supabase);
      
      const loadedPhases = (phasesData.length > 0 ? phasesData : phases) as TemplatePhase[];
      setTemplatePhases(loadedPhases);

      // Set active phase to first phase if available
      if (loadedPhases.length > 0 && !loadedPhases.find(p => p.phase_number === activePhase)) {
        setActivePhase(loadedPhases[0].phase_number);
      }

      // Organize fields by phase - use actual phase numbers from loaded phases
      const fieldsByPhase: Record<number, TemplateFieldConfig[]> = {};
      
      // Initialize with actual phase numbers
      loadedPhases.forEach((phase) => {
        fieldsByPhase[phase.phase_number] = [];
      });

      // If no phases exist yet, check field configs for phase numbers
      if (loadedPhases.length === 0 && fieldConfigs) {
        const uniquePhaseNumbers = new Set<number>();
        fieldConfigs.forEach((config: TemplateFieldConfig) => {
          if (config.phase_number) {
            uniquePhaseNumbers.add(config.phase_number);
          }
        });
        uniquePhaseNumbers.forEach((phaseNumber) => {
          fieldsByPhase[phaseNumber] = [];
        });
      }

      fieldConfigs?.forEach((config: TemplateFieldConfig) => {
        if (!fieldsByPhase[config.phase_number]) {
          fieldsByPhase[config.phase_number] = [];
        }
        fieldsByPhase[config.phase_number].push(config);
      });

      setFields(fieldsByPhase);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load template');
    } finally {
      setLoading(false);
    }
  }, [templateId, supabase, activePhase]);

  useEffect(() => {
    if (roleLoading) {
      return; // Wait for role to load
    }

    // Check if template is global and prevent editing
    if (template?.is_publicly_available) {
      setError('Cannot edit global templates. Please duplicate the template to create your own copy.');
      return;
    }

    if (role !== 'admin') {
      router.push('/dashboard');
      return;
    }
    loadTemplate();
  }, [templateId, role, roleLoading, router, loadTemplate, template?.is_publicly_available]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    // Prevent editing global templates
    if (template?.is_publicly_available) {
      showError('Cannot edit global templates. Please duplicate the template to create your own copy.');
      return;
    }

    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    // Handle dropping component from palette
    if (active.data.current?.type === 'component' && over.data.current?.type === 'canvas') {
      const componentType = active.data.current.componentType;
      const phaseNumber = over.data.current.phaseNumber;

      // Generate unique field key
      const existingKeys = (fields[phaseNumber] || []).map(f => f.field_key);
      let fieldKey = `${componentType}_${Date.now()}`;
      let counter = 1;
      while (existingKeys.includes(fieldKey)) {
        fieldKey = `${componentType}_${Date.now()}_${counter}`;
        counter++;
      }

      // Create new field config with proper defaults
      const newField: Omit<TemplateFieldConfig, 'id' | 'created_at'> = {
        template_id: templateId,
        phase_number: phaseNumber,
        field_key: fieldKey,
        field_type: componentType,
        display_order: (fields[phaseNumber]?.length || 0) + 1,
        layout_config: { 
          columns: 12,
          spacing: 2,
          alignment: 'left',
        },
        field_config: {
          label: `New ${componentType.charAt(0).toUpperCase() + componentType.slice(1)} Field`,
          required: false,
          ...(componentType === 'select' && {
            options: [
              { label: 'Option 1', value: 'option1' },
              { label: 'Option 2', value: 'option2' },
            ],
          }),
          ...(componentType === 'slider' && {
            min: 0,
            max: 100,
            step: 1,
          }),
        },
      };

      const updatedFields = { ...fields };
      if (!updatedFields[phaseNumber]) {
        updatedFields[phaseNumber] = [];
      }
      updatedFields[phaseNumber].push(newField as TemplateFieldConfig);
      setFields(updatedFields);
      setSelectedField(newField as TemplateFieldConfig);
      return;
    }

    // Handle reordering fields
    if (active.data.current?.type === 'field' && over.data.current?.type === 'field') {
      const activeField = active.data.current.field as TemplateFieldConfig;
      const overField = over.data.current.field as TemplateFieldConfig;

      if (activeField.phase_number !== overField.phase_number) {
        return; // Can't move between phases yet
      }

      const phaseFields = fields[activeField.phase_number] || [];
      const oldIndex = phaseFields.findIndex(f => (f.id || f.field_key) === active.id);
      const newIndex = phaseFields.findIndex(f => (f.id || f.field_key) === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(phaseFields, oldIndex, newIndex);
        const updated = reordered.map((field, index) => ({
          ...field,
          display_order: index + 1,
        }));

        const updatedFields = { ...fields };
        updatedFields[activeField.phase_number] = updated;
        setFields(updatedFields);
      }
    }
  };

  const handleSave = async () => {
    // Check if template is global (cannot be edited)
    if (template?.is_publicly_available) {
      showError('Cannot edit global templates. Please duplicate the template to create your own copy.');
      return;
    }

    setSaving(true);
    try {
      // Validate fields before saving
      const allFields: TemplateFieldConfig[] = [];
      const phaseNumbers = templatePhases.length > 0 
        ? templatePhases.map(p => p.phase_number)
        : Object.keys(fields).map(Number);
      
      for (const phase of phaseNumbers) {
        const phaseFields = fields[phase] || [];
        phaseFields.forEach((field, index) => {
          if (!field.field_key || !field.field_config.label) {
            throw new Error(`Phase ${phase}: Field missing required field_key or label`);
          }
          
          // CRITICAL: Explicitly exclude id and created_at - use Object.keys to be absolutely sure
          const cleanField: any = {
            template_id: templateId,
            phase_number: phase,
            field_key: field.field_key,
            field_type: field.field_type,
            display_order: field.display_order || index + 1,
            layout_config: field.layout_config || {},
            field_config: field.field_config || { label: field.field_key },
          };
          
          // Only add optional fields if they exist
          if (field.conditional_logic !== undefined && field.conditional_logic !== null) {
            cleanField.conditional_logic = field.conditional_logic;
          }
          if (field.group_id !== undefined && field.group_id !== null) {
            cleanField.group_id = field.group_id;
          }
          
          // Explicitly verify id is NOT in the object
          if ('id' in cleanField || cleanField.id !== undefined || cleanField.id === null) {
            delete cleanField.id;
          }
          if ('created_at' in cleanField) {
            delete cleanField.created_at;
          }
          
          allFields.push(cleanField as TemplateFieldConfig);
        });
      }

      // Get existing field configs to determine which to update vs insert
      const { data: existingFields, error: fetchError } = await supabase
        .from('template_field_configs')
        .select('id, field_key, phase_number')
        .eq('template_id', templateId);

      if (fetchError) {
        throw new Error(`Failed to fetch existing fields: ${fetchError.message}`);
      }

      const existingFieldsMap = new Map<string, string>();
      existingFields?.forEach((field: TemplateFieldConfig) => {
        const key = `${field.phase_number}_${field.field_key}`;
        // Only add to map if id is a valid UUID string
        if (field.id && typeof field.id === 'string' && field.id.length > 0) {
          existingFieldsMap.set(key, field.id);
        }
      });

      // Separate fields into updates and inserts
      const fieldsToUpdate: any[] = [];
      const fieldsToInsert: any[] = [];
      
      allFields.forEach(field => {
        const lookupKey = `${field.phase_number}_${field.field_key}`;
        const existingId = existingFieldsMap.get(lookupKey);
        
        // SPECIAL HANDLING FOR TABLE FIELD - be extra careful
        const isTableField = field.field_key.includes('table_') || field.field_type === 'table';
        
        // Explicitly construct object WITHOUT id and created_at
        // Build from scratch - don't spread the field object at all
        const cleanField: Record<string, any> = {
          template_id: templateId, // Use templateId directly, not field.template_id
          phase_number: field.phase_number,
          field_key: field.field_key,
          field_type: field.field_type,
          display_order: field.display_order || 0,
          layout_config: field.layout_config || {},
          field_config: field.field_config || { label: field.field_key },
        };
        
        // Only add optional fields if they exist and are not null
        if (field.conditional_logic !== undefined && field.conditional_logic !== null) {
          cleanField.conditional_logic = field.conditional_logic;
        }
        
        if (field.group_id !== undefined && field.group_id !== null) {
          cleanField.group_id = field.group_id;
        }
        
        // CRITICAL: Explicitly ensure id and created_at are NOT in the object
        // Do this multiple times to be absolutely sure
        delete cleanField.id;
        delete cleanField.created_at;
        
        // For table fields, extra validation
        if (isTableField) {
          // Table field validation
        }
        
        // Ensure existingId is actually a valid UUID string, not null or undefined
        if (existingId && typeof existingId === 'string' && existingId.length > 0) {
          // Update existing field - include id separately for the update
          fieldsToUpdate.push({ id: existingId, ...cleanField });
        } else {
          // Insert new field (absolutely no id)
          // Triple-check cleanField doesn't have id
          if ('id' in cleanField || cleanField.id !== undefined || cleanField.id === null) {
            delete cleanField.id;
          }
          if ('created_at' in cleanField) {
            delete cleanField.created_at;
          }
          
          fieldsToInsert.push(cleanField);
        }
      });

      // Delete fields that are no longer in the template
      const fieldsToKeep = new Set(allFields.map((f: TemplateFieldConfig) => `${f.phase_number}_${f.field_key}`));
      const fieldsToDelete = existingFields?.filter((f: TemplateFieldConfig) => {
        const key = `${f.phase_number}_${f.field_key}`;
        return !fieldsToKeep.has(key);
      }) || [];

      if (fieldsToDelete.length > 0) {
        const idsToDelete = fieldsToDelete.map((f: TemplateFieldConfig) => f.id).filter((id: string | undefined): id is string => !!id);
        const { error: deleteError } = await supabase
          .from('template_field_configs')
          .delete()
          .in('id', idsToDelete);

        if (deleteError) {
          // Don't throw - continue with updates/inserts
        }
      }

      // Update existing fields
      if (fieldsToUpdate.length > 0) {
        for (const field of fieldsToUpdate) {
          const { id, ...updateData } = field;
          const { error: updateError } = await supabase
            .from('template_field_configs')
            .update(updateData)
            .eq('id', id);

          if (updateError) {
            throw new Error(`Failed to update field ${field.field_key}: ${updateError.message}`);
          }
        }
      }

      // Insert new fields
      if (fieldsToInsert.length > 0) {
        // Triple-check: Create completely new objects with only allowed fields
        const cleanedInserts = fieldsToInsert.map((f, index) => {
          // Create a completely new object with only the fields we want
          const cleaned: Record<string, any> = {
            template_id: f.template_id,
            phase_number: f.phase_number,
            field_key: f.field_key,
            field_type: f.field_type,
            display_order: f.display_order || 0,
            layout_config: f.layout_config || {},
            field_config: f.field_config || { label: f.field_key },
          };
          
          // Only add optional fields if they exist
          if (f.conditional_logic !== undefined && f.conditional_logic !== null) {
            cleaned.conditional_logic = f.conditional_logic;
          }
          
          if (f.group_id !== undefined && f.group_id !== null) {
            cleaned.group_id = f.group_id;
          }
          
          // Explicitly verify id is NOT in the object
          if ('id' in cleaned) {
            delete cleaned.id;
          }
          if ('created_at' in cleaned) {
            delete cleaned.created_at;
          }
          
          return cleaned;
        });

        // Final safety check: Create completely new objects with ONLY the fields we want
        // Use a whitelist approach - only include these specific fields
        const allowedFields = [
          'template_id',
          'phase_number',
          'field_key',
          'field_type',
          'display_order',
          'layout_config',
          'field_config',
          'conditional_logic',
          'group_id',
        ];

        const finalInserts = cleanedInserts.map((f, idx) => {
          // Create a brand new object with ONLY allowed fields
          const final: Record<string, any> = {};
          
          allowedFields.forEach(key => {
            if (key in f && f[key] !== undefined) {
              final[key] = f[key];
            }
          });

          // Explicitly verify id is NOT in the object
          if ('id' in final || final.id !== undefined || final.id === null) {
            delete final.id;
          }
          if ('created_at' in final) {
            delete final.created_at;
          }

          return final;
        });

        // Final verification - throw error if any field has id
        finalInserts.forEach((f, idx) => {
          if ('id' in f || f.id !== undefined || f.id === null) {
            throw new Error(`Field ${f.field_key} still contains id field - this should not happen!`);
          }
        });

        // Use a helper function to remove any null/undefined values that might cause issues
        const sanitizedInserts = finalInserts.map(f => {
          const sanitized: Record<string, any> = {};
          Object.keys(f).forEach(key => {
            const value = f[key];
            // Only include non-null, non-undefined values (except for explicit nulls in JSONB fields)
            if (value !== undefined && (value !== null || key === 'conditional_logic' || key === 'group_id')) {
              sanitized[key] = value;
            }
          });
          // Explicitly ensure id is never included
          delete sanitized.id;
          delete sanitized.created_at;
          return sanitized;
        });

        // Use JSON stringify/parse with a replacer to absolutely ensure id is removed
        const finalPayload = JSON.parse(
          JSON.stringify(sanitizedInserts, (key, value) => {
            // Remove id and created_at completely
            if (key === 'id' || key === 'created_at') {
              return undefined; // This removes the key from the object
            }
            return value;
          })
        );

        // One more explicit pass to remove id
        const ultraCleanPayload = finalPayload.map((f: any) => {
          const clean: any = {};
          Object.keys(f).forEach(key => {
            if (key !== 'id' && key !== 'created_at') {
              clean[key] = f[key];
            }
          });
          return clean;
        });

        // Use a raw insert approach - insert one at a time to isolate the problem
        const insertedData: any[] = [];
        for (let i = 0; i < ultraCleanPayload.length; i++) {
          const field = ultraCleanPayload[i];
          const isTableField = field.field_key?.includes('table_') || field.field_type === 'table';
          
          // For table fields, create a completely new object with ONLY allowed keys
          let finalField: any;
          if (isTableField) {
            // Build from scratch - only include these exact keys
            finalField = {
              template_id: field.template_id,
              phase_number: field.phase_number,
              field_key: field.field_key,
              field_type: field.field_type,
              display_order: field.display_order,
              layout_config: field.layout_config || {},
              field_config: field.field_config || { label: field.field_key },
            };
            
            // Only add optional fields if they exist
            if (field.conditional_logic !== undefined && field.conditional_logic !== null) {
              finalField.conditional_logic = field.conditional_logic;
            }
            if (field.group_id !== undefined && field.group_id !== null) {
              finalField.group_id = field.group_id;
            }
            
            // Explicitly verify no id
            if ('id' in finalField || finalField.id !== undefined || finalField.id === null) {
              delete finalField.id;
            }
            delete finalField.created_at;
          } else {
            finalField = field;
            
            // One final check for non-table fields
            if ('id' in finalField || finalField.id !== undefined || finalField.id === null) {
              throw new Error(`Field ${field.field_key} has id field - cannot insert`);
            }
          }
          
          // Use RPC call to insert, which gives us more control
          // First, verify the payload one more time
          const cleanInsertPayload: Record<string, any> = {
            template_id: finalField.template_id,
            phase_number: finalField.phase_number,
            field_key: finalField.field_key,
            field_type: finalField.field_type,
            display_order: finalField.display_order,
            layout_config: finalField.layout_config || {},
            field_config: finalField.field_config || {},
          };
          
          if (finalField.conditional_logic !== undefined && finalField.conditional_logic !== null) {
            cleanInsertPayload.conditional_logic = finalField.conditional_logic;
          }
          if (finalField.group_id !== undefined && finalField.group_id !== null) {
            cleanInsertPayload.group_id = finalField.group_id;
          }
          
          // ABSOLUTELY ensure no id or created_at
          delete cleanInsertPayload.id;
          delete cleanInsertPayload.created_at;
          
          // Use .insert() with explicit type cast to any to bypass TypeScript type checking
          const { data, error: singleError } = await supabase
            .from('template_field_configs')
            .insert(cleanInsertPayload as any)
            .select()
            .single();
          
          if (singleError) {
            throw new Error(`Failed to insert field ${field.field_key}: ${singleError.message}`);
          }
          
          if (data) {
            insertedData.push(data);
          }
        }
      }

      // Update template's updated_at timestamp to signal changes
      const { error: updateError } = await supabase
        .from('project_templates')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', templateId);

      if (updateError) {
        // Failed to update template timestamp
      }

      showSuccess(`Template saved successfully! ${allFields.length} field(s) configured. Changes will appear in projects using this template.`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      showError(`Failed to save template: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  // Store handleSave in ref for keyboard shortcut
  useEffect(() => {
    handleSaveRef.current = handleSave;
  });

  // Keyboard shortcuts: Ctrl+S or Cmd+S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (!saving && handleSaveRef.current) {
          handleSaveRef.current();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [saving]);

  const handleFieldSelect = (field: TemplateFieldConfig) => {
    setSelectedField(field);
  };

  const handleFieldUpdate = (updatedField: TemplateFieldConfig) => {
    const updatedFields = { ...fields };
    const phaseFields = updatedFields[updatedField.phase_number] || [];
    const index = phaseFields.findIndex(f => 
      (f.id && f.id === updatedField.id) || 
      (!f.id && f.field_key === updatedField.field_key)
    );

    if (index !== -1) {
      phaseFields[index] = updatedField;
      updatedFields[updatedField.phase_number] = phaseFields;
      setFields(updatedFields);
      setSelectedField(updatedField);
    }
  };

  const handleFieldDelete = (fieldId: string) => {
    setDeleteFieldConfirm({ open: true, fieldId });
  };

  const handleFieldDeleteConfirm = () => {
    if (!deleteFieldConfirm.fieldId) return;

    const fieldId = deleteFieldConfirm.fieldId;
    const updatedFields = { ...fields };
    const phaseNumbers = templatePhases.length > 0 
      ? templatePhases.map(p => p.phase_number)
      : Object.keys(fields).map(Number);
    
    for (const phase of phaseNumbers) {
      updatedFields[phase] = (updatedFields[phase] || []).filter(f => 
        (f.id && f.id !== fieldId) || (!f.id && f.field_key !== fieldId)
      );
      // Reorder remaining fields
      updatedFields[phase] = updatedFields[phase].map((field, index) => ({
        ...field,
        display_order: index + 1,
      }));
    }
    setFields(updatedFields);
    if (selectedField && (selectedField.id === fieldId || selectedField.field_key === fieldId)) {
      setSelectedField(null);
    }
    setDeleteFieldConfirm({ open: false, fieldId: null });
  };

  const handleDuplicateField = (field: TemplateFieldConfig) => {
    const phaseFields = fields[field.phase_number] || [];
    const existingKeys = phaseFields.map(f => f.field_key);
    let newKey = `${field.field_key}_copy`;
    let counter = 1;
    while (existingKeys.includes(newKey)) {
      newKey = `${field.field_key}_copy_${counter}`;
      counter++;
    }

    const duplicatedField: TemplateFieldConfig = {
      ...field,
      id: undefined, // New field, no ID yet
      field_key: newKey,
      display_order: phaseFields.length + 1,
      field_config: {
        ...field.field_config,
        label: `${field.field_config.label} (Copy)`,
      },
    };

    const updatedFields = { ...fields };
    updatedFields[field.phase_number] = [...phaseFields, duplicatedField];
    setFields(updatedFields);
    setSelectedField(duplicatedField);
    showSuccess('Field duplicated successfully!');
  };

  if (roleLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress sx={{ color: theme.palette.text.primary }} />
      </Box>
    );
  }

  // Allow admins and PMs to access template builder
  if (role !== 'admin' && role !== 'pm') {
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
          Access denied. Admin or PM role required.
        </Alert>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ py: 4 }}>
        <Skeleton variant="text" width="40%" height={48} sx={{ mb: 3 }} />
        <Skeleton variant="text" width="60%" height={24} sx={{ mb: 4 }} />
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <LoadingSkeleton variant="card" count={4} />
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}` }}>
              <Skeleton variant="text" width="60%" height={32} sx={{ mb: 2 }} />
              <Skeleton variant="rectangular" width="100%" height={200} sx={{ borderRadius: 1 }} />
            </Paper>
          </Grid>
        </Grid>
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
    <Box sx={{ pb: 4 }}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <Container maxWidth="xl" sx={{ pt: 4, px: { xs: 0, md: 3 } }}>
          {/* Header */}
          {template.is_publicly_available && (
            <Alert severity="info" sx={{ mb: 3 }}>
              This is a global template and cannot be edited. Please duplicate the template to create your own copy that you can edit.
            </Alert>
          )}
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
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
              <Typography
                variant="h4"
                component="h1"
                sx={{
                  fontSize: '1.5rem',
                  fontWeight: 600,
                  color: theme.palette.text.primary,
                }}
              >
                Template Builder: {template.name}
              </Typography>
              {template.is_publicly_available && (
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
            <Button
              variant="outlined"
              startIcon={<PreviewIcon />}
              onClick={() => router.push(`/admin/templates/${templateId}/preview`)}
              sx={{
                borderColor: theme.palette.text.primary,
                color: theme.palette.text.primary,
                '&:hover': {
                  borderColor: theme.palette.text.primary,
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              Preview
            </Button>
            {(features?.export_features_enabled === true || features?.export_features_enabled === null) && (
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={() => {
                  window.open(`/admin/templates/${templateId}/export`, '_blank');
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
                Export
              </Button>
            )}
            <Button
              variant="outlined"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (template?.is_publicly_available) {
                  showError('Cannot edit global templates. Please duplicate the template to create your own copy.');
                  return;
                }
                setPhaseManagerOpen(true);
              }}
              disabled={template?.is_publicly_available}
              onMouseDown={(e) => {
                if (template?.is_publicly_available) {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
              sx={{
                borderColor: theme.palette.text.primary,
                color: theme.palette.text.primary,
                '&:hover': {
                  borderColor: theme.palette.text.primary,
                  backgroundColor: theme.palette.action.hover,
                },
                '&.Mui-disabled': {
                  borderColor: theme.palette.text.disabled,
                  color: theme.palette.text.disabled,
                },
              }}
            >
              Phase Settings
            </Button>
            <Button
              variant="outlined"
              startIcon={saving ? <CircularProgress size={16} sx={{ color: theme.palette.text.primary }} /> : <SaveIcon />}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (template?.is_publicly_available) {
                  showError('Cannot edit global templates. Please duplicate the template to create your own copy.');
                  return;
                }
                handleSave();
              }}
              disabled={saving || template?.is_publicly_available}
              onMouseDown={(e) => {
                if (template?.is_publicly_available || saving) {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
              sx={{
                borderColor: template?.is_publicly_available ? theme.palette.text.disabled : theme.palette.text.primary,
                color: template?.is_publicly_available ? theme.palette.text.disabled : theme.palette.text.primary,
                fontWeight: 600,
                '&:hover': {
                  borderColor: template?.is_publicly_available ? theme.palette.text.disabled : theme.palette.text.primary,
                  backgroundColor: template?.is_publicly_available ? 'transparent' : theme.palette.action.hover,
                },
                '&.Mui-disabled': {
                  borderColor: theme.palette.divider,
                  color: theme.palette.text.secondary,
                },
              }}
              title={template?.is_publicly_available ? 'Cannot edit global templates. Duplicate to create your own copy.' : 'Save Template'}
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </Box>

            {/* Phase Tabs */}
            <Paper
              sx={{
                mb: 3,
                backgroundColor: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              <Tabs
                value={templatePhases.findIndex(p => p.phase_number === activePhase)}
                onChange={(_, newValue) => {
                  if (templatePhases[newValue]) {
                    setActivePhase(templatePhases[newValue].phase_number);
                    setSelectedField(null);
                  }
                }}
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
                {templatePhases.length > 0 ? (
                  templatePhases.map((phase) => (
                    <Tab 
                      key={phase.id} 
                      label={`Phase ${phase.phase_number}: ${phase.phase_name}`} 
                    />
                  ))
                ) : (
                  <Tab label="No phases - Add phases to get started" disabled />
                )}
              </Tabs>
            </Paper>

            {/* Main Builder Area */}
            <Grid container spacing={3}>
              {/* Component Palette */}
              <Grid item xs={12} md={3}>
                <Box sx={{ position: 'sticky', top: 80 }}>
                  <ComponentPalette />
                </Box>
              </Grid>

              {/* Field Canvas */}
              <Grid item xs={12} md={selectedField ? 5 : 9}>
                <ErrorBoundary>
                  <FieldCanvas
                    fields={fields[activePhase] || []}
                    selectedField={selectedField}
                    onFieldSelect={handleFieldSelect}
                    onFieldDelete={handleFieldDelete}
                    onFieldDuplicate={handleDuplicateField}
                    phaseNumber={activePhase}
                  />
                </ErrorBoundary>
              </Grid>

              {/* Field Configuration Panel */}
              {selectedField && (
                <Grid item xs={12} md={4}>
                  <Box sx={{ position: 'sticky', top: 80 }}>
                    <FieldConfigPanel
                      field={selectedField}
                      onUpdate={handleFieldUpdate}
                      onClose={() => setSelectedField(null)}
                    />
                  </Box>
                </Grid>
              )}
            </Grid>
          </Container>

          <DragOverlay>
            {activeId ? (
              <Paper
                sx={{
                  p: 2,
                  backgroundColor: theme.palette.action.hover,
                  border: `1px solid ${theme.palette.divider}`,
                }}
              >
                <Typography sx={{ color: theme.palette.text.primary }}>Dragging...</Typography>
              </Paper>
            ) : null}
          </DragOverlay>
        </DndContext>

        {/* Phase Manager Dialog */}
        <Dialog
          open={phaseManagerOpen}
          onClose={() => setPhaseManagerOpen(false)}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: {
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
            },
          }}
        >
          <DialogTitle sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
            Phase Management
          </DialogTitle>
          <DialogContent>
            <PhaseManager
              templateId={templateId}
              onPhasesChange={() => {
                // Reload phases and fields
                loadTemplate();
                setPhaseManagerOpen(false);
                showSuccess('Phases updated successfully');
              }}
            />
          </DialogContent>
        </Dialog>

        {/* Field Delete Confirmation Dialog */}
        <ConfirmModal
          open={deleteFieldConfirm.open}
          onClose={() => setDeleteFieldConfirm({ open: false, fieldId: null })}
          onConfirm={handleFieldDeleteConfirm}
          title="Delete Field"
          message="Are you sure you want to delete this field? This action cannot be undone and will permanently remove the field configuration from this template."
          confirmText="Delete"
          cancelText="Cancel"
          severity="error"
        />
    </Box>
  );
}

