'use client';

import { useState, useEffect } from 'react';
import { useDraggable } from '@dnd-kit/core';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
  Box,
  IconButton,
  Paper,
} from '@mui/material';
import {
  Close as CloseIcon,
  Numbers as NumbersIcon,
  BarChart as BarChartIcon,
  TableChart as TableChartIcon,
  Lightbulb as LightbulbIcon,
  TextFields as TextFieldsIcon,
  DragHandle as DragHandleIcon,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

interface WidgetType {
  type: string;
  name: string;
  description: string;
  icon: string;
}

interface WidgetLibraryProps {
  open: boolean;
  onClose: () => void;
  onWidgetSelect: (widgetType: string) => void;
}

const WIDGET_TYPES: WidgetType[] = [
  {
    type: 'metric',
    name: 'Metric',
    description: 'Display a single metric value',
    icon: 'Numbers',
  },
  {
    type: 'chart',
    name: 'Chart',
    description: 'Display data as a chart',
    icon: 'BarChart',
  },
  {
    type: 'table',
    name: 'Table',
    description: 'Display data in a table',
    icon: 'TableChart',
  },
  {
    type: 'ai_insight',
    name: 'AI Insight',
    description: 'AI-generated insights',
    icon: 'Lightbulb',
  },
  {
    type: 'rich_text',
    name: 'Rich Text',
    description: 'Display rich text content',
    icon: 'TextFields',
  },
];

const getIcon = (iconName: string) => {
  switch (iconName) {
    case 'Numbers':
      return NumbersIcon;
    case 'BarChart':
      return BarChartIcon;
    case 'TableChart':
      return TableChartIcon;
    case 'Lightbulb':
      return LightbulbIcon;
    case 'TextFields':
      return TextFieldsIcon;
    default:
      return BarChartIcon;
  }
};

interface DraggableWidgetItemProps {
  widget: WidgetType;
  onWidgetClick: (widgetType: string) => void;
}

function DraggableWidgetItem({ widget, onWidgetClick }: DraggableWidgetItemProps) {
  const theme = useTheme();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `widget-${widget.type}`,
    data: {
      type: 'widget',
      widgetType: widget.type,
    },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const IconComponent = getIcon(widget.icon);

  return (
    <ListItem
      ref={setNodeRef}
      disablePadding
      sx={{
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      <Paper
        sx={{
          width: '100%',
          m: 1,
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 1,
          ...style,
        }}
      >
        <ListItemButton
          onClick={() => onWidgetClick(widget.type)}
          sx={{
            '&:hover': {
              backgroundColor: theme.palette.action.hover,
            },
          }}
        >
          <Box
            {...attributes}
            {...listeners}
            sx={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'grab',
              mr: 1,
              '&:active': {
                cursor: 'grabbing',
              },
            }}
          >
            <DragHandleIcon fontSize="small" color="action" />
          </Box>
          <ListItemIcon>
            <IconComponent />
          </ListItemIcon>
          <ListItemText
            primary={widget.name}
            secondary={widget.description}
          />
        </ListItemButton>
      </Paper>
    </ListItem>
  );
}

export default function WidgetLibrary({ open, onClose, onWidgetSelect }: WidgetLibraryProps) {
  const theme = useTheme();

  const handleWidgetClick = (widgetType: string) => {
    onWidgetSelect(widgetType);
    onClose();
  };

  return (
      <Drawer
        anchor="left"
        open={open}
        onClose={onClose}
        sx={{
          '& .MuiDrawer-paper': {
            width: 300,
            borderRight: `1px solid ${theme.palette.divider}`,
            transform: 'translateY(60px)',
          },
        }}
      >
      <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Widget Library</Typography>
          <IconButton size="small" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Drag widgets to add them to your dashboard
        </Typography>
      </Box>

      <List sx={{ p: 1 }}>
        {WIDGET_TYPES.map((widget) => (
          <DraggableWidgetItem
            key={widget.type}
            widget={widget}
            onWidgetClick={handleWidgetClick}
          />
        ))}
      </List>
    </Drawer>
  );
}

