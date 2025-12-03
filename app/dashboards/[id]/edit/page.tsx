'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Box,
  Typography,
  Button,
  TextField,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  IconButton,
  Toolbar,
  Paper,
} from '@mui/material';
import {
  Save as SaveIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { useOrganization } from '@/components/providers/OrganizationProvider';
import { useNotification } from '@/components/providers/NotificationProvider';
import DashboardEditor from '@/components/dashboards/DashboardEditor';
import WidgetLibrary from '@/components/dashboards/WidgetLibrary';
import WidgetConfigPanel from '@/components/dashboards/WidgetConfigPanel';
import DashboardTemplates from '@/components/dashboards/DashboardTemplates';
import { Add as AddIcon, ViewModule as TemplateIcon } from '@mui/icons-material';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
} from '@dnd-kit/core';

interface Dashboard {
  id: string;
  name: string;
  description: string | null;
  is_personal: boolean;
  is_default: boolean;
  layout: any;
  widgets: Widget[];
}

interface Widget {
  id: string;
  widget_type: string;
  dataset: any;
  position: any;
  settings: any;
}

export default function DashboardEditorPage() {
  const router = useRouter();
  const params = useParams();
  const theme = useTheme();
  const { features, organization } = useOrganization();
  const { showSuccess, showError } = useNotification();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [widgetLibraryOpen, setWidgetLibraryOpen] = useState(false);
  const [configPanelOpen, setConfigPanelOpen] = useState(false);
  const [selectedWidget, setSelectedWidget] = useState<Widget | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    if (features && features.custom_dashboards_enabled !== true) {
      router.push('/dashboard');
      return;
    }

    if (params.id && params.id !== 'new') {
      loadDashboard();
    } else {
      setLoading(false);
    }
    // Only run when params.id changes, not when features object reference changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/dashboards/${params.id}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load dashboard');
      }

      const data = await response.json();
      setDashboard(data.dashboard);
      setName(data.dashboard.name);
      setDescription(data.dashboard.description || '');
      
      // Update widgets state
      if (data.dashboard.widgets) {
        // Widgets are already in the dashboard object
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const url = params.id === 'new' ? '/api/dashboards' : `/api/dashboards/${params.id}`;
      const method = params.id === 'new' ? 'POST' : 'PUT';

      const body: any = {
        name,
        description: description || null,
      };

      if (params.id === 'new') {
        // Default to organization dashboard if user has org, otherwise personal
        if (organization?.id) {
          body.is_personal = false;
          body.organization_id = organization.id;
        } else {
          body.is_personal = true;
        }
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save dashboard');
      }

      const data = await response.json();
      showSuccess(params.id === 'new' ? 'Dashboard created successfully!' : 'Dashboard saved successfully!');
      
      // If creating new dashboard, navigate to edit page
      if (params.id === 'new') {
        setTimeout(() => {
          router.push(`/dashboards/${data.dashboard.id}/edit`);
        }, 500);
      } else {
        // If updating, reload the dashboard
        await loadDashboard();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save dashboard';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleAddWidget = async (widgetType: string) => {
    if (!dashboard || params.id === 'new') {
      return;
    }

    await addWidgetToDashboard(widgetType, { x: 0, y: 0 });
  };

  const handleAddWidgetFromDrag = async (widgetType: string, position: { x: number; y: number }) => {
    if (!dashboard || params.id === 'new') {
      return;
    }

    await addWidgetToDashboard(widgetType, position);
  };

  const addWidgetToDashboard = async (widgetType: string, position: { x: number; y: number }) => {
    if (!dashboard || params.id === 'new') {
      return;
    }

    try {
      // Calculate grid position - find the next available Y position
      const existingWidgets = dashboard.widgets || [];
      const maxY = existingWidgets.length > 0 
        ? Math.max(...existingWidgets.map(w => (w.position?.y || 0) + (w.position?.h || 3)))
        : 0;
      const gridX = Math.max(0, Math.min(position.x || 0, 8)); // Clamp to 0-8 (leaving room for 4-width widget)
      const gridY = maxY;

      // Set default dataSource based on widget type
      let defaultDataset: any = {};
      if (widgetType === 'metric') {
        defaultDataset = { dataSource: 'task_count' };
      } else if (widgetType === 'chart') {
        defaultDataset = { dataSource: 'task_timeline' };
      } else if (widgetType === 'table') {
        defaultDataset = { dataSource: 'tasks', limit: 10 };
      } else if (widgetType === 'ai_insight') {
        defaultDataset = { insight_type: 'project_health', autoGenerate: false };
      } else if (widgetType === 'rich_text') {
        defaultDataset = { content: '' };
      }

      // Set default height based on widget type
      let defaultHeight = 3; // Default for metric and rich_text
      if (widgetType === 'chart' || widgetType === 'table') {
        defaultHeight = 8;
      } else if (widgetType === 'ai_insight') {
        defaultHeight = 14;
      }

      // Optimistically update local state
      const tempId = `temp-${Date.now()}`;
      const newWidget = {
        id: tempId,
        widget_type: widgetType,
        dataset: defaultDataset,
        position: { x: gridX, y: gridY, w: 4, h: defaultHeight },
        settings: {},
      };

      setDashboard({
        ...dashboard,
        widgets: [...(dashboard.widgets || []), newWidget],
      });

      const response = await fetch(`/api/dashboards/${params.id}/widgets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          widget_type: widgetType,
          dataset: defaultDataset,
          position: { x: gridX, y: gridY, w: 4, h: defaultHeight },
          settings: {},
        }),
      });

      if (!response.ok) {
        // Revert optimistic update on error
        setDashboard({
          ...dashboard,
          widgets: dashboard.widgets || [],
        });
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add widget');
      }

      const data = await response.json();
      // Update with real widget ID
      setDashboard({
        ...dashboard,
        widgets: (dashboard.widgets || []).map(w => 
          w.id === tempId ? data.widget : w
        ),
      });
      showSuccess('Widget added successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add widget';
      showError(errorMessage);
    }
  };

  const handleWidgetUpdate = async (widgetId: string, position: any) => {
    if (!dashboard) return;

    try {
      const widget = dashboard.widgets.find((w) => w.id === widgetId);
      if (!widget) return;

      // Check if position actually changed
      const currentPos = widget.position || {};
      if (
        currentPos.x === position.x &&
        currentPos.y === position.y &&
        currentPos.w === position.w &&
        currentPos.h === position.h
      ) {
        return; // No change, skip update
      }

      // Optimistically update local state first - this prevents the revert
      const updatedWidgets = dashboard.widgets.map((w) =>
        w.id === widgetId ? { ...w, position } : w
      );
      setDashboard({ ...dashboard, widgets: updatedWidgets });

      // Then save to server (fire and forget for position updates)
      // Don't reload on success - we've already updated optimistically
      fetch(`/api/dashboards/${params.id}/widgets/${widgetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          position,
          dataset: widget.dataset,
          settings: widget.settings,
        }),
      }).catch(() => {
        // Only reload on error to sync with server
        // Use a small delay to debounce multiple errors
        setTimeout(() => {
          loadDashboard();
        }, 1000);
      });
    } catch (err) {
      // Silently fail for position updates
    }
  };

  const handleWidgetSelect = (widgetId: string) => {
    // Don't open settings if we're currently dragging
    if (isDragging || isResizing) {
      return;
    }
    const widget = dashboard?.widgets.find((w) => w.id === widgetId);
    if (widget) {
      setSelectedWidget(widget);
      setConfigPanelOpen(true);
    }
  };

  const handleWidgetSave = async (widgetId: string, dataset: any, settings: any, position?: any) => {
    if (!dashboard) return;

    try {
      const currentWidget = dashboard.widgets.find((w) => w.id === widgetId);
      if (!currentWidget) return;

      // Use provided position or keep current
      const newPosition = position || currentWidget.position || {};

      // Optimistically update local state
      setDashboard({
        ...dashboard,
        widgets: dashboard.widgets.map((w) =>
          w.id === widgetId
            ? { ...w, dataset: { ...w.dataset, ...dataset }, settings, position: newPosition }
            : w
        ),
      });

      const response = await fetch(`/api/dashboards/${params.id}/widgets/${widgetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataset,
          settings,
          position: newPosition,
        }),
      });

      if (!response.ok) {
        // Revert on error
        await loadDashboard();
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save widget');
      }

      showSuccess('Widget updated successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save widget';
      showError(errorMessage);
      // Reload to get correct state
      await loadDashboard();
    }
  };

  const handleWidgetDelete = async (widgetId: string) => {
    if (!dashboard) return;

    try {
      const response = await fetch(`/api/dashboards/${params.id}/widgets/${widgetId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete widget');
      }

      await loadDashboard();
      showSuccess('Widget deleted successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete widget';
      showError(errorMessage);
    }
  };

  const handleTemplateSelect = async (template: any) => {
    try {
      setSaving(true);
      setError(null);

      let dashboardId = params.id;

      // If creating new dashboard, save it first
      if (params.id === 'new') {
        const dashboardName = name.trim() || template.name;
        if (!name.trim()) {
          setName(dashboardName);
        }

        const url = '/api/dashboards';
        const body: any = {
          name: dashboardName,
          description: description || null,
        };

        if (organization?.id) {
          body.is_personal = false;
          body.organization_id = organization.id;
        } else {
          body.is_personal = true;
        }

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create dashboard');
        }

        const data = await response.json();
        dashboardId = data.dashboard.id;
        
        // Update local state
        setDashboard(data.dashboard);
        setName(data.dashboard.name);
        setDescription(data.dashboard.description || '');
      }

      // Add all widgets from template - process sequentially to avoid race conditions
      let successCount = 0;
      let errorCount = 0;
      
      console.log(`[Template] Adding ${template.widgets.length} widgets to dashboard ${dashboardId}`);
      
      for (let i = 0; i < template.widgets.length; i++) {
        const widgetTemplate = template.widgets[i];
        try {
          // Set default height based on widget type (overrides template height)
          let defaultHeight = widgetTemplate.position?.h || 3; // Use template height as fallback
          if (widgetTemplate.widget_type === 'chart' || widgetTemplate.widget_type === 'table') {
            defaultHeight = 8;
          } else if (widgetTemplate.widget_type === 'ai_insight') {
            defaultHeight = 14;
          }
          
          const widgetBody = {
            widget_type: widgetTemplate.widget_type,
            dataset: widgetTemplate.dataset || {},
            position: {
              ...(widgetTemplate.position || { x: 0, y: 0, w: 4, h: 3 }),
              h: defaultHeight, // Override height with default
            },
            settings: widgetTemplate.settings || {},
          };

          console.log(`[Template] Adding widget ${i + 1}/${template.widgets.length}:`, widgetBody);

          const response = await fetch(`/api/dashboards/${dashboardId}/widgets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(widgetBody),
          });

          if (!response.ok) {
            const errorData = await response.json();
            console.error(`[Template] Failed to add widget ${i + 1}:`, errorData);
            errorCount++;
          } else {
            const result = await response.json();
            console.log(`[Template] Successfully added widget ${i + 1}:`, result);
            successCount++;
          }
        } catch (err) {
          console.error(`[Template] Error adding widget ${i + 1}:`, err);
          errorCount++;
        }
      }

      console.log(`[Template] Widget creation complete: ${successCount} succeeded, ${errorCount} failed`);

      // Small delay to ensure database commits are complete
      await new Promise(resolve => setTimeout(resolve, 500));

      if (params.id === 'new') {
        // Navigate to edit page with new ID after widgets are added
        // The useEffect will automatically load the dashboard when params.id changes
        showSuccess(`Dashboard created from template! Added ${successCount} widgets.`);
        router.push(`/dashboards/${dashboardId}/edit`);
      } else {
        // Reload dashboard to show all widgets for existing dashboard
        await loadDashboard();
        showSuccess(`Template applied! Added ${successCount} widgets.${errorCount > 0 ? ` (${errorCount} failed)` : ''}`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to apply template';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);

    if (!over || !dashboard || params.id === 'new') return;

    // Handle dropping widget from library onto canvas
    if (active.data.current?.type === 'widget' && over.data.current?.type === 'canvas') {
      const widgetType = active.data.current.widgetType;
      handleAddWidgetFromDrag(widgetType, { x: 0, y: 0 });
    }
  };

  if (features && features.custom_dashboards_enabled !== true) {
    return null;
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <DndContext collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Toolbar sx={{ borderBottom: `1px solid ${theme.palette.divider}`, flexWrap: { xs: 'wrap', md: 'nowrap' }, gap: { xs: 1, md: 0 }, minHeight: { xs: 'auto', md: 64 }, py: { xs: 1, md: 0 } }}>
        <IconButton onClick={() => router.push('/dashboards')} sx={{ mr: { xs: 0, md: 2 } }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6" sx={{ flexGrow: 1, fontSize: { xs: '1rem', md: '1.25rem' }, width: { xs: '100%', md: 'auto' }, mb: { xs: 1, md: 0 } }}>
          {params.id === 'new' ? 'Create Dashboard' : 'Edit Dashboard'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, width: { xs: '100%', md: 'auto' }, flexDirection: { xs: 'column', md: 'row' } }}>
          {params.id === 'new' && (
            <Button
              startIcon={<TemplateIcon />}
              onClick={() => setTemplatesOpen(true)}
              fullWidth={false}
              sx={{
                width: { xs: '100%', md: 'auto' },
                mr: { xs: 0, md: 1 },
              }}
            >
              Use Template
            </Button>
          )}
          <Button
            startIcon={<SaveIcon />}
            variant="contained"
            onClick={handleSave}
            disabled={saving || !name.trim()}
            fullWidth={false}
            sx={{
              width: { xs: '100%', md: 'auto' },
            }}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </Box>
      </Toolbar>

      <Box sx={{ flexGrow: 1, overflow: 'auto', p: { xs: 2, md: 3 } }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ p: { xs: 1.5, md: 2 } }}>
            <TextField
              fullWidth
              label="Dashboard Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              multiline
              rows={3}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ p: { xs: 1.5, md: 2 } }}>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, mb: 2, gap: { xs: 2, md: 0 } }}>
              <Typography variant="h6" sx={{ fontSize: { xs: '1rem', md: '1.25rem' } }}>Widgets</Typography>
              {params.id !== 'new' && (
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={() => setWidgetLibraryOpen(true)}
                  fullWidth={false}
                  sx={{
                    width: { xs: '100%', md: 'auto' },
                  }}
                >
                  Add Widget
                </Button>
              )}
            </Box>

            {params.id !== 'new' && dashboard ? (
              <DashboardEditor
                dashboardId={params.id as string}
                widgets={dashboard.widgets || []}
                onWidgetUpdate={handleWidgetUpdate}
                onWidgetSelect={handleWidgetSelect}
                selectedWidgetId={selectedWidget?.id || null}
                isDragging={isDragging}
                isResizing={isResizing}
                onDragStateChange={setIsDragging}
                onResizeStateChange={setIsResizing}
              />
            ) : (
              <Typography variant="body2" color="text.secondary">
                Save the dashboard first to add widgets
              </Typography>
            )}
          </CardContent>
        </Card>

        <WidgetLibrary
          open={widgetLibraryOpen}
          onClose={() => setWidgetLibraryOpen(false)}
          onWidgetSelect={handleAddWidget}
        />

        <WidgetConfigPanel
          open={configPanelOpen}
          widget={selectedWidget}
          onClose={() => {
            setConfigPanelOpen(false);
            setSelectedWidget(null);
          }}
          onSave={handleWidgetSave}
          onDelete={handleWidgetDelete}
        />

        <DashboardTemplates
          open={templatesOpen}
          onClose={() => setTemplatesOpen(false)}
          onSelect={handleTemplateSelect}
        />

        <DragOverlay>
          {activeDragId ? (
            <Paper
              sx={{
                p: 2,
                border: `1px solid ${theme.palette.divider}`,
                backgroundColor: theme.palette.action.hover,
                minWidth: 200,
              }}
            >
              <Typography variant="body1" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
                {activeDragId.replace('widget-', '')}
              </Typography>
            </Paper>
          ) : null}
        </DragOverlay>
      </Box>
      </Box>
    </DndContext>
  );
}

