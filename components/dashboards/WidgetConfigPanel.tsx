'use client';

import { useState, useEffect } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Divider,
  Chip,
} from '@mui/material';
import {
  Close as CloseIcon,
  Save as SaveIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

interface WidgetConfigPanelProps {
  open: boolean;
  widget: {
    id: string;
    widget_type: string;
    dataset: any;
    position: any;
    settings: any;
  } | null;
  onClose: () => void;
  onSave: (widgetId: string, dataset: any, settings: any, position?: any) => void;
  onDelete: (widgetId: string) => void;
}

export default function WidgetConfigPanel({
  open,
  widget,
  onClose,
  onSave,
  onDelete,
}: WidgetConfigPanelProps) {
  const theme = useTheme();
  const [dataset, setDataset] = useState<any>({});
  const [settings, setSettings] = useState<any>({});
  const [position, setPosition] = useState<any>({});

  useEffect(() => {
    if (widget) {
      setDataset(widget.dataset || {});
      setSettings(widget.settings || {});
      setPosition(widget.position || {});
    }
  }, [widget]);

  if (!widget) {
    return null;
  }

  const handleSave = () => {
    onSave(widget.id, dataset, settings, position);
    onClose();
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this widget?')) {
      onDelete(widget.id);
      onClose();
    }
  };

  const renderConfigFields = () => {
    switch (widget.widget_type) {
      case 'metric':
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Data Source</InputLabel>
              <Select
                value={dataset.dataSource || ''}
                onChange={(e) => setDataset({ ...dataset, dataSource: e.target.value })}
                label="Data Source"
              >
                <MenuItem value="task_count">Task Count</MenuItem>
                <MenuItem value="project_count">Project Count</MenuItem>
                <MenuItem value="tasks_due_today">Tasks Due Today</MenuItem>
                <MenuItem value="overdue_tasks">Overdue Tasks</MenuItem>
                <MenuItem value="phase_completion">Phase Completion</MenuItem>
                <MenuItem value="ai_tokens_used">AI Tokens Used</MenuItem>
                <MenuItem value="export_count">Export Count</MenuItem>
                <MenuItem value="user_count">User Count</MenuItem>
                <MenuItem value="opportunity_count">Opportunity Count</MenuItem>
                <MenuItem value="company_count">Company Count</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Format</InputLabel>
              <Select
                value={settings.format || 'number'}
                onChange={(e) => setSettings({ ...settings, format: e.target.value })}
                label="Format"
              >
                <MenuItem value="number">Number</MenuItem>
                <MenuItem value="currency">Currency</MenuItem>
                <MenuItem value="percentage">Percentage</MenuItem>
              </Select>
            </FormControl>
          </Box>
        );

      case 'chart':
        const availableDataSources = [
          { value: 'task_timeline', label: 'Task Timeline' },
          { value: 'phase_completion_timeline', label: 'Phase Completion Timeline' },
          { value: 'task_status_distribution', label: 'Task Status Distribution' },
          { value: 'task_priority_distribution', label: 'Task Priority Distribution' },
          { value: 'phase_status_distribution', label: 'Phase Status Distribution' },
          { value: 'ai_usage_timeline', label: 'AI Usage Timeline' },
          { value: 'export_timeline', label: 'Export Timeline' },
        ];
        
        const selectedDataSources = Array.isArray(dataset.dataSources) 
          ? dataset.dataSources 
          : dataset.dataSource 
            ? [dataset.dataSource] 
            : [];

        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Data Sources (Select multiple to compare)
            </Typography>
            <FormControl fullWidth>
              <Select
                multiple
                value={selectedDataSources}
                onChange={(e) => {
                  const values = typeof e.target.value === 'string' 
                    ? e.target.value.split(',') 
                    : e.target.value;
                  // If multiple selected, use dataSources array, otherwise use single dataSource
                  if (values.length > 1) {
                    setDataset({ ...dataset, dataSources: values, dataSource: undefined });
                  } else if (values.length === 1) {
                    setDataset({ ...dataset, dataSource: values[0], dataSources: undefined });
                  } else {
                    setDataset({ ...dataset, dataSource: undefined, dataSources: undefined });
                  }
                }}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {(selected as string[]).map((value) => (
                      <Chip
                        key={value}
                        label={availableDataSources.find(ds => ds.value === value)?.label || value}
                        size="small"
                      />
                    ))}
                  </Box>
                )}
              >
                {availableDataSources.map((ds) => (
                  <MenuItem key={ds.value} value={ds.value}>
                    {ds.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Chart Type</InputLabel>
              <Select
                value={settings.chartType || dataset.chartType || 'line'}
                onChange={(e) => setSettings({ ...settings, chartType: e.target.value })}
                label="Chart Type"
              >
                <MenuItem value="line">Line</MenuItem>
                <MenuItem value="bar">Bar</MenuItem>
                <MenuItem value="pie">Pie</MenuItem>
                <MenuItem value="area">Area</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Title"
              value={settings.title || ''}
              onChange={(e) => setSettings({ ...settings, title: e.target.value })}
            />
            <TextField
              fullWidth
              type="number"
              label="Height (px)"
              value={settings.height || 300}
              onChange={(e) => setSettings({ ...settings, height: parseInt(e.target.value) || 300 })}
            />
          </Box>
        );

      case 'table':
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Data Source</InputLabel>
              <Select
                value={dataset.dataSource || ''}
                onChange={(e) => setDataset({ ...dataset, dataSource: e.target.value })}
                label="Data Source"
              >
                <MenuItem value="tasks">Tasks</MenuItem>
                <MenuItem value="projects">Projects</MenuItem>
                <MenuItem value="opportunities">Opportunities</MenuItem>
                <MenuItem value="companies">Companies</MenuItem>
                <MenuItem value="recent_activity">Recent Activity</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Title"
              value={settings.title || ''}
              onChange={(e) => setSettings({ ...settings, title: e.target.value })}
            />
            <TextField
              fullWidth
              type="number"
              label="Max Rows"
              value={dataset.limit || 50}
              onChange={(e) => setDataset({ ...dataset, limit: parseInt(e.target.value) || 50 })}
            />
            <TextField
              fullWidth
              type="number"
              label="Max Height (px)"
              value={settings.maxHeight || 400}
              onChange={(e) => setSettings({ ...settings, maxHeight: parseInt(e.target.value) || 400 })}
            />
          </Box>
        );

      case 'ai_insight':
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Insight Type</InputLabel>
              <Select
                value={dataset.insight_type || 'project_health'}
                onChange={(e) => setDataset({ ...dataset, insight_type: e.target.value })}
                label="Insight Type"
              >
                <MenuItem value="project_health">Project Health</MenuItem>
                <MenuItem value="risk_analysis">Risk Analysis</MenuItem>
                <MenuItem value="bottleneck_detection">Bottleneck Detection</MenuItem>
                <MenuItem value="task_prioritization">Task Prioritization</MenuItem>
                <MenuItem value="timeline_prediction">Timeline Prediction</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Title"
              value={settings.title || ''}
              onChange={(e) => setSettings({ ...settings, title: e.target.value })}
            />
            <Chip
              label={dataset.autoGenerate !== false ? 'Auto-generate on first load' : 'Manual generation only'}
              color={dataset.autoGenerate !== false ? 'primary' : 'default'}
              onClick={() => setDataset({ ...dataset, autoGenerate: dataset.autoGenerate === false })}
            />
            {settings?.cachedInsight && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                Insight is cached. Use &quot;Refresh&quot; button in widget to regenerate.
              </Typography>
            )}
          </Box>
        );

      case 'rich_text':
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label="Title"
              value={settings.title || ''}
              onChange={(e) => setSettings({ ...settings, title: e.target.value })}
            />
            <TextField
              fullWidth
              label="Content (Markdown)"
              value={dataset.content || ''}
              onChange={(e) => setDataset({ ...dataset, content: e.target.value })}
              multiline
              rows={10}
              placeholder="Enter markdown content here..."
            />
          </Box>
        );

      default:
        return (
          <Typography variant="body2" color="text.secondary">
            No configuration options available for this widget type.
          </Typography>
        );
    }
  };

  // Size controls for all widget types
  const renderSizeControls = () => (
    <Box sx={{ mt: 3, pt: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
      <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
        Size
      </Typography>
      <Box sx={{ display: 'flex', gap: 2 }}>
        <TextField
          fullWidth
          type="number"
          label="Width (grid units)"
          value={position?.w || 4}
          onChange={(e) => {
            const w = parseInt(e.target.value) || 4;
            setPosition({ ...position, w: Math.max(2, Math.min(12, w)) });
          }}
          inputProps={{ min: 2, max: 12 }}
          helperText="Drag corners to resize, or set here"
        />
        <TextField
          fullWidth
          type="number"
          label="Height (grid units)"
          value={position?.h || 3}
          onChange={(e) => {
            const h = parseInt(e.target.value) || 3;
            setPosition({ ...position, h: Math.max(2, Math.min(10, h)) });
          }}
          inputProps={{ min: 2, max: 10 }}
          helperText="Drag corners to resize, or set here"
        />
      </Box>
    </Box>
  );

  return (
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        sx={{
          '& .MuiDrawer-paper': {
            width: 400,
            borderLeft: `1px solid ${theme.palette.divider}`,
            transform: 'translateY(60px)',
          },
        }}
      >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', maxHeight: 'calc(100vh - 60px)' }}>
        <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Widget Configuration</Typography>
            <IconButton size="small" onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {widget.widget_type}
          </Typography>
        </Box>

        <Box sx={{ p: 2, flexGrow: 1, overflow: 'auto' }}>
          {renderConfigFields()}
          {renderSizeControls()}
        </Box>

        <Box sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              fullWidth
            >
              Save
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={handleDelete}
            >
              Delete
            </Button>
          </Box>
        </Box>
      </Box>
    </Drawer>
  );
}

