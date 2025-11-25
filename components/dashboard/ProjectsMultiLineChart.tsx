'use client';

import { useMemo, useState, useRef, useCallback } from 'react';
import { Box, Typography, Paper, Autocomplete, TextField, Checkbox, IconButton, Dialog, DialogTitle } from '@mui/material';
import { ZoomIn, ZoomOut, FitScreen, Fullscreen, FullscreenExit } from '@mui/icons-material';
import { format, parseISO, startOfDay, eachDayOfInterval, isAfter, isBefore } from 'date-fns';
import type { Project } from '@/types/project';
import type { ProjectTask } from '@/types/project';

interface ProjectsMultiLineChartProps {
  projects: Project[];
  tasks: ProjectTask[];
}

interface DataPoint {
  date: Date;
  tasksCreated: number;
  tasksCompleted: number;
  tasksInProgress: number;
  tasksTodo: number;
  tasksOverdue: number;
  tasksDueSoon: number;
  tasksHighPriority: number;
  tasksMediumPriority: number;
  tasksLowPriority: number;
  tasksCriticalPriority: number;
  projectsCreated: number;
  projectsInProgress: number;
  projectsBlueprintReady: number;
  tasksAssigned: number;
  tasksUnassigned: number;
}

interface LineConfig {
  key: keyof DataPoint;
  label: string;
  color: string;
  defaultVisible: boolean;
}

const LINE_CONFIGS: LineConfig[] = [
  { key: 'tasksCreated', label: 'Tasks Created', color: '#00E5FF', defaultVisible: true },
  { key: 'tasksCompleted', label: 'Tasks Completed', color: '#00FF88', defaultVisible: true },
  { key: 'tasksInProgress', label: 'Tasks In Progress', color: '#E91E63', defaultVisible: true },
  { key: 'tasksTodo', label: 'Tasks To Do', color: '#B0B0B0', defaultVisible: false },
  { key: 'tasksOverdue', label: 'Tasks Overdue', color: '#FF1744', defaultVisible: false },
  { key: 'tasksDueSoon', label: 'Tasks Due Soon', color: '#FF6B35', defaultVisible: false },
  { key: 'tasksHighPriority', label: 'High Priority Tasks', color: '#E91E63', defaultVisible: false },
  { key: 'tasksMediumPriority', label: 'Medium Priority Tasks', color: '#00E5FF', defaultVisible: false },
  { key: 'tasksLowPriority', label: 'Low Priority Tasks', color: '#9C27B0', defaultVisible: false },
  { key: 'tasksCriticalPriority', label: 'Critical Priority Tasks', color: '#FF1744', defaultVisible: false },
  { key: 'projectsCreated', label: 'Projects Created', color: '#9C27B0', defaultVisible: false },
  { key: 'projectsInProgress', label: 'Projects In Progress', color: '#2196F3', defaultVisible: false },
  { key: 'projectsBlueprintReady', label: 'Blueprint Ready Projects', color: '#00FF88', defaultVisible: false },
  { key: 'tasksAssigned', label: 'Assigned Tasks', color: '#5DFFFF', defaultVisible: false },
  { key: 'tasksUnassigned', label: 'Unassigned Tasks', color: '#666666', defaultVisible: false },
];

export default function ProjectsMultiLineChart({ projects, tasks }: ProjectsMultiLineChartProps) {
  const [visibleLines, setVisibleLines] = useState<Set<keyof DataPoint>>(
    new Set(LINE_CONFIGS.filter(config => config.defaultVisible).map(config => config.key))
  );
  
  // Zoom and pan state
  const [zoomLevel, setZoomLevel] = useState(1); // 1 = no zoom, >1 = zoomed in
  const [panOffset, setPanOffset] = useState(0); // Horizontal pan offset in pixels
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, offset: 0 });
  const chartContainerRef = useRef<HTMLDivElement>(null);
  
  // Tooltip state
  const [hoveredPoint, setHoveredPoint] = useState<{ data: DataPoint; x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  
  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Calculate date range from all projects and tasks
  const dateRange = useMemo(() => {
    const dates: Date[] = [];
    
    // Add project dates
    projects.forEach((project) => {
      if (project.created_at) dates.push(parseISO(project.created_at));
      if (project.updated_at) dates.push(parseISO(project.updated_at));
    });
    
    // Add task dates
    tasks.forEach((task) => {
      if (task.created_at) dates.push(parseISO(task.created_at));
      if (task.start_date) dates.push(parseISO(task.start_date));
      if (task.due_date) dates.push(parseISO(task.due_date));
    });
    
    if (dates.length === 0) {
      const today = new Date();
      return { start: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000), end: today };
    }
    
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    
    // Add padding
    const start = startOfDay(new Date(minDate.getTime() - 7 * 24 * 60 * 60 * 1000));
    const end = startOfDay(new Date(maxDate.getTime() + 7 * 24 * 60 * 60 * 1000));
    
    return { start, end };
  }, [projects, tasks]);

  const timelineDays = useMemo(() => {
    return eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
  }, [dateRange]);

  // Aggregate data by date
  const chartData = useMemo(() => {
    const dataMap = new Map<string, DataPoint>();

    // Initialize all dates
    timelineDays.forEach((day) => {
      const key = format(day, 'yyyy-MM-dd');
      dataMap.set(key, {
        date: day,
        tasksCreated: 0,
        tasksCompleted: 0,
        tasksInProgress: 0,
        tasksTodo: 0,
        tasksOverdue: 0,
        tasksDueSoon: 0,
        tasksHighPriority: 0,
        tasksMediumPriority: 0,
        tasksLowPriority: 0,
        tasksCriticalPriority: 0,
        projectsCreated: 0,
        projectsInProgress: 0,
        projectsBlueprintReady: 0,
        tasksAssigned: 0,
        tasksUnassigned: 0,
      });
    });

    // Count tasks created per day
    tasks.forEach((task) => {
      if (task.created_at) {
        const key = format(startOfDay(parseISO(task.created_at)), 'yyyy-MM-dd');
        const point = dataMap.get(key);
        if (point) {
          point.tasksCreated++;
        }
      }
    });

    // Count tasks completed per day
    tasks.forEach((task) => {
      if (task.status === 'done' && task.updated_at) {
        const key = format(startOfDay(parseISO(task.updated_at)), 'yyyy-MM-dd');
        const point = dataMap.get(key);
        if (point) {
          point.tasksCompleted++;
        }
      }
    });

    // Count tasks by status per day (cumulative)
    timelineDays.forEach((day) => {
      const key = format(day, 'yyyy-MM-dd');
      const point = dataMap.get(key);
      if (!point) return;

      // Tasks in progress
      const tasksInProgress = tasks.filter((task) => {
        if (task.status !== 'in_progress') return false;
        const created = task.created_at ? parseISO(task.created_at) : null;
        // Tasks in progress don't have a completed date
        return !created || !isAfter(day, created);
      }).length;
      point.tasksInProgress = tasksInProgress;

      // Tasks todo
      const tasksTodo = tasks.filter((task) => {
        if (task.status !== 'todo') return false;
        const created = task.created_at ? parseISO(task.created_at) : null;
        // Tasks todo don't have a completed date
        return !created || !isAfter(day, created);
      }).length;
      point.tasksTodo = tasksTodo;

      // Tasks overdue (due date passed and not completed)
      const tasksOverdue = tasks.filter((task) => {
        if (!task.due_date || task.status === 'done') return false;
        const dueDate = parseISO(task.due_date);
        const created = task.created_at ? parseISO(task.created_at) : null;
        return (
          isBefore(dueDate, day) &&
          (!created || !isAfter(day, created))
        );
      }).length;
      point.tasksOverdue = tasksOverdue;

      // Tasks due soon (within 7 days)
      const sevenDaysLater = new Date(day.getTime() + 7 * 24 * 60 * 60 * 1000);
      const tasksDueSoon = tasks.filter((task) => {
        if (!task.due_date || task.status === 'done') return false;
        const dueDate = parseISO(task.due_date);
        const created = task.created_at ? parseISO(task.created_at) : null;
        return (
          !isBefore(dueDate, day) &&
          !isAfter(dueDate, sevenDaysLater) &&
          (!created || !isAfter(day, created))
        );
      }).length;
      point.tasksDueSoon = tasksDueSoon;

      // Tasks by priority
      const tasksHighPriority = tasks.filter((task) => {
        if (task.priority !== 'high') return false;
        const created = task.created_at ? parseISO(task.created_at) : null;
        const completed = task.status === 'done' && task.updated_at ? parseISO(task.updated_at) : null;
        return (
          (!created || !isAfter(day, created)) &&
          (!completed || !isBefore(day, completed))
        );
      }).length;
      point.tasksHighPriority = tasksHighPriority;

      const tasksMediumPriority = tasks.filter((task) => {
        if (task.priority !== 'medium') return false;
        const created = task.created_at ? parseISO(task.created_at) : null;
        const completed = task.status === 'done' && task.updated_at ? parseISO(task.updated_at) : null;
        return (
          (!created || !isAfter(day, created)) &&
          (!completed || !isBefore(day, completed))
        );
      }).length;
      point.tasksMediumPriority = tasksMediumPriority;

      const tasksLowPriority = tasks.filter((task) => {
        if (task.priority !== 'low') return false;
        const created = task.created_at ? parseISO(task.created_at) : null;
        const completed = task.status === 'done' && task.updated_at ? parseISO(task.updated_at) : null;
        return (
          (!created || !isAfter(day, created)) &&
          (!completed || !isBefore(day, completed))
        );
      }).length;
      point.tasksLowPriority = tasksLowPriority;

      const tasksCriticalPriority = tasks.filter((task) => {
        if (task.priority !== 'critical') return false;
        const created = task.created_at ? parseISO(task.created_at) : null;
        const completed = task.status === 'done' && task.updated_at ? parseISO(task.updated_at) : null;
        return (
          (!created || !isAfter(day, created)) &&
          (!completed || !isBefore(day, completed))
        );
      }).length;
      point.tasksCriticalPriority = tasksCriticalPriority;

      // Tasks assigned vs unassigned
      const tasksAssigned = tasks.filter((task) => {
        if (!task.assignee_id) return false;
        const created = task.created_at ? parseISO(task.created_at) : null;
        const completed = task.status === 'done' && task.updated_at ? parseISO(task.updated_at) : null;
        return (
          (!created || !isAfter(day, created)) &&
          (!completed || !isBefore(day, completed))
        );
      }).length;
      point.tasksAssigned = tasksAssigned;

      const tasksUnassigned = tasks.filter((task) => {
        if (task.assignee_id) return false;
        const created = task.created_at ? parseISO(task.created_at) : null;
        const completed = task.status === 'done' && task.updated_at ? parseISO(task.updated_at) : null;
        return (
          (!created || !isAfter(day, created)) &&
          (!completed || !isBefore(day, completed))
        );
      }).length;
      point.tasksUnassigned = tasksUnassigned;
    });

    // Count projects by status per day (cumulative)
    timelineDays.forEach((day) => {
      const key = format(day, 'yyyy-MM-dd');
      const point = dataMap.get(key);
      if (!point) return;

      // Projects created
      const projectsCreated = projects.filter((project) => {
        if (!project.created_at) return false;
        const created = parseISO(project.created_at);
        return !isAfter(day, created);
      }).length;
      point.projectsCreated = projectsCreated;

      // Projects in progress
      const projectsInProgress = projects.filter((project) => {
        if (project.status !== 'in_progress') return false;
        const created = project.created_at ? parseISO(project.created_at) : null;
        return !created || !isAfter(day, created);
      }).length;
      point.projectsInProgress = projectsInProgress;

      // Projects blueprint ready
      const projectsBlueprintReady = projects.filter((project) => {
        if (project.status !== 'blueprint_ready') return false;
        const created = project.created_at ? parseISO(project.created_at) : null;
        return !created || !isAfter(day, created);
      }).length;
      point.projectsBlueprintReady = projectsBlueprintReady;
    });

    return Array.from(dataMap.values());
  }, [timelineDays, tasks, projects]);

  // Calculate chart dimensions
  const chartWidth = 1200;
  const chartHeight = 400;
  const padding = { top: 40, right: 40, bottom: 60, left: 60 };
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;
  
  // Calculate visible data range based on zoom and pan
  const visibleDataRange = useMemo(() => {
    const totalDataPoints = chartData.length;
    if (totalDataPoints === 0) return { startIndex: 0, endIndex: 0, visibleDataPoints: 0 };
    
    const visibleDataPoints = Math.max(1, Math.floor(totalDataPoints / zoomLevel));
    const dataPointWidth = plotWidth / totalDataPoints;
    const panInDataPoints = panOffset / dataPointWidth;
    
    const maxStartIndex = Math.max(0, totalDataPoints - visibleDataPoints);
    const startIndex = Math.min(maxStartIndex, Math.max(0, Math.floor(panInDataPoints)));
    const endIndex = Math.min(startIndex + visibleDataPoints, totalDataPoints);
    
    return { startIndex, endIndex, visibleDataPoints };
  }, [chartData.length, zoomLevel, panOffset, plotWidth]);
  
  // Get visible data points
  const visibleChartData = useMemo(() => {
    return chartData.slice(visibleDataRange.startIndex, visibleDataRange.endIndex);
  }, [chartData, visibleDataRange]);
  
  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(prev * 1.5, chartData.length / 10)); // Max zoom: show at least 10 data points
  }, [chartData.length]);
  
  const handleZoomOut = useCallback(() => {
    setZoomLevel(prev => Math.max(prev / 1.5, 1)); // Min zoom: 1x (no zoom)
    // Reset pan if zooming out to full view
    if (zoomLevel <= 1.5) {
      setPanOffset(0);
    }
  }, [zoomLevel]);
  
  const handleResetZoom = useCallback(() => {
    setZoomLevel(1);
    setPanOffset(0);
  }, []);
  
  // Mouse wheel zoom handler
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    const delta = e.deltaY;
    if (delta < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  }, [handleZoomIn, handleZoomOut]);
  
  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (zoomLevel <= 1) return; // Only allow panning when zoomed in
    setIsDragging(true);
    setDragStart({ x: e.clientX, offset: panOffset });
    e.preventDefault();
  }, [zoomLevel, panOffset]);
  
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || zoomLevel <= 1) return;
    
    const deltaX = e.clientX - dragStart.x;
    const totalDataPoints = chartData.length;
    if (totalDataPoints === 0) return;
    
    const visibleDataPoints = Math.max(1, Math.floor(totalDataPoints / zoomLevel));
    const dataPointWidth = plotWidth / totalDataPoints;
    const maxPan = Math.max(0, (totalDataPoints - visibleDataPoints) * dataPointWidth);
    
    const newOffset = dragStart.offset - deltaX;
    setPanOffset(Math.max(0, Math.min(maxPan, newOffset)));
    e.preventDefault();
  }, [isDragging, dragStart, zoomLevel, chartData.length, plotWidth]);
  
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);
  
  // Prevent page scroll when mouse leaves chart area while dragging
  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Find max values for scaling (only for visible lines and visible data range)
  const maxY = useMemo(() => {
    const maxValues = LINE_CONFIGS
      .filter(config => visibleLines.has(config.key))
      .map(config => {
        const values = visibleChartData.map(d => d[config.key] as number);
        return Math.max(...values, 0);
      });
    return Math.max(...maxValues, 10);
  }, [visibleChartData, visibleLines]);

  // Generate path strings for lines (using visible data)
  const generatePath = (dataKey: keyof DataPoint, color: string) => {
    if (visibleChartData.length === 0) return '';
    const points = visibleChartData.map((point, index) => {
      const x = padding.left + (index / Math.max(1, visibleChartData.length - 1)) * plotWidth;
      const y = padding.top + plotHeight - (point[dataKey] as number / maxY) * plotHeight;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    });
    return points.join(' ');
  };

  // Generate area paths (for filled areas under lines)
  const generateAreaPath = (dataKey: keyof DataPoint) => {
    if (visibleChartData.length === 0) return '';
    const points = visibleChartData.map((point, index) => {
      const x = padding.left + (index / Math.max(1, visibleChartData.length - 1)) * plotWidth;
      const y = padding.top + plotHeight - (point[dataKey] as number / maxY) * plotHeight;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    });
    const lastX = padding.left + plotWidth;
    const bottomY = padding.top + plotHeight;
    return `${points.join(' ')} L ${lastX} ${bottomY} L ${padding.left} ${bottomY} Z`;
  };

  // Render chart content (reusable for regular and fullscreen)
  const renderChartContent = (isFullscreen = false) => {
    const containerWidth = isFullscreen ? '100%' : chartWidth;
    const containerHeight = isFullscreen ? 'calc(100vh - 200px)' : chartHeight;
    const fsChartWidth = isFullscreen ? Math.max(1200, typeof window !== 'undefined' ? window.innerWidth - 100 : 1200) : chartWidth;
    const fsChartHeight = isFullscreen ? Math.max(600, typeof window !== 'undefined' ? window.innerHeight - 250 : 600) : chartHeight;
    const fsPlotWidth = fsChartWidth - padding.left - padding.right;
    const fsPlotHeight = fsChartHeight - padding.top - padding.bottom;
    
    // Use fullscreen dimensions if in fullscreen mode
    const currentChartWidth = isFullscreen ? fsChartWidth : chartWidth;
    const currentChartHeight = isFullscreen ? fsChartHeight : chartHeight;
    const currentPlotWidth = isFullscreen ? fsPlotWidth : plotWidth;
    const currentPlotHeight = isFullscreen ? fsPlotHeight : plotHeight;
    
    // Recalculate paths with current dimensions
    const generatePathFS = (dataKey: keyof DataPoint, color: string) => {
      if (visibleChartData.length === 0) return '';
      const points = visibleChartData.map((point, index) => {
        const x = padding.left + (index / Math.max(1, visibleChartData.length - 1)) * currentPlotWidth;
        const y = padding.top + currentPlotHeight - (point[dataKey] as number / maxY) * currentPlotHeight;
        return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
      });
      return points.join(' ');
    };

    const generateAreaPathFS = (dataKey: keyof DataPoint) => {
      if (visibleChartData.length === 0) return '';
      const points = visibleChartData.map((point, index) => {
        const x = padding.left + (index / Math.max(1, visibleChartData.length - 1)) * currentPlotWidth;
        const y = padding.top + currentPlotHeight - (point[dataKey] as number / maxY) * currentPlotHeight;
        return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
      });
      const lastX = padding.left + currentPlotWidth;
      const bottomY = padding.top + currentPlotHeight;
      return `${points.join(' ')} L ${lastX} ${bottomY} L ${padding.left} ${bottomY} Z`;
    };
    
    return (
      <>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Typography
            variant="h6"
            sx={{
              color: '#00E5FF',
              fontWeight: 600,
            }}
          >
            Projects & Tasks Activity Over Time
          </Typography>
          
          {/* Multi-select dropdown in top right */}
          <Autocomplete
            multiple
            options={LINE_CONFIGS}
            getOptionLabel={(option) => option.label}
            value={LINE_CONFIGS.filter(config => visibleLines.has(config.key))}
            onChange={(_, newValue) => {
              setVisibleLines(new Set(newValue.map(config => config.key)));
            }}
            groupBy={(option) => visibleLines.has(option.key) ? 'Selected' : 'Available'}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Select data series..."
                size="small"
                sx={{
                  minWidth: 250,
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    color: '#E0E0E0',
                    '& fieldset': {
                      borderColor: 'rgba(0, 229, 255, 0.3)',
                    },
                    '&:hover fieldset': {
                      borderColor: 'rgba(0, 229, 255, 0.5)',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#00E5FF',
                    },
                  },
                  '& .MuiInputLabel-root': {
                    color: '#B0B0B0',
                  },
                  '& .MuiInputLabel-root.Mui-focused': {
                    color: '#00E5FF',
                  },
                  '& .MuiInputBase-input': {
                    color: '#E0E0E0',
                  },
                }}
              />
            )}
            renderOption={(props, option, { selected }) => {
              const isDashed = option.key === 'projectsCreated';
              return (
                <Box
                  component="li"
                  {...props}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    py: 0.5,
                    backgroundColor: selected ? 'rgba(0, 229, 255, 0.1)' : 'transparent',
                    '&:hover': {
                      backgroundColor: selected ? 'rgba(0, 229, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                    },
                  }}
                >
                  <Checkbox
                    checked={selected}
                    sx={{
                      color: '#00E5FF',
                      '&.Mui-checked': {
                        color: '#00E5FF',
                      },
                    }}
                  />
                  {isDashed ? (
                    <svg width="16" height="3" style={{ display: 'block' }}>
                      <line
                        x1="0"
                        y1="1.5"
                        x2="16"
                        y2="1.5"
                        stroke={option.color}
                        strokeWidth="2"
                        strokeDasharray="3,3"
                      />
                    </svg>
                  ) : (
                    <Box
                      sx={{
                        width: 16,
                        height: 3,
                        backgroundColor: option.color,
                      }}
                    />
                  )}
                  <Typography variant="body2" sx={{ color: '#E0E0E0', flex: 1 }}>
                    {option.label}
                  </Typography>
                </Box>
              );
            }}
            renderTags={(value, getTagProps) => {
              if (value.length === 0) return null;
              
              if (value.length === 1) {
                const option = value[0];
                const { key, ...tagProps } = getTagProps({ index: 0 });
                const isDashed = option.key === 'projectsCreated';
                return (
                  <Box
                    key={key}
                    {...tagProps}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      px: 1,
                      py: 0.25,
                      backgroundColor: 'rgba(0, 229, 255, 0.1)',
                      borderRadius: 1,
                      border: '1px solid rgba(0, 229, 255, 0.3)',
                      fontSize: '0.75rem',
                      color: '#E0E0E0',
                      cursor: 'pointer',
                      '&:hover': {
                        backgroundColor: 'rgba(0, 229, 255, 0.2)',
                      },
                    }}
                  >
                    {isDashed ? (
                      <svg width="12" height="2" style={{ display: 'block' }}>
                        <line
                          x1="0"
                          y1="1"
                          x2="12"
                          y2="1"
                          stroke={option.color}
                          strokeWidth="2"
                          strokeDasharray="2,2"
                        />
                      </svg>
                    ) : (
                      <Box
                        sx={{
                          width: 12,
                          height: 2,
                          backgroundColor: option.color,
                        }}
                      />
                    )}
                    <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                      {option.label}
                    </Typography>
                  </Box>
                );
              }
              
              return (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    px: 1,
                    py: 0.25,
                    backgroundColor: 'rgba(0, 229, 255, 0.1)',
                    borderRadius: 1,
                    border: '1px solid rgba(0, 229, 255, 0.3)',
                    fontSize: '0.75rem',
                    color: '#E0E0E0',
                  }}
                >
                  <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                    {value.length} selected
                  </Typography>
                </Box>
              );
            }}
            renderGroup={(params) => (
              <Box key={params.key}>
                <Typography
                  variant="caption"
                  sx={{
                    px: 1.5,
                    py: 0.5,
                    color: '#00E5FF',
                    fontWeight: 600,
                    fontSize: '0.7rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  {params.group}
                </Typography>
                {params.children}
              </Box>
            )}
            sx={{
              '& .MuiAutocomplete-popupIndicator': {
                color: '#00E5FF',
              },
              '& .MuiAutocomplete-clearIndicator': {
                color: '#B0B0B0',
              },
            }}
          />
        </Box>

        {/* Zoom controls */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center', justifyContent: 'flex-end' }}>
          <IconButton
            size="small"
            onClick={handleZoomIn}
            disabled={zoomLevel >= chartData.length / 10}
            sx={{
              color: '#00E5FF',
              '&:hover': { backgroundColor: 'rgba(0, 229, 255, 0.1)' },
              '&.Mui-disabled': { color: '#666' },
            }}
          >
            <ZoomIn fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={handleZoomOut}
            disabled={zoomLevel <= 1}
            sx={{
              color: '#00E5FF',
              '&:hover': { backgroundColor: 'rgba(0, 229, 255, 0.1)' },
              '&.Mui-disabled': { color: '#666' },
            }}
          >
            <ZoomOut fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={handleResetZoom}
            disabled={zoomLevel === 1 && panOffset === 0}
            sx={{
              color: '#00E5FF',
              '&:hover': { backgroundColor: 'rgba(0, 229, 255, 0.1)' },
              '&.Mui-disabled': { color: '#666' },
            }}
          >
            <FitScreen fontSize="small" />
          </IconButton>
          {zoomLevel > 1 && (
            <Typography variant="caption" sx={{ color: '#B0B0B0', ml: 1 }}>
              {Math.round(zoomLevel * 100)}% zoom
            </Typography>
          )}
          {!isFullscreen && (
            <IconButton
              size="small"
              onClick={() => setIsFullscreen(true)}
              sx={{
                color: '#00E5FF',
                '&:hover': { backgroundColor: 'rgba(0, 229, 255, 0.1)' },
                ml: 1,
              }}
            >
              <Fullscreen fontSize="small" />
            </IconButton>
          )}
        </Box>

        <Box
          ref={chartContainerRef}
          sx={{
            overflow: 'hidden',
            pb: 2,
            cursor: zoomLevel > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
            userSelect: 'none',
          }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        >
          <Box sx={{ minWidth: currentChartWidth }}>
            <svg 
              ref={svgRef}
              width={currentChartWidth} 
              height={currentChartHeight} 
              style={{ display: 'block' }}
              onMouseLeave={() => setHoveredPoint(null)}
            >
              {/* Grid lines */}
              {[0, 1, 2, 3, 4].map((i) => {
                const y = padding.top + (i / 4) * currentPlotHeight;
                return (
                  <line
                    key={`grid-${i}`}
                    x1={padding.left}
                    y1={y}
                    x2={padding.left + currentPlotWidth}
                    y2={y}
                    stroke="rgba(0, 229, 255, 0.1)"
                    strokeWidth="1"
                  />
                );
              })}

              {/* Y-axis labels */}
              {[0, 1, 2, 3, 4].map((i) => {
                const value = Math.round((maxY * (4 - i)) / 4);
                const y = padding.top + (i / 4) * currentPlotHeight;
                return (
                  <text
                    key={`y-label-${i}`}
                    x={padding.left - 10}
                    y={y + 4}
                    fill="#B0B0B0"
                    fontSize="12"
                    textAnchor="end"
                  >
                    {value}
                  </text>
                );
              })}

              {/* X-axis labels - evenly spaced across full width regardless of zoom */}
              {(() => {
                const numLabels = 8;
                const labelPositions: Array<{ date: Date; x: number }> = [];
                
                if (visibleChartData.length > 0) {
                  const firstDate = visibleChartData[0].date;
                  const lastDate = visibleChartData[visibleChartData.length - 1].date;
                  
                  for (let i = 0; i < numLabels; i++) {
                    const x = padding.left + (i / (numLabels - 1)) * currentPlotWidth;
                    const dateProgress = i / (numLabels - 1);
                    const dateTime = firstDate.getTime() + (lastDate.getTime() - firstDate.getTime()) * dateProgress;
                    const date = new Date(dateTime);
                    
                    const closestPoint = visibleChartData.reduce((closest, point) => {
                      const closestDiff = Math.abs(closest.date.getTime() - date.getTime());
                      const pointDiff = Math.abs(point.date.getTime() - date.getTime());
                      return pointDiff < closestDiff ? point : closest;
                    }, visibleChartData[0]);
                    
                    labelPositions.push({ date: closestPoint.date, x });
                  }
                }
                
                return labelPositions.map(({ date, x }, index) => (
                  <text
                    key={`x-label-${index}`}
                    x={x}
                    y={currentChartHeight - padding.bottom + 20}
                    fill="#B0B0B0"
                    fontSize="11"
                    textAnchor="middle"
                  >
                    {format(date, 'MMM d')}
                  </text>
                ));
              })()}

              {/* Area fills and lines */}
              {LINE_CONFIGS.map((config) => {
                if (!visibleLines.has(config.key)) return null;
                const isDashed = config.key === 'projectsCreated';
                return (
                  <g key={`line-${config.key}`}>
                    <path
                      d={generateAreaPathFS(config.key)}
                      fill={`${config.color}20`}
                    />
                    <path
                      d={generatePathFS(config.key, config.color)}
                      fill="none"
                      stroke={config.color}
                      strokeWidth="2"
                      strokeDasharray={isDashed ? "5,5" : "none"}
                    />
                  </g>
                );
              })}

              {/* Invisible hover areas */}
              {visibleChartData.map((point, index) => {
                const x = padding.left + (index / Math.max(1, visibleChartData.length - 1)) * currentPlotWidth;
                return (
                  <rect
                    key={`hover-area-${index}`}
                    x={x - 10}
                    y={padding.top}
                    width={20}
                    height={currentPlotHeight}
                    fill="transparent"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => {
                      let maxYPos = padding.top + currentPlotHeight;
                      LINE_CONFIGS.forEach((config) => {
                        if (visibleLines.has(config.key)) {
                          const value = point[config.key] as number;
                          if (value > 0) {
                            const yPos = padding.top + currentPlotHeight - (value / maxY) * currentPlotHeight;
                            maxYPos = Math.min(maxYPos, yPos);
                          }
                        }
                      });
                      setHoveredPoint({ data: point, x, y: maxYPos });
                    }}
                  />
                );
              })}

              {/* Data points */}
              {visibleChartData.map((point, index) => {
                const x = padding.left + (index / Math.max(1, visibleChartData.length - 1)) * currentPlotWidth;
                return (
                  <g key={`points-${index}`}>
                    {LINE_CONFIGS.map((config) => {
                      if (!visibleLines.has(config.key)) return null;
                      const value = point[config.key] as number;
                      if (value <= 0) return null;
                      
                      const y = padding.top + currentPlotHeight - (value / maxY) * currentPlotHeight;
                      const isHovered = hoveredPoint?.data === point;
                      
                      return (
                        <circle
                          key={`point-${config.key}-${index}`}
                          cx={x}
                          cy={y}
                          r={isHovered ? 5 : 3}
                          fill={config.color}
                          stroke={isHovered ? '#FFFFFF' : 'none'}
                          strokeWidth={isHovered ? 2 : 0}
                          style={{ transition: 'r 0.2s, stroke-width 0.2s' }}
                        />
                      );
                    })}
                  </g>
                );
              })}
              
              {/* Tooltip */}
              {hoveredPoint && (() => {
                const tooltipWidth = 240;
                const tooltipHeight = Math.max(80, visibleLines.size * 20 + 40);
                const tooltipPadding = 10;
                
                let tooltipX = hoveredPoint.x - tooltipWidth / 2;
                if (tooltipX < padding.left) {
                  tooltipX = padding.left + tooltipPadding;
                } else if (tooltipX + tooltipWidth > currentChartWidth - padding.right) {
                  tooltipX = currentChartWidth - padding.right - tooltipWidth - tooltipPadding;
                }
                
                let tooltipY = hoveredPoint.y - tooltipHeight - 10;
                if (tooltipY < padding.top) {
                  tooltipY = hoveredPoint.y + 20;
                }
                
                return (
                  <g>
                    <defs>
                      <filter id="tooltip-shadow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
                        <feOffset dx="0" dy="2" result="offsetblur"/>
                        <feComponentTransfer>
                          <feFuncA type="linear" slope="0.3"/>
                        </feComponentTransfer>
                        <feMerge>
                          <feMergeNode/>
                          <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                      </filter>
                    </defs>
                    <rect
                      x={tooltipX}
                      y={tooltipY}
                      width={tooltipWidth}
                      height={tooltipHeight}
                      rx={4}
                      fill="#121633"
                      stroke="#00E5FF"
                      strokeWidth={1}
                      opacity={0.98}
                      filter="url(#tooltip-shadow)"
                    />
                    <text
                      x={tooltipX + tooltipWidth / 2}
                      y={tooltipY + 20}
                      fill="#00E5FF"
                      fontSize="12"
                      fontWeight="600"
                      textAnchor="middle"
                    >
                      {format(hoveredPoint.data.date, 'MMM d, yyyy')}
                    </text>
                    {LINE_CONFIGS.filter(config => visibleLines.has(config.key)).map((config, idx) => {
                      const value = hoveredPoint.data[config.key] as number;
                      const isDashed = config.key === 'projectsCreated';
                      const rowY = tooltipY + 40 + idx * 20;
                      return (
                        <g key={`tooltip-${config.key}`}>
                          <line
                            x1={tooltipX + 15}
                            y1={rowY}
                            x2={tooltipX + 35}
                            y2={rowY}
                            stroke={config.color}
                            strokeWidth={2}
                            strokeDasharray={isDashed ? "3,3" : "none"}
                          />
                          <text
                            x={tooltipX + 45}
                            y={rowY + 4}
                            fill="#E0E0E0"
                            fontSize="11"
                            textAnchor="start"
                          >
                            {config.label}:
                          </text>
                          <text
                            x={tooltipX + tooltipWidth - 15}
                            y={rowY + 4}
                            fill="#FFFFFF"
                            fontSize="11"
                            fontWeight="600"
                            textAnchor="end"
                          >
                            {value}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                );
              })()}

              {/* Axes */}
              <line
                x1={padding.left}
                y1={padding.top}
                x2={padding.left}
                y2={padding.top + currentPlotHeight}
                stroke="rgba(0, 229, 255, 0.3)"
                strokeWidth="1"
              />
              <line
                x1={padding.left}
                y1={padding.top + currentPlotHeight}
                x2={padding.left + currentPlotWidth}
                y2={padding.top + currentPlotHeight}
                stroke="rgba(0, 229, 255, 0.3)"
                strokeWidth="1"
              />
            </svg>
          </Box>
        </Box>
      </>
    );
  };

  return (
    <>
      <Paper
        sx={{
          backgroundColor: '#121633',
          border: '1px solid rgba(0, 229, 255, 0.2)',
          borderRadius: 2,
          p: 3,
        }}
      >
        {renderChartContent(false)}
      </Paper>

      {/* Fullscreen Dialog */}
      <Dialog
        open={isFullscreen}
        onClose={() => setIsFullscreen(false)}
        fullScreen
        PaperProps={{
          sx: {
            width: '100vw',
            height: '100vh',
            maxWidth: '100vw',
            maxHeight: '100vh',
            m: 0,
            borderRadius: 0,
            backgroundColor: '#121633 !important',
            border: 'none',
          },
        }}
        sx={{
          '& .MuiDialog-container': {
            backgroundColor: '#121633',
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid rgba(0, 229, 255, 0.2)',
            pb: 2,
            backgroundColor: '#121633',
          }}
        >
          <Typography variant="h6" sx={{ color: '#00E5FF', fontWeight: 600 }}>
            Projects & Tasks Activity Over Time
          </Typography>
          <IconButton
            onClick={() => setIsFullscreen(false)}
            sx={{
              color: '#00E5FF',
              '&:hover': { backgroundColor: 'rgba(0, 229, 255, 0.1)' },
            }}
          >
            <FullscreenExit />
          </IconButton>
        </DialogTitle>
        <Box sx={{ p: 3, height: 'calc(100vh - 80px)', overflow: 'auto' }}>
          {renderChartContent(true)}
        </Box>
      </Dialog>
    </>
  );
}
