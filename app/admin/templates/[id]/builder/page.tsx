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
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Preview as PreviewIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import { useRole } from '@/lib/hooks/useRole';
import { useNotification } from '@/components/providers/NotificationProvider';
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
  const router = useRouter();
  const params = useParams();
  const templateId = params.id as string;
  const supabase = createSupabaseClient();
  const { role, loading: roleLoading } = useRole();
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

    // Ensure phases exist (backward compatibility)
    const phases = await ensurePhasesExist(templateId, supabase);
    
    // Load phases from database (ordered by display_order, only active)
    const { data: phasesData, error: phasesError } = await supabase
      .from('template_phases')
      .select('*')
      .eq('template_id', templateId)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (phasesError) {
      console.error('Error loading phases:', phasesError);
    }

    const loadedPhases = (phasesData || phases) as TemplatePhase[];
    setTemplatePhases(loadedPhases);

    // Set active phase to first phase if available
    if (loadedPhases.length > 0 && !loadedPhases.find(p => p.phase_number === activePhase)) {
      setActivePhase(loadedPhases[0].phase_number);
    }

    // Load field configs for all phases
    const { data: fieldConfigs, error: configsError } = await supabase
      .from('template_field_configs')
      .select('*')
      .eq('template_id', templateId)
      .order('phase_number', { ascending: true })
      .order('display_order', { ascending: true });

    if (configsError) {
      console.error('Error loading field configs:', configsError);
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
      fieldConfigs.forEach((config) => {
        if (config.phase_number) {
          uniquePhaseNumbers.add(config.phase_number);
        }
      });
      uniquePhaseNumbers.forEach((phaseNumber) => {
        fieldsByPhase[phaseNumber] = [];
      });
    }

    fieldConfigs?.forEach((config) => {
      if (!fieldsByPhase[config.phase_number]) {
        fieldsByPhase[config.phase_number] = [];
      }
      fieldsByPhase[config.phase_number].push(config as TemplateFieldConfig);
    });

    setFields(fieldsByPhase);
    setLoading(false);
  }, [templateId, supabase, activePhase]);

  useEffect(() => {
    if (roleLoading) {
      return; // Wait for role to load
    }

    if (role !== 'admin') {
      router.push('/dashboard');
      return;
    }
    loadTemplate();
  }, [templateId, role, roleLoading, router, loadTemplate]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
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
            console.error(`[TemplateBuilder] ERROR: Field ${field.field_key} in phase ${phase} has id!`, cleanField);
            delete cleanField.id;
          }
          if ('created_at' in cleanField) {
            delete cleanField.created_at;
          }
          
          allFields.push(cleanField as TemplateFieldConfig);
        });
      }
      
      // Log all fields to verify no id
      console.log('[TemplateBuilder] All fields after initial cleanup:', allFields.map(f => ({
        key: f.field_key,
        phase: f.phase_number,
        hasId: 'id' in f,
        idValue: (f as any).id,
      })));

      console.log('[TemplateBuilder] Saving fields with display_order:', allFields.map(f => ({ key: f.field_key, order: f.display_order })));

      // Get existing field configs to determine which to update vs insert
      const { data: existingFields, error: fetchError } = await supabase
        .from('template_field_configs')
        .select('id, field_key, phase_number')
        .eq('template_id', templateId);

      if (fetchError) {
        throw new Error(`Failed to fetch existing fields: ${fetchError.message}`);
      }

      const existingFieldsMap = new Map<string, string>();
      existingFields?.forEach(field => {
        const key = `${field.phase_number}_${field.field_key}`;
        // Only add to map if id is a valid UUID string
        if (field.id && typeof field.id === 'string' && field.id.length > 0) {
          existingFieldsMap.set(key, field.id);
        }
      });
      
      console.log('[TemplateBuilder] Existing fields map:', Array.from(existingFieldsMap.entries()));

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
        
        // For table fields, log extra details
        if (isTableField) {
          console.log(`[TemplateBuilder] Processing TABLE field: ${field.field_key}`, {
            existingId,
            hasIdInCleanField: 'id' in cleanField,
            cleanFieldKeys: Object.keys(cleanField),
            originalFieldKeys: Object.keys(field),
            originalFieldHasId: 'id' in field,
            originalFieldIdValue: (field as any).id,
          });
        }
        
        // Ensure existingId is actually a valid UUID string, not null or undefined
        if (existingId && typeof existingId === 'string' && existingId.length > 0) {
          // Update existing field - include id separately for the update
          fieldsToUpdate.push({ id: existingId, ...cleanField });
        } else {
          // Insert new field (absolutely no id)
          // Triple-check cleanField doesn't have id
          if ('id' in cleanField || cleanField.id !== undefined || cleanField.id === null) {
            console.error(`[TemplateBuilder] ERROR: cleanField for ${field.field_key} has id before push!`, cleanField);
            delete cleanField.id;
          }
          if ('created_at' in cleanField) {
            delete cleanField.created_at;
          }
          
          // For table fields, verify one more time
          if (isTableField) {
            console.log(`[TemplateBuilder] Adding TABLE field to insert: ${field.field_key}`, {
              keys: Object.keys(cleanField),
              hasId: 'id' in cleanField,
              idValue: cleanField.id,
            });
          }
          
          fieldsToInsert.push(cleanField);
        }
      });

      // Delete fields that are no longer in the template
      const fieldsToKeep = new Set(allFields.map(f => `${f.phase_number}_${f.field_key}`));
      const fieldsToDelete = existingFields?.filter(f => {
        const key = `${f.phase_number}_${f.field_key}`;
        return !fieldsToKeep.has(key);
      }) || [];

      if (fieldsToDelete.length > 0) {
        const idsToDelete = fieldsToDelete.map(f => f.id);
        const { error: deleteError } = await supabase
          .from('template_field_configs')
          .delete()
          .in('id', idsToDelete);

        if (deleteError) {
          console.warn('[TemplateBuilder] Error deleting removed fields:', deleteError);
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
            console.error(`[TemplateBuilder] Error updating field ${field.field_key}:`, updateError);
            throw new Error(`Failed to update field ${field.field_key}: ${updateError.message}`);
          }
        }
        console.log('[TemplateBuilder] Updated', fieldsToUpdate.length, 'existing fields');
      }

      // Insert new fields
      if (fieldsToInsert.length > 0) {
        // Triple-check: Create completely new objects with only allowed fields
        const cleanedInserts = fieldsToInsert.map((f, index) => {
          // Log if id was present (shouldn't be, but check)
          if ('id' in f || f.id !== undefined || f.id === null) {
            console.error(`[TemplateBuilder] Field ${index} (${f.field_key}) had id:`, f.id, 'Full field:', f);
          }
          
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
            console.error(`[TemplateBuilder] ERROR: id found in cleaned object for ${f.field_key}!`);
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
            console.error(`[TemplateBuilder] CRITICAL: Field ${idx} (${f.field_key}) has id in final object!`, final);
            delete final.id;
          }
          if ('created_at' in final) {
            delete final.created_at;
          }

          // Log the actual object being sent
          console.log(`[TemplateBuilder] Final insert object for ${f.field_key}:`, {
            keys: Object.keys(final),
            hasId: 'id' in final,
            idValue: final.id,
            fullObject: JSON.stringify(final),
          });

          return final;
        });

        console.log('[TemplateBuilder] Inserting', finalInserts.length, 'new fields:', finalInserts.map(f => ({ 
          key: f.field_key, 
          type: f.field_type, 
          phase: f.phase_number,
          hasId: 'id' in f,
          keys: Object.keys(f)
        })));

        // Final verification - throw error if any field has id
        finalInserts.forEach((f, idx) => {
          if ('id' in f || f.id !== undefined || f.id === null) {
            console.error(`[TemplateBuilder] CRITICAL: Field ${idx} (${f.field_key}) still has id after all cleaning!`, f);
            console.error(`[TemplateBuilder] Full object:`, JSON.stringify(f, null, 2));
            throw new Error(`Field ${f.field_key} still contains id field - this should not happen!`);
          }
        });

        // Log the exact payload being sent
        console.log('[TemplateBuilder] Final payload being sent to Supabase:', JSON.stringify(finalInserts, null, 2));

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

        console.log('[TemplateBuilder] Sanitized payload:', JSON.stringify(sanitizedInserts, null, 2));

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

        console.log('[TemplateBuilder] Ultra-clean payload:', JSON.stringify(ultraCleanPayload, null, 2));
        console.log('[TemplateBuilder] Checking for id in payload:', ultraCleanPayload.map((f: any) => ({
          field_key: f.field_key,
          hasId: 'id' in f,
          idValue: f.id,
          allKeys: Object.keys(f)
        })));

        // Use a raw insert approach - insert one at a time to isolate the problem
        const insertedData: any[] = [];
        for (let i = 0; i < ultraCleanPayload.length; i++) {
          const field = ultraCleanPayload[i];
          const isTableField = field.field_key?.includes('table_') || field.field_type === 'table';
          
          // For table fields, create a completely new object with ONLY allowed keys
          let finalField: any;
          if (isTableField) {
            console.log(`[TemplateBuilder] TABLE FIELD DETECTED: ${field.field_key}`, {
              originalKeys: Object.keys(field),
              originalHasId: 'id' in field,
              originalIdValue: field.id,
            });
            
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
              console.error(`[TemplateBuilder] CRITICAL: TABLE field ${field.field_key} finalField has id!`, finalField);
              delete finalField.id;
            }
            delete finalField.created_at;
            
            console.log(`[TemplateBuilder] TABLE field final object:`, {
              keys: Object.keys(finalField),
              hasId: 'id' in finalField,
              idValue: finalField.id,
              fullObject: JSON.stringify(finalField, null, 2),
            });
          } else {
            finalField = field;
            
            // One final check for non-table fields
            if ('id' in finalField || finalField.id !== undefined || finalField.id === null) {
              console.error(`[TemplateBuilder] CRITICAL: Field ${i} (${field.field_key}) STILL has id!`, finalField);
              throw new Error(`Field ${field.field_key} has id field - cannot insert`);
            }
          }
          
          console.log(`[TemplateBuilder] Inserting field ${i + 1}/${ultraCleanPayload.length}: ${field.field_key}`, {
            keys: Object.keys(finalField),
            hasId: 'id' in finalField,
            isTable: isTableField,
          });
          
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
          
          console.log(`[TemplateBuilder] Final insert payload for ${field.field_key}:`, {
            keys: Object.keys(cleanInsertPayload),
            hasId: 'id' in cleanInsertPayload,
            idValue: cleanInsertPayload.id,
            payload: JSON.stringify(cleanInsertPayload, null, 2),
          });
          
          // Use .insert() with explicit type cast to any to bypass TypeScript type checking
          const { data, error: singleError } = await supabase
            .from('template_field_configs')
            .insert(cleanInsertPayload as any)
            .select()
            .single();
          
          if (singleError) {
            console.error(`[TemplateBuilder] Error inserting field ${field.field_key}:`, singleError);
            console.error(`[TemplateBuilder] Field data that failed:`, JSON.stringify(finalField, null, 2));
            throw new Error(`Failed to insert field ${field.field_key}: ${singleError.message}`);
          }
          
          if (data) {
            insertedData.push(data);
          }
        }

        console.log('[TemplateBuilder] Successfully inserted', insertedData.length, 'new fields');
      }

      // Update template's updated_at timestamp to signal changes
      const { error: updateError } = await supabase
        .from('project_templates')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', templateId);

      if (updateError) {
        console.warn('Failed to update template timestamp:', updateError);
      }

      showSuccess(`Template saved successfully! ${allFields.length} field(s) configured. Changes will appear in projects using this template.`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('[TemplateBuilder] Save error:', err);
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
    return (
      <>
        <Container>
          <Alert severity="error" sx={{ mt: 4 }}>
            Access denied. Admin role required.
          </Alert>
        </Container>
      </>
    );
  }

  if (loading) {
    return (
      <>
        <Container>
          <Box sx={{ py: 4 }}>
            <Skeleton variant="text" width="40%" height={48} sx={{ mb: 3 }} />
            <Skeleton variant="text" width="60%" height={24} sx={{ mb: 4 }} />
            <Grid container spacing={3}>
              <Grid item xs={12} md={8}>
                <LoadingSkeleton variant="card" count={4} />
              </Grid>
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 3 }}>
                  <Skeleton variant="text" width="60%" height={32} sx={{ mb: 2 }} />
                  <Skeleton variant="rectangular" width="100%" height={200} sx={{ borderRadius: 1 }} />
                </Paper>
              </Grid>
            </Grid>
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
      <Box sx={{ backgroundColor: '#000', minHeight: '100vh', pb: 4 }}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <Container maxWidth="xl" sx={{ pt: 4 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <IconButton
                onClick={() => router.push('/admin/templates')}
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
                  background: '#00E5FF',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Template Builder: {template.name}
              </Typography>
              <Button
                variant="outlined"
                startIcon={<PreviewIcon />}
                onClick={() => router.push(`/admin/templates/${templateId}/preview`)}
                sx={{
                  borderColor: 'info.main',
                  color: 'info.main',
                  '&:hover': {
                    borderColor: 'info.light',
                    backgroundColor: 'rgba(33, 150, 243, 0.1)',
                  },
                }}
              >
                Preview
              </Button>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={() => {
                  window.open(`/admin/templates/${templateId}/export`, '_blank');
                }}
                sx={{
                  borderColor: 'success.main',
                  color: 'success.main',
                  '&:hover': {
                    borderColor: 'success.light',
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                  },
                }}
              >
                Export
              </Button>
              <Button
                variant="outlined"
                onClick={() => setPhaseManagerOpen(true)}
                sx={{
                  borderColor: 'primary.main',
                  color: 'primary.main',
                  '&:hover': {
                    borderColor: 'primary.dark',
                    backgroundColor: 'rgba(0, 229, 255, 0.1)',
                  },
                }}
              >
                Phase Settings
              </Button>
              <Button
                variant="contained"
                startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
                onClick={handleSave}
                disabled={saving}
                sx={{
                  backgroundColor: '#00E5FF',
                  color: '#000',
                  fontWeight: 600,
                  '&:hover': {
                    backgroundColor: '#00B2CC',
                  },
                }}
              >
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </Box>

            {/* Phase Tabs */}
            <Paper
              sx={{
                mb: 3,
                backgroundColor: '#000',
                border: '1px solid',
                borderColor: 'primary.main',
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
                  backgroundColor: 'rgba(0, 229, 255, 0.2)',
                  border: '2px solid',
                  borderColor: 'primary.main',
                }}
              >
                <Typography>Dragging...</Typography>
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
        >
          <DialogTitle>Phase Management</DialogTitle>
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
    </>
  );
}

