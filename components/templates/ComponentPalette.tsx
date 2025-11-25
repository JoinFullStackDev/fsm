'use client';

import { useDraggable } from '@dnd-kit/core';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  TextFields as TextFieldsIcon,
  Article as ArticleIcon,
  List as ListIcon,
  Folder as FolderIcon,
  SelectAll as SelectAllIcon,
  CheckBox as CheckBoxIcon,
  Tune as TuneIcon,
  CalendarToday as CalendarTodayIcon,
  AttachFile as AttachFileIcon,
  TableChart as TableChartIcon,
  Code as CodeIcon,
} from '@mui/icons-material';

export interface ComponentType {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'array' | 'object' | 'select' | 'checkbox' | 'slider' | 'date' | 'file' | 'table' | 'custom';
  icon: React.ReactNode;
  description: string;
}

const COMPONENT_TYPES: ComponentType[] = [
  {
    id: 'text',
    label: 'Text Field',
    type: 'text',
    icon: <TextFieldsIcon />,
    description: 'Single-line text input',
  },
  {
    id: 'textarea',
    label: 'Textarea',
    type: 'textarea',
    icon: <ArticleIcon />,
    description: 'Multi-line text input',
  },
  {
    id: 'array',
    label: 'Array Field',
    type: 'array',
    icon: <ListIcon />,
    description: 'List of items with add/remove',
  },
  {
    id: 'object',
    label: 'Object Field',
    type: 'object',
    icon: <FolderIcon />,
    description: 'Nested object structure',
  },
  {
    id: 'select',
    label: 'Select/Dropdown',
    type: 'select',
    icon: <SelectAllIcon />,
    description: 'Dropdown selection',
  },
  {
    id: 'checkbox',
    label: 'Checkbox',
    type: 'checkbox',
    icon: <CheckBoxIcon />,
    description: 'Boolean checkbox',
  },
  {
    id: 'slider',
    label: 'Slider/Range',
    type: 'slider',
    icon: <TuneIcon />,
    description: 'Numeric slider input',
  },
  {
    id: 'date',
    label: 'Date Picker',
    type: 'date',
    icon: <CalendarTodayIcon />,
    description: 'Date selection',
  },
  {
    id: 'file',
    label: 'File Upload',
    type: 'file',
    icon: <AttachFileIcon />,
    description: 'File upload field',
  },
  {
    id: 'table',
    label: 'Table',
    type: 'table',
    icon: <TableChartIcon />,
    description: 'Editable table with CSV import/export',
  },
  {
    id: 'custom',
    label: 'Custom Component',
    type: 'custom',
    icon: <CodeIcon />,
    description: 'Custom complex type',
  },
];

interface DraggableComponentProps {
  component: ComponentType;
}

function DraggableComponent({ component }: DraggableComponentProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `palette-${component.id}`,
    data: {
      type: 'component',
      componentType: component.type,
    },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : { opacity: isDragging ? 0.5 : 1 };

  return (
    <ListItem
      ref={setNodeRef}
      style={style}
      disablePadding
      sx={{
        mb: 1,
        '&:hover': {
          backgroundColor: 'rgba(0, 229, 255, 0.1)',
        },
      }}
    >
      <ListItemButton
        {...listeners}
        {...attributes}
        sx={{
          border: '1px solid',
          borderColor: 'primary.main',
          borderRadius: 1,
          backgroundColor: 'rgba(0, 229, 255, 0.05)',
          cursor: 'grab',
          '&:active': {
            cursor: 'grabbing',
          },
        }}
      >
        <ListItemIcon sx={{ color: 'primary.main', minWidth: 40 }}>
          {component.icon}
        </ListItemIcon>
        <ListItemText
          primary={component.label}
          secondary={component.description}
          primaryTypographyProps={{
            sx: { color: 'primary.main', fontWeight: 500 },
          }}
          secondaryTypographyProps={{
            sx: { color: 'text.secondary', fontSize: '0.75rem' },
          }}
        />
      </ListItemButton>
    </ListItem>
  );
}

interface ComponentPaletteProps {
  onComponentSelect?: (component: ComponentType) => void;
}

export default function ComponentPalette({ onComponentSelect }: ComponentPaletteProps) {
  return (
    <Paper
      sx={{
        p: 2,
        height: '100%',
        backgroundColor: '#000',
        border: '1px solid',
        borderColor: 'primary.main',
        borderRadius: 2,
      }}
    >
      <Typography
        variant="h6"
        sx={{
          mb: 2,
          color: 'primary.main',
          fontWeight: 600,
          borderBottom: '1px solid',
          borderColor: 'primary.main',
          pb: 1,
        }}
      >
        Components
      </Typography>
      <List sx={{ p: 0 }}>
        {COMPONENT_TYPES.map((component) => (
          <DraggableComponent key={component.id} component={component} />
        ))}
      </List>
    </Paper>
  );
}

export { COMPONENT_TYPES };

