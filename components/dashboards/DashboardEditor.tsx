'use client';

import { useCallback, useState, useEffect, useRef } from 'react';
import { useDroppable } from '@dnd-kit/core';
import GridLayout, { Layout } from 'react-grid-layout';
import '@/app/dashboards/styles.css';
import {
  Box,
  Card,
  CardContent,
  IconButton,
  Typography,
  Paper,
  useTheme,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import WidgetRenderer from './WidgetRenderer';
import type { WidgetDataset, WidgetSettings } from '@/types/database';

interface WidgetPosition {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface DashboardEditorProps {
  dashboardId: string;
  widgets: Array<{
    id: string;
    widget_type: string;
    dataset: WidgetDataset;
    position: WidgetPosition;
    settings: WidgetSettings;
  }>;
  onWidgetUpdate: (widgetId: string, position: WidgetPosition) => void;
  onWidgetSelect: (widgetId: string) => void;
  selectedWidgetId: string | null;
  isDragging?: boolean;
  isResizing?: boolean;
  onDragStateChange?: (isDragging: boolean) => void;
  onResizeStateChange?: (isResizing: boolean) => void;
  freeFormMode?: boolean;
  onFreeFormModeChange?: (enabled: boolean) => void;
}

function DroppableCanvas({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const { setNodeRef, isOver } = useDroppable({
    id: 'dashboard-canvas',
    data: {
      type: 'canvas',
    },
  });

  return (
    <Box
      ref={setNodeRef}
      sx={{
        minHeight: '100vh',
        border: isOver ? `2px dashed ${theme.palette.primary.main}` : 'none',
        borderRadius: 1,
        transition: 'all 0.2s',
        backgroundColor: isOver ? theme.palette.action.hover : 'transparent',
      }}
    >
      {children}
    </Box>
  );
}

export default function DashboardEditor({
  dashboardId,
  widgets,
  onWidgetUpdate,
  onWidgetSelect,
  selectedWidgetId,
  isDragging: externalIsDragging,
  isResizing: externalIsResizing,
  onDragStateChange,
  onResizeStateChange,
  freeFormMode: externalFreeFormMode,
  onFreeFormModeChange,
}: DashboardEditorProps) {
  const theme = useTheme();
  const [containerWidth, setContainerWidth] = useState(1200);
  const [internalIsDragging, setInternalIsDragging] = useState(false);
  const [internalIsResizing, setInternalIsResizing] = useState(false);
  const [internalFreeFormMode, setInternalFreeFormMode] = useState(false);
  
  // Use external free-form state if provided, otherwise use internal state
  const freeFormMode = externalFreeFormMode !== undefined ? externalFreeFormMode : internalFreeFormMode;
  
  // Use external state if provided, otherwise use internal state
  const isDragging = externalIsDragging !== undefined ? externalIsDragging : internalIsDragging;
  const isResizing = externalIsResizing !== undefined ? externalIsResizing : internalIsResizing;
  
  const setDragging = useCallback((value: boolean) => {
    if (onDragStateChange) {
      onDragStateChange(value);
    } else {
      setInternalIsDragging(value);
    }
  }, [onDragStateChange]);
  
  const setResizing = useCallback((value: boolean) => {
    if (onResizeStateChange) {
      onResizeStateChange(value);
    } else {
      setInternalIsResizing(value);
    }
  }, [onResizeStateChange]);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastLayoutRef = useRef<string>('');
  const isDraggingRef = useRef(false);
  
  // Keep dragging ref in sync with state
  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  useEffect(() => {
    const updateWidth = () => {
      const container = document.querySelector('.layout')?.parentElement;
      if (container) {
        setContainerWidth(container.clientWidth - 32); // Account for padding
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Convert widgets to grid layout format
  // CRITICAL: Use exact positions from database - don't let react-grid-layout modify them
  const layout: Layout[] = widgets.map((widget) => {
    const pos = widget.position || {};
    // Use nullish coalescing to preserve 0 values
    return {
      i: widget.id,
      x: pos.x ?? 0,
      y: pos.y ?? 0,
      w: pos.w ?? 4,
      h: pos.h ?? 3,
      minW: 2,
      minH: 2,
      maxW: 12,
      maxH: 10,
    };
  });

  const handleLayoutChange = useCallback((newLayout: Layout[]) => {
    // If we're currently dragging, don't save - wait for drag to stop
    // handleDragStop will save the final position
    if (isDraggingRef.current || isDragging) {
      return; // Don't save during drag - wait for dragStop
    }

    // For resize operations, save positions immediately
    if (isResizing) {
      newLayout.forEach((item) => {
        const widget = widgets.find((w) => w.id === item.i);
        if (widget) {
          const currentPos = widget.position || {};
          if (
            currentPos.x !== item.x ||
            currentPos.y !== item.y ||
            currentPos.w !== item.w ||
            currentPos.h !== item.h
          ) {
            onWidgetUpdate(item.i, {
              x: item.x,
              y: item.y,
              w: item.w,
              h: item.h,
            });
          }
        }
      });
      return;
    }

    // For other layout changes (not drag, not resize), save if needed
    // This handles any other programmatic layout changes
    newLayout.forEach((item) => {
      const widget = widgets.find((w) => w.id === item.i);
      if (widget) {
        const currentPos = widget.position || {};
        if (
          currentPos.x !== item.x ||
          currentPos.y !== item.y ||
          currentPos.w !== item.w ||
          currentPos.h !== item.h
        ) {
          onWidgetUpdate(item.i, {
            x: item.x,
            y: item.y,
            w: item.w,
            h: item.h,
          });
        }
      }
    });

    // Create a string representation of the layout to detect actual changes
    const layoutString = JSON.stringify(newLayout.map(item => ({
      i: item.i,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
    })).sort((a, b) => a.i.localeCompare(b.i)));

    // Skip if layout hasn't actually changed
    if (layoutString === lastLayoutRef.current) {
      return;
    }

    lastLayoutRef.current = layoutString;

    // Clear any pending updates
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    // Debounce final save - only save after user stops dragging/resizing
    // Note: onWidgetUpdate already saves, so this is just for cleanup
    updateTimeoutRef.current = setTimeout(() => {
      setDragging(false);
      setResizing(false);
    }, 300);
  }, [widgets, onWidgetUpdate, isDragging, isResizing, setDragging, setResizing]);

  const handleDragStart = useCallback(() => {
    setDragging(true);
  }, [setDragging]);

  const handleDragStop = useCallback((layout: Layout[], oldItem: Layout, newItem: Layout) => {
    // Mark that drag has stopped
    isDraggingRef.current = false;
    setDragging(false);
    
    // CRITICAL: Save the final position immediately when drag stops
    // This ensures we capture the exact position before any state updates
    if (newItem && newItem.i) {
      // Use the newItem from the drag stop event - this is the final position
      onWidgetUpdate(newItem.i, {
        x: newItem.x,
        y: newItem.y,
        w: newItem.w,
        h: newItem.h,
      });
    }
  }, [setDragging, onWidgetUpdate]);

  const handleResizeStart = useCallback(() => {
    setResizing(true);
  }, [setResizing]);

  const handleResizeStop = useCallback(() => {
    setResizing(false);
  }, [setResizing]);

  return (
    <DroppableCanvas>
      <Box sx={{ position: 'relative', minHeight: '100vh', p: 2 }}>
        <GridLayout
          className="layout"
          layout={layout}
          cols={12}
          rowHeight={60}
          width={containerWidth}
          onLayoutChange={handleLayoutChange}
          onDragStart={handleDragStart}
          onDragStop={handleDragStop}
          onResizeStart={handleResizeStart}
          onResizeStop={handleResizeStop}
          isDraggable={true}
          isResizable={true}
          draggableHandle=".drag-handle"
          resizeHandles={['se', 'sw', 'ne', 'nw', 'e', 'w', 'n', 's']}
          compactType={freeFormMode ? null : "vertical"}
          preventCollision={!freeFormMode}
          allowOverlap={freeFormMode}
          verticalCompact={!freeFormMode}
          margin={[10, 10]}
          style={{
            backgroundColor: theme.palette.background.default,
          }}
        >
        {widgets.map((widget) => (
          <Paper
            key={widget.id}
            elevation={selectedWidgetId === widget.id ? 4 : 1}
            sx={{
              height: '100%',
              border: selectedWidgetId === widget.id
                ? `2px solid ${theme.palette.primary.main}`
                : `1px solid ${theme.palette.divider}`,
              borderRadius: 1,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Box
              className="drag-handle"
              sx={{
                p: 1,
                borderBottom: `1px solid ${theme.palette.divider}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: theme.palette.action.hover,
                cursor: 'move',
              }}
            >
              <Typography variant="caption" color="text.secondary">
                {widget.widget_type}
              </Typography>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onWidgetSelect(widget.id);
                }}
                sx={{
                  cursor: 'pointer',
                }}
              >
                <SettingsIcon fontSize="small" />
              </IconButton>
            </Box>
            <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
              <WidgetRenderer widget={widget} dashboardId={dashboardId} />
            </Box>
          </Paper>
        ))}
      </GridLayout>

      {widgets.length === 0 && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
          }}
        >
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No widgets yet
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Add widgets from the widget library to get started
          </Typography>
        </Box>
      )}
      </Box>
    </DroppableCanvas>
  );
}

