'use client';

import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { Box, Typography, Paper, Autocomplete, TextField, Checkbox, IconButton, Dialog, DialogTitle } from '@mui/material';
import { useTheme } from '@mui/material/styles';
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

// Line configs will be created dynamically with theme colors
const getLineConfigs = (theme: any): LineConfig[] => [
  { key: 'tasksCreated', label: 'Tasks Created', color: theme.palette.text.primary, defaultVisible: true },
  { key: 'tasksCompleted', label: 'Tasks Completed', color: '#4CAF50', defaultVisible: true },
  { key: 'tasksInProgress', label: 'Tasks In Progress', color: theme.palette.text.secondary, defaultVisible: true },
  { key: 'tasksTodo', label: 'Tasks To Do', color: theme.palette.text.secondary, defaultVisible: false },
  { key: 'tasksOverdue', label: 'Tasks Overdue', color: theme.palette.text.secondary, defaultVisible: false },
  { key: 'tasksDueSoon', label: 'Tasks Due Soon', color: theme.palette.text.secondary, defaultVisible: false },
  { key: 'tasksHighPriority', label: 'High Priority Tasks', color: theme.palette.text.primary, defaultVisible: false },
  { key: 'tasksMediumPriority', label: 'Medium Priority Tasks', color: theme.palette.text.secondary, defaultVisible: false },
  { key: 'tasksLowPriority', label: 'Low Priority Tasks', color: theme.palette.text.secondary, defaultVisible: false },
  { key: 'tasksCriticalPriority', label: 'Critical Priority Tasks', color: theme.palette.text.primary, defaultVisible: false },
  { key: 'projectsCreated', label: 'Projects Created', color: theme.palette.text.secondary, defaultVisible: false },
  { key: 'projectsInProgress', label: 'Projects In Progress', color: theme.palette.text.primary, defaultVisible: false },
  { key: 'projectsBlueprintReady', label: 'Blueprint Ready Projects', color: '#4CAF50', defaultVisible: false },
  { key: 'tasksAssigned', label: 'Assigned Tasks', color: theme.palette.text.primary, defaultVisible: false },
  { key: 'tasksUnassigned', label: 'Unassigned Tasks', color: theme.palette.text.secondary, defaultVisible: false },
];

export default function ProjectsMultiLineChart({ projects, tasks }: ProjectsMultiLineChartProps) {
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1200);
  
  // Ensure projects and tasks are arrays (memoized to prevent unnecessary re-renders)
  const safeProjects = useMemo(() => Array.isArray(projects) ? projects : [], [projects]);
  const safeTasks = useMemo(() => Array.isArray(tasks) ? tasks : [], [tasks]);
  
  // Update container width on resize
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };
    
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);
  
  const LINE_CONFIGS = useMemo(() => getLineConfigs(theme), [theme]);
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
    
    // Add project dates with error handling
    safeProjects.forEach((project) => {
      try {
        if (project?.created_at) {
          const date = parseISO(project.created_at);
          if (!isNaN(date.getTime())) dates.push(date);
        }
        if (project?.updated_at) {
          const date = parseISO(project.updated_at);
          if (!isNaN(date.getTime())) dates.push(date);
        }
      } catch (e) {
        // Skip invalid dates silently
      }
    });
    
    // Add task dates with error handling
    safeTasks.forEach((task) => {
      try {
        if (task?.created_at) {
          const date = parseISO(task.created_at);
          if (!isNaN(date.getTime())) dates.push(date);
        }
        if (task?.start_date) {
          const date = parseISO(task.start_date);
          if (!isNaN(date.getTime())) dates.push(date);
        }
        if (task?.due_date) {
          const date = parseISO(task.due_date);
          if (!isNaN(date.getTime())) dates.push(date);
        }
      } catch (e) {
        // Skip invalid dates silently
      }
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
  }, [safeProjects, safeTasks]);

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
    tasks?.forEach((task) => {
      try {
        if (task?.created_at) {
          const date = parseISO(task.created_at);
          if (!isNaN(date.getTime())) {
            const key = format(startOfDay(date), 'yyyy-MM-dd');
            const point = dataMap.get(key);
            if (point) {
              point.tasksCreated++;
            }
          }
        }
      } catch (e) {
        // Skip invalid dates
      }
    });

    // Count tasks completed per day
    tasks?.forEach((task) => {
      try {
        if (task?.status === 'done' && task?.updated_at) {
          const date = parseISO(task.updated_at);
          if (!isNaN(date.getTime())) {
            const key = format(startOfDay(date), 'yyyy-MM-dd');
            const point = dataMap.get(key);
            if (point) {
              point.tasksCompleted++;
            }
          }
        }
      } catch (e) {
        // Skip invalid dates
      }
    });

    // Count tasks by status per day (cumulative)
    timelineDays.forEach((day) => {
      const key = format(day, 'yyyy-MM-dd');
      const point = dataMap.get(key);
      if (!point) return;

      // Tasks in progress
      const tasksInProgress = tasks?.filter((task) => {
        try {
          if (task?.status !== 'in_progress') return false;
          if (!task?.created_at) return true; // Count if no created date
          const created = parseISO(task.created_at);
          if (isNaN(created.getTime())) return true; // Count if invalid date
          return !isAfter(day, created);
        } catch {
          return false;
        }
      }).length || 0;
      point.tasksInProgress = tasksInProgress;

      // Tasks todo
      const tasksTodo = tasks?.filter((task) => {
        try {
          if (task?.status !== 'todo') return false;
          if (!task?.created_at) return true; // Count if no created date
          const created = parseISO(task.created_at);
          if (isNaN(created.getTime())) return true; // Count if invalid date
          return !isAfter(day, created);
        } catch {
          return false;
        }
      }).length || 0;
      point.tasksTodo = tasksTodo;

      // Tasks overdue (due date passed and not completed)
      const tasksOverdue = tasks?.filter((task) => {
        try {
          if (!task?.due_date || task?.status === 'done') return false;
          const dueDate = parseISO(task.due_date);
          if (isNaN(dueDate.getTime())) return false;
          const created = task?.created_at ? parseISO(task.created_at) : null;
          if (created && isNaN(created.getTime())) return false;
          return (
            isBefore(dueDate, day) &&
            (!created || !isAfter(day, created))
          );
        } catch {
          return false;
        }
      }).length || 0;
      point.tasksOverdue = tasksOverdue;

      // Tasks due soon (within 7 days)
      const sevenDaysLater = new Date(day.getTime() + 7 * 24 * 60 * 60 * 1000);
      const tasksDueSoon = tasks?.filter((task) => {
        try {
          if (!task?.due_date || task?.status === 'done') return false;
          const dueDate = parseISO(task.due_date);
          if (isNaN(dueDate.getTime())) return false;
          const created = task?.created_at ? parseISO(task.created_at) : null;
          if (created && isNaN(created.getTime())) return false;
          return (
            !isBefore(dueDate, day) &&
            !isAfter(dueDate, sevenDaysLater) &&
            (!created || !isAfter(day, created))
          );
        } catch {
          return false;
        }
      }).length || 0;
      point.tasksDueSoon = tasksDueSoon;

      // Tasks by priority
      const tasksHighPriority = tasks?.filter((task) => {
        try {
          if (task?.priority !== 'high') return false;
          const created = task?.created_at ? parseISO(task.created_at) : null;
          const completed = task?.status === 'done' && task?.updated_at ? parseISO(task.updated_at) : null;
          if (created && isNaN(created.getTime())) return false;
          if (completed && isNaN(completed.getTime())) return false;
          return (
            (!created || !isAfter(day, created)) &&
            (!completed || !isBefore(day, completed))
          );
        } catch {
          return false;
        }
      }).length || 0;
      point.tasksHighPriority = tasksHighPriority;

      const tasksMediumPriority = tasks?.filter((task) => {
        try {
          if (task?.priority !== 'medium') return false;
          const created = task?.created_at ? parseISO(task.created_at) : null;
          const completed = task?.status === 'done' && task?.updated_at ? parseISO(task.updated_at) : null;
          if (created && isNaN(created.getTime())) return false;
          if (completed && isNaN(completed.getTime())) return false;
          return (
            (!created || !isAfter(day, created)) &&
            (!completed || !isBefore(day, completed))
          );
        } catch {
          return false;
        }
      }).length || 0;
      point.tasksMediumPriority = tasksMediumPriority;

      const tasksLowPriority = tasks?.filter((task) => {
        try {
          if (task?.priority !== 'low') return false;
          const created = task?.created_at ? parseISO(task.created_at) : null;
          const completed = task?.status === 'done' && task?.updated_at ? parseISO(task.updated_at) : null;
          if (created && isNaN(created.getTime())) return false;
          if (completed && isNaN(completed.getTime())) return false;
          return (
            (!created || !isAfter(day, created)) &&
            (!completed || !isBefore(day, completed))
          );
        } catch {
          return false;
        }
      }).length || 0;
      point.tasksLowPriority = tasksLowPriority;

      const tasksCriticalPriority = tasks?.filter((task) => {
        try {
          if (task?.priority !== 'critical') return false;
          const created = task?.created_at ? parseISO(task.created_at) : null;
          const completed = task?.status === 'done' && task?.updated_at ? parseISO(task.updated_at) : null;
          if (created && isNaN(created.getTime())) return false;
          if (completed && isNaN(completed.getTime())) return false;
          return (
            (!created || !isAfter(day, created)) &&
            (!completed || !isBefore(day, completed))
          );
        } catch {
          return false;
        }
      }).length || 0;
      point.tasksCriticalPriority = tasksCriticalPriority;

      // Tasks assigned vs unassigned
      const tasksAssigned = tasks?.filter((task) => {
        try {
          if (!task?.assignee_id) return false;
          const created = task?.created_at ? parseISO(task.created_at) : null;
          const completed = task?.status === 'done' && task?.updated_at ? parseISO(task.updated_at) : null;
          if (created && isNaN(created.getTime())) return false;
          if (completed && isNaN(completed.getTime())) return false;
          return (
            (!created || !isAfter(day, created)) &&
            (!completed || !isBefore(day, completed))
          );
        } catch {
          return false;
        }
      }).length || 0;
      point.tasksAssigned = tasksAssigned;

      const tasksUnassigned = tasks?.filter((task) => {
        try {
          if (task?.assignee_id) return false;
          const created = task?.created_at ? parseISO(task.created_at) : null;
          const completed = task?.status === 'done' && task?.updated_at ? parseISO(task.updated_at) : null;
          if (created && isNaN(created.getTime())) return false;
          if (completed && isNaN(completed.getTime())) return false;
          return (
            (!created || !isAfter(day, created)) &&
            (!completed || !isBefore(day, completed))
          );
        } catch {
          return false;
        }
      }).length || 0;
      point.tasksUnassigned = tasksUnassigned;
    });

    // Count projects by status per day (cumulative)
    timelineDays.forEach((day) => {
      const key = format(day, 'yyyy-MM-dd');
      const point = dataMap.get(key);
      if (!point) return;

      // Projects created
      const projectsCreated = projects?.filter((project) => {
        try {
          if (!project?.created_at) return false;
          const created = parseISO(project.created_at);
          if (isNaN(created.getTime())) return false;
          return !isAfter(day, created);
        } catch {
          return false;
        }
      }).length || 0;
      point.projectsCreated = projectsCreated;

      // Projects in progress
      const projectsInProgress = projects?.filter((project) => {
        try {
          if (project?.status !== 'in_progress') return false;
          if (!project?.created_at) return true; // Count if no created date
          const created = parseISO(project.created_at);
          if (isNaN(created.getTime())) return true; // Count if invalid date
          return !isAfter(day, created);
        } catch {
          return false;
        }
      }).length || 0;
      point.projectsInProgress = projectsInProgress;

      // Projects blueprint ready
      const projectsBlueprintReady = projects?.filter((project) => {
        try {
          if (project?.status !== 'blueprint_ready') return false;
          if (!project?.created_at) return true; // Count if no created date
          const created = parseISO(project.created_at);
          if (isNaN(created.getTime())) return true; // Count if invalid date
          return !isAfter(day, created);
        } catch {
          return false;
        }
      }).length || 0;
      point.projectsBlueprintReady = projectsBlueprintReady;
    });

    return Array.from(dataMap.values());
  }, [timelineDays, projects, tasks]); // safeProjects and safeTasks are memoized from projects/tasks

  // Calculate chart dimensions - use container width or fallback to 1200
  const chartWidth = Math.max(containerWidth - 48, 800); // Subtract padding from container
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
  }, [visibleChartData, visibleLines, LINE_CONFIGS]);

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
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'flex-start' }, mb: 3, gap: { xs: 2, md: 0 } }}>
          <Typography
            variant="h6"
            sx={{
              color: theme.palette.text.primary,
              fontWeight: 600,
              fontSize: { xs: '1rem', md: '1.25rem' },
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
                  minWidth: { xs: '100%', md: 250 },
                  width: { xs: '100%', md: 'auto' },
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: theme.palette.action.hover,
                    color: theme.palette.text.primary,
                    '& fieldset': {
                      borderColor: theme.palette.divider,
                    },
                    '&:hover fieldset': {
                      borderColor: theme.palette.text.secondary,
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: theme.palette.text.primary,
                    },
                  },
                  '& .MuiInputLabel-root': {
                    color: theme.palette.text.secondary,
                  },
                  '& .MuiInputLabel-root.Mui-focused': {
                    color: theme.palette.text.primary,
                  },
                  '& .MuiInputBase-input': {
                    color: theme.palette.text.primary,
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
                    backgroundColor: selected ? theme.palette.action.hover : 'transparent',
                    '&:hover': {
                      backgroundColor: theme.palette.action.hover,
                    },
                  }}
                >
                  <Checkbox
                    checked={selected}
                    sx={{
                      color: theme.palette.text.primary,
                      '&.Mui-checked': {
                        color: theme.palette.text.primary,
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
                  <Typography variant="body2" sx={{ color: theme.palette.text.primary, flex: 1 }}>
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
                      backgroundColor: theme.palette.action.hover,
                      borderRadius: 1,
                      border: `1px solid ${theme.palette.divider}`,
                      fontSize: '0.75rem',
                      color: theme.palette.text.primary,
                      cursor: 'pointer',
                      '&:hover': {
                        backgroundColor: theme.palette.action.hover,
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
                    backgroundColor: theme.palette.action.hover,
                    borderRadius: 1,
                    border: `1px solid ${theme.palette.divider}`,
                    fontSize: '0.75rem',
                    color: theme.palette.text.primary,
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
                    color: theme.palette.text.primary,
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
                color: theme.palette.text.primary,
              },
              '& .MuiAutocomplete-clearIndicator': {
                color: theme.palette.text.secondary,
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
              color: theme.palette.text.primary,
              '&:hover': { backgroundColor: theme.palette.action.hover },
              '&.Mui-disabled': { color: theme.palette.text.secondary },
            }}
          >
            <ZoomIn fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={handleZoomOut}
            disabled={zoomLevel <= 1}
            sx={{
              color: theme.palette.text.primary,
              '&:hover': { backgroundColor: theme.palette.action.hover },
              '&.Mui-disabled': { color: theme.palette.text.secondary },
            }}
          >
            <ZoomOut fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={handleResetZoom}
            disabled={zoomLevel === 1 && panOffset === 0}
            sx={{
              color: theme.palette.text.primary,
              '&:hover': { backgroundColor: theme.palette.action.hover },
              '&.Mui-disabled': { color: theme.palette.text.secondary },
            }}
          >
            <FitScreen fontSize="small" />
          </IconButton>
          {zoomLevel > 1 && (
            <Typography variant="caption" sx={{ color: theme.palette.text.secondary, ml: 1 }}>
              {Math.round(zoomLevel * 100)}% zoom
            </Typography>
          )}
          {!isFullscreen && (
            <IconButton
              size="small"
              onClick={() => setIsFullscreen(true)}
              sx={{
                color: theme.palette.text.primary,
                '&:hover': { backgroundColor: theme.palette.action.hover },
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
                    stroke={theme.palette.divider}
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
                    fill={theme.palette.text.secondary}
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
                    fill={theme.palette.text.secondary}
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
                      fill={theme.palette.background.paper}
                      stroke={theme.palette.divider}
                      strokeWidth={1}
                      opacity={0.98}
                      filter="url(#tooltip-shadow)"
                    />
                    <text
                      x={tooltipX + tooltipWidth / 2}
                      y={tooltipY + 20}
                      fill={theme.palette.text.primary}
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
                            fill={theme.palette.text.secondary}
                            fontSize="11"
                            textAnchor="start"
                          >
                            {config.label}:
                          </text>
                          <text
                            x={tooltipX + tooltipWidth - 15}
                            y={rowY + 4}
                            fill={theme.palette.text.primary}
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
                stroke={theme.palette.divider}
                strokeWidth="1"
              />
              <line
                x1={padding.left}
                y1={padding.top + currentPlotHeight}
                x2={padding.left + currentPlotWidth}
                y2={padding.top + currentPlotHeight}
                stroke={theme.palette.divider}
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
      <Box ref={containerRef} sx={{ width: '100%' }}>
        {renderChartContent(false)}
      </Box>

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
            backgroundColor: `${theme.palette.background.default} !important`,
            border: 'none',
          },
        }}
        sx={{
          '& .MuiDialog-container': {
            backgroundColor: theme.palette.background.default,
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: `1px solid ${theme.palette.divider}`,
            pb: 2,
            backgroundColor: theme.palette.background.paper,
          }}
        >
          <Typography variant="h6" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
            Projects & Tasks Activity Over Time
          </Typography>
          <IconButton
            onClick={() => setIsFullscreen(false)}
            sx={{
              color: theme.palette.text.primary,
              '&:hover': { backgroundColor: theme.palette.action.hover },
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
