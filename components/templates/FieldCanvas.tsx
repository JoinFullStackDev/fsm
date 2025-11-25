'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Grid,
} from '@mui/material';
import {
  DragHandle as DragHandleIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  ContentCopy as ContentCopyIcon,
} from '@mui/icons-material';
import type { TemplateFieldConfig } from '@/types/templates';

interface FieldItemProps {
  field: TemplateFieldConfig;
  onSelect: (field: TemplateFieldConfig) => void;
  onDelete: (fieldId: string) => void;
  onDuplicate?: (field: TemplateFieldConfig) => void;
  isSelected: boolean;
}

function FieldItem({ field, onSelect, onDelete, onDuplicate, isSelected }: FieldItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: field.id || field.field_key,
    data: {
      type: 'field',
      field,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getFieldTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      text: 'Text',
      textarea: 'Textarea',
      array: 'Array',
      object: 'Object',
      select: 'Select',
      checkbox: 'Checkbox',
      slider: 'Slider',
      date: 'Date',
      file: 'File',
      custom: 'Custom',
    };
    return labels[type] || type;
  };

  return (
    <Paper
      ref={setNodeRef}
      style={style}
      sx={{
        p: 2,
        mb: 2,
        border: '2px solid',
        borderColor: isSelected ? 'primary.main' : 'rgba(0, 229, 255, 0.3)',
        backgroundColor: isSelected ? 'rgba(0, 229, 255, 0.1)' : '#1A1F3A',
        cursor: 'pointer',
        '&:hover': {
          borderColor: 'primary.main',
          backgroundColor: 'rgba(0, 229, 255, 0.15)',
        },
      }}
      onClick={() => onSelect(field)}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box
          {...attributes}
          {...listeners}
          sx={{
            cursor: 'grab',
            color: 'primary.main',
            '&:active': {
              cursor: 'grabbing',
            },
          }}
          aria-label={`Drag to reorder field ${field.field_config.label || field.field_key}`}
          role="button"
          tabIndex={0}
        >
          <DragHandleIcon />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle1" sx={{ color: 'primary.main', fontWeight: 600 }}>
            {field.field_config.label || field.field_key}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {getFieldTypeLabel(field.field_type)} • Order: {field.display_order}
            {field.group_id && ` • Group: ${field.group_id}`}
          </Typography>
        </Box>
        {onDuplicate && (
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate(field);
            }}
            sx={{ color: 'info.main' }}
            title="Duplicate field"
            aria-label={`Duplicate field ${field.field_config.label || field.field_key}`}
          >
            <ContentCopyIcon />
          </IconButton>
        )}
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(field);
          }}
          sx={{ color: 'primary.main' }}
          title="Edit field"
          aria-label={`Edit field ${field.field_config.label || field.field_key}`}
        >
          <EditIcon />
        </IconButton>
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            const fieldId = field.id || field.field_key;
            onDelete(fieldId);
          }}
          sx={{ color: 'error.main' }}
          title="Delete field"
          aria-label={`Delete field ${field.field_config.label || field.field_key}`}
        >
          <DeleteIcon />
        </IconButton>
      </Box>
    </Paper>
  );
}

interface FieldCanvasProps {
  fields: TemplateFieldConfig[];
  selectedField: TemplateFieldConfig | null;
  onFieldSelect: (field: TemplateFieldConfig) => void;
  onFieldDelete: (fieldId: string) => void;
  onFieldDuplicate?: (field: TemplateFieldConfig) => void;
  phaseNumber: number;
}

export default function FieldCanvas({
  fields,
  selectedField,
  onFieldSelect,
  onFieldDelete,
  onFieldDuplicate,
  phaseNumber,
}: FieldCanvasProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `canvas-phase-${phaseNumber}`,
    data: {
      type: 'canvas',
      phaseNumber,
    },
  });

  const sortedFields = [...fields].sort((a, b) => a.display_order - b.display_order);
  const fieldIds = sortedFields.map(f => f.id || f.field_key).filter(Boolean) as string[];

  return (
    <Paper
      ref={setNodeRef}
      sx={{
        p: 3,
        minHeight: 400,
        backgroundColor: '#000',
        border: '2px dashed',
        borderColor: isOver ? 'primary.main' : 'rgba(0, 229, 255, 0.3)',
        borderRadius: 2,
        transition: 'all 0.2s',
      }}
    >
      <Typography
        variant="h6"
        sx={{
          mb: 3,
          color: 'primary.main',
          fontWeight: 600,
          borderBottom: '1px solid',
          borderColor: 'primary.main',
          pb: 1,
        }}
      >
        Phase {phaseNumber} Fields
      </Typography>

      {sortedFields.length === 0 ? (
        <Box
          sx={{
            textAlign: 'center',
            py: 8,
            color: 'text.secondary',
          }}
        >
          <Typography variant="body1" sx={{ mb: 1 }}>
            No fields yet
          </Typography>
          <Typography variant="body2">
            Drag components from the palette to add fields
          </Typography>
        </Box>
      ) : (
        <SortableContext items={fieldIds} strategy={verticalListSortingStrategy}>
          {sortedFields.map((field) => (
            <FieldItem
              key={field.id || field.field_key}
              field={field}
              onSelect={onFieldSelect}
              onDelete={onFieldDelete}
              onDuplicate={onFieldDuplicate}
              isSelected={selectedField?.id === field.id || (!selectedField?.id && selectedField?.field_key === field.field_key)}
            />
          ))}
        </SortableContext>
      )}
    </Paper>
  );
}

