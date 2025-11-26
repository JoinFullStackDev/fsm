'use client';

import { useMemo, useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Tooltip,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { ProjectTask, ProjectTaskExtended } from '@/types/project';
import { 
  format, 
  parseISO, 
  isAfter, 
  isBefore, 
  addDays, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval,
  differenceInDays,
  startOfDay,
  subDays,
} from 'date-fns';

interface GanttChartProps {
  tasks: (ProjectTask | ProjectTaskExtended)[];
  onTaskClick: (task: ProjectTask | ProjectTaskExtended) => void;
  phaseNames?: Record<number, string>;
}

// Muted, less vibrant phase colors that work well with monochrome theme
const PHASE_COLORS: Record<number, string> = {
  1: '#8B7D8B', // Muted purple-gray
  2: '#7A8B8B', // Muted teal-gray
  3: '#8B8B7A', // Muted olive-gray
  4: '#7A7A8B', // Muted blue-gray
  5: '#8B7A7A', // Muted rose-gray
  6: '#7A8B7A', // Muted green-gray
};

// Fallback phase names for backward compatibility
const DEFAULT_PHASE_NAMES: Record<number, string> = {
  1: 'Concept Framing',
  2: 'Product Strategy',
  3: 'Rapid Prototype Definition',
  4: 'Analysis & User Stories',
  5: 'Build Accelerator',
  6: 'QA & Hardening',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: '#4CAF50',
  medium: '#FF9800',
  high: '#FF5722',
  critical: '#F44336',
};

type ViewMode = 'phases' | 'tasks';

export default function GanttChart({ tasks, onTaskClick, phaseNames = {} }: GanttChartProps) {
  const theme = useTheme();
  const [viewMode, setViewMode] = useState<ViewMode>('phases');

  // Merge provided phase names with defaults
  const getPhaseName = useCallback((phaseNumber: number): string => {
    return phaseNames[phaseNumber] || DEFAULT_PHASE_NAMES[phaseNumber] || `Phase ${phaseNumber}`;
  }, [phaseNames]);

  // Group tasks by phase
  const tasksByPhase = useMemo(() => {
    const grouped: Record<number, (ProjectTask | ProjectTaskExtended)[]> = {};
    tasks.forEach((task) => {
      const phaseNum = task.phase_number || 0;
      if (!grouped[phaseNum]) {
        grouped[phaseNum] = [];
      }
      grouped[phaseNum].push(task);
    });
    return grouped;
  }, [tasks]);

  // Calculate phase dates from tasks
  const phaseData = useMemo(() => {
    const phases: Array<{
      phaseNumber: number;
      name: string;
      startDate: Date | null;
      endDate: Date | null;
      taskCount: number;
    }> = [];

    // Get all unique phase numbers from tasks
    const uniquePhases = Array.from(new Set(tasks.map(t => t.phase_number).filter(Boolean) as number[]))
      .sort((a, b) => a - b);

    uniquePhases.forEach((phaseNum) => {
      const phaseTasks = tasksByPhase[phaseNum] || [];
      if (phaseTasks.length === 0) return;

      const tasksWithDates = phaseTasks.filter(
        (t) => t.start_date || t.due_date
      );

      if (tasksWithDates.length === 0) return;

      let earliestStart: Date | null = null;
      let latestEnd: Date | null = null;

      tasksWithDates.forEach((task) => {
        if (task.start_date) {
          const start = startOfDay(parseISO(task.start_date));
          if (!earliestStart || isBefore(start, earliestStart)) {
            earliestStart = start;
          }
        }
        if (task.due_date) {
          const end = startOfDay(parseISO(task.due_date));
          if (!latestEnd || isAfter(end, latestEnd)) {
            latestEnd = end;
          }
        }
      });

      // If we have due dates but no start dates, estimate start from earliest due date
      if (!earliestStart && latestEnd) {
        earliestStart = subDays(latestEnd, 7); // Default 7 days before
      }
      // If we have start dates but no end dates, estimate end from latest start date
      if (!latestEnd && earliestStart) {
        latestEnd = addDays(earliestStart, 7); // Default 7 days after
      }

      // Ensure start date is not after end date
      if (earliestStart && latestEnd && isAfter(earliestStart, latestEnd)) {
        // If start is after end, adjust end to be after start
        latestEnd = addDays(earliestStart, 7);
      }

      if (earliestStart && latestEnd) {
        phases.push({
          phaseNumber: phaseNum,
          name: getPhaseName(phaseNum),
          startDate: earliestStart,
          endDate: latestEnd,
          taskCount: phaseTasks.length,
        });
      }
    });

    return phases.sort((a, b) => a.phaseNumber - b.phaseNumber);
  }, [tasksByPhase, tasks, getPhaseName]);

  // Calculate accurate date range with padding (using both start_date and due_date)
  const dateRange = useMemo(() => {
    const allDates: Date[] = [];
    
    if (viewMode === 'phases') {
      // Use phase dates
      phaseData.forEach((phase) => {
        if (phase.startDate) {
          allDates.push(startOfDay(phase.startDate));
        }
        if (phase.endDate) {
          allDates.push(startOfDay(phase.endDate));
        }
      });
    } else {
      // Use task dates
      tasks.forEach((task) => {
        if (task.start_date) {
          allDates.push(startOfDay(parseISO(task.start_date)));
        }
        if (task.due_date) {
          allDates.push(startOfDay(parseISO(task.due_date)));
        }
      });
    }

    if (allDates.length === 0) {
      const today = startOfDay(new Date());
      return {
        start: startOfWeek(today, { weekStartsOn: 0 }), // Sunday start
        end: endOfWeek(addDays(today, 30), { weekStartsOn: 0 }),
      };
    }

    const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())));
    
    // Add padding: 1 week before, 2 weeks after
    const start = startOfWeek(subDays(minDate, 7), { weekStartsOn: 0 });
    const end = endOfWeek(addDays(maxDate, 14), { weekStartsOn: 0 });
    
    return { start, end };
  }, [tasks, phaseData, viewMode]);

  // Calculate total days in range
  const totalDays = useMemo(() => {
    return differenceInDays(dateRange.end, dateRange.start) + 1;
  }, [dateRange]);

  // Generate date columns - show days grouped by weeks
  const dateColumns = useMemo(() => {
    const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
    const weeks: Date[][] = [];
    let currentWeek: Date[] = [];
    let currentWeekStart = startOfWeek(days[0], { weekStartsOn: 0 });
    
    days.forEach((day) => {
      const weekStart = startOfWeek(day, { weekStartsOn: 0 });
      
      // If we've moved to a new week, save the current week and start a new one
      if (weekStart.getTime() !== currentWeekStart.getTime() && currentWeek.length > 0) {
        weeks.push(currentWeek);
        currentWeek = [];
        currentWeekStart = weekStart;
      }
      
      currentWeek.push(day);
    });
    
    // Add the last week
    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }
    
    return weeks;
  }, [dateRange]);

  // Calculate phase position and width
  const getPhaseBar = (phase: typeof phaseData[0]) => {
    if (!phase.startDate || !phase.endDate) return null;

    const start = startOfDay(phase.startDate);
    const end = startOfDay(phase.endDate);

    // Ensure dates are within range
    const displayStart = isBefore(start, dateRange.start)
      ? dateRange.start
      : start;
    const displayEnd = isAfter(end, dateRange.end)
      ? dateRange.end
      : end;

    const daysFromStart = differenceInDays(displayStart, dateRange.start);
    const daysToEnd = differenceInDays(displayEnd, displayStart) + 1;

    const leftPercent = (daysFromStart / totalDays) * 100;
    const widthPercent = (daysToEnd / totalDays) * 100;

    return {
      left: `${leftPercent}%`,
      width: `${widthPercent}%`,
      startDate: start,
      endDate: end,
    };
  };

  // Calculate task position and width accurately
  const getTaskBar = (task: ProjectTask | ProjectTaskExtended) => {
    if (!task.due_date) return null;
    
    const dueDate = startOfDay(parseISO(task.due_date));
    
    // Use actual start_date if available, otherwise calculate from due_date
    let taskStartDate: Date;
    if (task.start_date) {
      taskStartDate = startOfDay(parseISO(task.start_date));
    } else {
      // Fallback: 3-5 days before due_date based on priority
      const daysBefore = task.priority === 'critical' ? 2 : task.priority === 'high' ? 3 : task.priority === 'medium' ? 4 : 5;
      taskStartDate = subDays(dueDate, daysBefore);
    }
    
    // Ensure start date is not after due date
    if (isAfter(taskStartDate, dueDate)) {
      taskStartDate = subDays(dueDate, 1);
    }
    
    // Ensure start date is not before the range start (but don't change the actual start date)
    const displayStart = isBefore(taskStartDate, dateRange.start) 
      ? dateRange.start 
      : taskStartDate;
    
    // Calculate days from range start
    const daysFromStart = differenceInDays(displayStart, dateRange.start);
    const daysToEnd = differenceInDays(dueDate, displayStart) + 1; // +1 to include the end day
    
    // Calculate percentage positions
    const leftPercent = (daysFromStart / totalDays) * 100;
    const widthPercent = (daysToEnd / totalDays) * 100;
    
    return {
      left: `${leftPercent}%`,
      width: `${widthPercent}%`,
      startDate: taskStartDate, // Actual start date
      endDate: dueDate,
    };
  };

  // Sort tasks by due date
  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return parseISO(a.due_date).getTime() - parseISO(b.due_date).getTime();
    });
  }, [tasks]);

  const tasksWithDates = sortedTasks.filter((t) => t.due_date);
  const tasksWithoutDates = sortedTasks.filter((t) => !t.due_date);
  
  // Calculate today's position in the timeline
  const todayPosition = useMemo(() => {
    const today = startOfDay(new Date());
    if (isBefore(today, dateRange.start) || isAfter(today, dateRange.end)) {
      return null;
    }
    const daysFromStart = differenceInDays(today, dateRange.start);
    return (daysFromStart / totalDays) * 100;
  }, [dateRange, totalDays]);

  return (
    <Box sx={{ width: '100%', height: '100%', overflow: 'auto' }}>
      <Paper sx={{ p: 2, backgroundColor: theme.palette.background.paper, minHeight: 600, border: `1px solid ${theme.palette.divider}` }}>
        {/* Header */}
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6" sx={{ color: theme.palette.text.primary, mb: 1 }}>
              Gantt Chart
            </Typography>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
              {viewMode === 'phases'
                ? `${phaseData.length} phases`
                : `${tasksWithDates.length} tasks with dates, ${tasksWithoutDates.length} without dates`}
            </Typography>
          </Box>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, newMode) => {
              if (newMode !== null) {
                setViewMode(newMode);
              }
            }}
            size="small"
            sx={{
              '& .MuiToggleButton-root': {
                color: theme.palette.text.secondary,
                borderColor: theme.palette.divider,
                '&.Mui-selected': {
                  backgroundColor: theme.palette.action.hover,
                  color: theme.palette.text.primary,
                  borderColor: theme.palette.text.primary,
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover,
                  },
                },
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
                },
              },
            }}
          >
            <ToggleButton value="phases">Phases</ToggleButton>
            <ToggleButton value="tasks">Tasks</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* Timeline Header */}
        <Box
          sx={{
            display: 'flex',
            borderBottom: `1px solid ${theme.palette.divider}`,
            mb: 2,
            position: 'sticky',
            top: 0,
            backgroundColor: theme.palette.background.paper,
            zIndex: 10,
          }}
        >
          <Box sx={{ width: 250, p: 1, borderRight: `1px solid ${theme.palette.divider}` }}>
            <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>
              {viewMode === 'phases' ? 'Phase' : 'Task'}
            </Typography>
          </Box>
          <Box sx={{ flex: 1, display: 'flex', position: 'relative' }}>
            {/* Today indicator line in header */}
            {todayPosition !== null && (
              <Box
                sx={{
                  position: 'absolute',
                  left: `${todayPosition}%`,
                  top: 0,
                  bottom: 0,
                  width: '2px',
                  backgroundColor: theme.palette.text.primary,
                  zIndex: 15,
                  boxShadow: `0 0 6px ${theme.palette.text.primary}40`,
                  '&::before': {
                    content: '"Today"',
                    position: 'absolute',
                    top: -20,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: '0.7rem',
                    color: theme.palette.text.primary,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  },
                }}
              />
            )}
            {dateColumns.map((week, weekIndex) => {
              const weekStart = week[0];
              const weekEnd = week[week.length - 1];
              const weekWidth = (week.length / totalDays) * 100;
              
              return (
                <Box
                  key={weekIndex}
                  sx={{
                    width: `${weekWidth}%`,
                    borderRight: `1px solid ${theme.palette.divider}`,
                    p: 1,
                    textAlign: 'center',
                    position: 'relative',
                  }}
                >
                  <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontWeight: 500 }}>
                    {format(weekStart, 'MMM d')}
                  </Typography>
                  {weekIndex === dateColumns.length - 1 && (
                    <Typography variant="caption" sx={{ color: theme.palette.text.secondary, display: 'block', mt: 0.5 }}>
                      {format(weekEnd, 'MMM d')}
                    </Typography>
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* Phases or Tasks */}
        <Box>
          {viewMode === 'phases' ? (
            // Render phases
            phaseData.map((phase) => {
              const phaseBar = getPhaseBar(phase);
              if (!phaseBar) return null;

              const phaseColor = PHASE_COLORS[phase.phaseNumber] || theme.palette.text.secondary;
              const isOverdue = phase.endDate ? isBefore(phase.endDate, new Date()) : false;

              return (
                <Box
                  key={phase.phaseNumber}
                  sx={{
                    display: 'flex',
                    mb: 1.5,
                    minHeight: 40,
                    '&:hover': {
                      backgroundColor: theme.palette.action.hover,
                    },
                  }}
                >
                  {/* Phase Name */}
                  <Box
                    sx={{
                      width: 250,
                      p: 1,
                      borderRight: `1px solid ${theme.palette.divider}`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                    }}
                  >
                    <Box
                      sx={{
                        width: 4,
                        height: 28,
                        backgroundColor: phaseColor,
                        borderRadius: 1,
                      }}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          color: theme.palette.text.primary,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontWeight: 600,
                        }}
                      >
                        Phase {phase.phaseNumber}: {phase.name}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          color: theme.palette.text.secondary,
                          fontSize: '0.7rem',
                        }}
                      >
                        {phase.taskCount} task{phase.taskCount !== 1 ? 's' : ''} • {phase.startDate ? format(phase.startDate, 'MMM d') : 'TBD'} - {phase.endDate ? format(phase.endDate, 'MMM d, yyyy') : 'TBD'}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Timeline Bar */}
                  <Box
                    sx={{
                      flex: 1,
                      position: 'relative',
                      p: '8px 0',
                      minHeight: 40,
                    }}
                  >
                    {/* Today indicator line */}
                    {todayPosition !== null && (
                      <Box
                        sx={{
                          position: 'absolute',
                          left: `${todayPosition}%`,
                          top: 0,
                          bottom: 0,
                          width: '2px',
                          backgroundColor: theme.palette.text.primary,
                          zIndex: 3,
                          boxShadow: `0 0 4px ${theme.palette.text.primary}40`,
                          pointerEvents: 'none',
                        }}
                      />
                    )}

                    <Tooltip
                      title={
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                            Phase {phase.phaseNumber}: {phase.name}
                          </Typography>
                          <Typography variant="caption" sx={{ display: 'block' }}>
                            Start: {phaseBar.startDate ? format(phaseBar.startDate, 'MMM d, yyyy') : 'TBD'}
                          </Typography>
                          <Typography variant="caption" sx={{ display: 'block' }}>
                            End: {phaseBar.endDate ? format(phaseBar.endDate, 'MMM d, yyyy') : 'TBD'}
                          </Typography>
                          <Typography variant="caption" sx={{ display: 'block' }}>
                            Duration: {phaseBar.startDate && phaseBar.endDate ? Math.max(1, differenceInDays(phaseBar.endDate, phaseBar.startDate) + 1) : 'N/A'} days
                          </Typography>
                          <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                            Tasks: {phase.taskCount}
                          </Typography>
                          {isOverdue && (
                            <Typography variant="caption" sx={{ display: 'block', color: theme.palette.text.primary, mt: 0.5 }}>
                              ⚠ Phase overdue
                            </Typography>
                          )}
                        </Box>
                      }
                    >
                      <Box
                        sx={{
                          position: 'absolute',
                          left: phaseBar.left,
                          width: phaseBar.width,
                          height: 28,
                          backgroundColor: isOverdue ? '#FF6B6B' : phaseColor,
                          borderRadius: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: isOverdue ? '0 0 8px rgba(255, 107, 107, 0.5)' : 'none',
                          zIndex: 4,
                          '&:hover': {
                            opacity: 0.85,
                            transform: 'scaleY(1.15)',
                            zIndex: 6,
                          },
                          transition: 'all 0.2s',
                        }}
                      >
                        {parseFloat(phaseBar.width) > 5 && (
                          <Typography
                            variant="caption"
                            sx={{
                              color: '#fff',
                              fontWeight: 600,
                              fontSize: '0.75rem',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              px: 1,
                            }}
                          >
                            {phase.name}
                          </Typography>
                        )}
                      </Box>
                    </Tooltip>
                  </Box>
                </Box>
              );
            })
          ) : (
            // Render tasks (existing logic)
            tasksWithDates.map((task, index) => {
            const taskBar = getTaskBar(task);
            if (!taskBar) return null;

            const phaseColor = task.phase_number
              ? PHASE_COLORS[task.phase_number] || theme.palette.text.secondary
              : theme.palette.text.secondary;
            const priorityColor = PRIORITY_COLORS[task.priority] || theme.palette.text.secondary;
            
            // Check if task is overdue
            const isOverdue = task.due_date ? isBefore(parseISO(task.due_date), new Date()) : false;
            const isToday = task.due_date ? format(parseISO(task.due_date), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') : false;

            return (
              <Box
                key={task.id}
                sx={{
                  display: 'flex',
                  mb: 1.5,
                  minHeight: 36,
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover,
                  },
                }}
              >
                {/* Task Name */}
                <Box
                  sx={{
                    width: 250,
                    p: 1,
                    borderRight: `1px solid ${theme.palette.divider}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                  }}
                >
                  <Box
                    sx={{
                      width: 4,
                      height: 24,
                      backgroundColor: phaseColor,
                      borderRadius: 1,
                    }}
                  />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        color: theme.palette.text.primary,
                        cursor: 'pointer',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontWeight: 500,
                        '&:hover': {
                          color: theme.palette.text.primary,
                          opacity: 0.8,
                        },
                      }}
                      onClick={() => onTaskClick(task)}
                    >
                      {task.title}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: theme.palette.text.secondary,
                        fontSize: '0.7rem',
                      }}
                    >
                      {task.due_date ? format(parseISO(task.due_date), 'MMM d, yyyy') : 'No due date'}
                    </Typography>
                  </Box>
                </Box>

                {/* Timeline Bar */}
                <Box
                  sx={{
                    flex: 1,
                    position: 'relative',
                    p: '6px 0',
                    minHeight: 36,
                  }}
                >
                  {/* Today indicator line across all tasks */}
                  {todayPosition !== null && (
                    <Box
                      sx={{
                        position: 'absolute',
                        left: `${todayPosition}%`,
                        top: 0,
                        bottom: 0,
                        width: '2px',
                        backgroundColor: '#00E5FF',
                        zIndex: 3,
                        boxShadow: '0 0 4px rgba(0, 229, 255, 0.6)',
                        pointerEvents: 'none',
                      }}
                    />
                  )}
                  
                  <Tooltip
                    title={
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                          {task.title}
                        </Typography>
                        <Typography variant="caption" sx={{ display: 'block' }}>
                          Start: {taskBar.startDate ? format(taskBar.startDate, 'MMM d, yyyy') : 'TBD'}
                        </Typography>
                        <Typography variant="caption" sx={{ display: 'block' }}>
                          Due: {taskBar.endDate ? format(taskBar.endDate, 'MMM d, yyyy') : 'TBD'}
                        </Typography>
                        <Typography variant="caption" sx={{ display: 'block' }}>
                          Duration: {taskBar.startDate && taskBar.endDate ? Math.max(1, differenceInDays(taskBar.endDate, taskBar.startDate) + 1) : 'N/A'} days
                        </Typography>
                        <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                          Priority: {task.priority}
                        </Typography>
                        {task.phase_number && (
                          <Typography variant="caption" sx={{ display: 'block' }}>
                            Phase: {task.phase_number}
                          </Typography>
                        )}
                        {isOverdue && (
                          <Typography variant="caption" sx={{ display: 'block', color: theme.palette.text.primary, mt: 0.5 }}>
                            ⚠ Overdue
                          </Typography>
                        )}
                      </Box>
                    }
                  >
                    <Box
                      onClick={() => onTaskClick(task)}
                      sx={{
                        position: 'absolute',
                        left: taskBar.left,
                        width: taskBar.width,
                        height: 24,
                        backgroundColor: isOverdue ? theme.palette.text.secondary : priorityColor,
                        borderRadius: 1,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: isToday ? `2px solid ${theme.palette.text.primary}` : 'none',
                        boxShadow: isOverdue ? `0 0 8px ${theme.palette.text.secondary}40` : 'none',
                        zIndex: 4,
                        '&:hover': {
                          opacity: 0.85,
                          transform: 'scaleY(1.15)',
                          zIndex: 6,
                        },
                        transition: 'all 0.2s',
                      }}
                    >
                      {parseFloat(taskBar.width) > 3 && (
                        <Typography
                          variant="caption"
                          sx={{
                            color: '#fff',
                            fontWeight: 600,
                            fontSize: '0.7rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            px: 0.5,
                          }}
                        >
                          {task.title}
                        </Typography>
                      )}
                    </Box>
                  </Tooltip>
                </Box>
              </Box>
            );
          })
          )}

          {/* Tasks without dates (only show in tasks view) */}
          {viewMode === 'tasks' && tasksWithoutDates.length > 0 && (
            <Box sx={{ mt: 3, pt: 3, borderTop: `1px solid ${theme.palette.divider}` }}>
              <Typography variant="subtitle2" sx={{ color: theme.palette.text.secondary, mb: 2 }}>
                Tasks without dates ({tasksWithoutDates.length})
              </Typography>
              {tasksWithoutDates.map((task) => (
                <Box
                  key={task.id}
                  sx={{
                    display: 'flex',
                    mb: 1,
                    p: 1,
                    borderRadius: 1,
                    backgroundColor: theme.palette.action.hover,
                    border: `1px solid ${theme.palette.divider}`,
                    cursor: 'pointer',
                    '&:hover': {
                      backgroundColor: theme.palette.action.hover,
                      opacity: 0.8,
                    },
                  }}
                  onClick={() => onTaskClick(task)}
                >
                  <Box
                    sx={{
                      width: 4,
                      height: 20,
                      backgroundColor: task.phase_number
                        ? PHASE_COLORS[task.phase_number] || theme.palette.text.secondary
                        : theme.palette.text.secondary,
                      borderRadius: 1,
                      mr: 1,
                    }}
                  />
                  <Typography variant="body2" sx={{ color: theme.palette.text.primary, flex: 1 }}>
                    {task.title}
                  </Typography>
                  <Chip
                    label={task.priority}
                    size="small"
                    sx={{
                      backgroundColor: PRIORITY_COLORS[task.priority] || theme.palette.text.secondary,
                      color: '#fff',
                      fontSize: '0.7rem',
                      height: 20,
                    }}
                  />
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Paper>
    </Box>
  );
}

