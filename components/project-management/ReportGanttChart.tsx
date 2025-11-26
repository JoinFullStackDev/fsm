'use client';

import { useMemo, useState, useEffect } from 'react';
import { Box, Typography, IconButton, Collapse } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  format,
  parseISO,
  startOfDay,
  differenceInDays,
  eachDayOfInterval,
  isAfter,
  isBefore,
  addDays,
} from 'date-fns';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import type { ProjectTask, ProjectTaskExtended } from '@/types/project';
import type { WeeklyReportData, MonthlyReportData, ForecastReportData } from '@/lib/reports/dataAggregator';

interface ReportGanttChartProps {
  data: WeeklyReportData | MonthlyReportData | ForecastReportData;
  reportType: 'weekly' | 'monthly' | 'forecast';
}

const PRIORITY_COLORS: Record<string, string> = {
  high: '#E91E63',
  medium: '#00E5FF',
  low: '#9C27B0',
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

interface PhaseGroup {
  phaseNumber: number | null;
  phaseName: string;
  tasks: (ProjectTask | ProjectTaskExtended)[];
}

export default function ReportGanttChart({ data, reportType }: ReportGanttChartProps) {
  const theme = useTheme();

  // Get tasks based on report type
  const tasks = useMemo(() => {
    if ('lastWeek' in data) {
      // Weekly: combine last week and this week tasks
      return [...data.lastWeek.tasks, ...data.thisWeek.tasks];
    } else if ('month' in data) {
      // Monthly: use month tasks
      return data.month.tasks;
    } else {
      // Forecast: use forecast tasks
      return data.tasks;
    }
  }, [data]);

  // Group tasks by phase
  const phasesGrouped = useMemo(() => {
    const phaseMap = new Map<number | null, PhaseGroup>();
    
    // Initialize with "No Phase" group
    phaseMap.set(null, {
      phaseNumber: null,
      phaseName: 'No Phase',
      tasks: [],
    });

    tasks.forEach((task) => {
      const phaseNumber = task.phase_number ?? null;
      
      if (!phaseMap.has(phaseNumber)) {
        const phaseName = phaseNumber 
          ? (DEFAULT_PHASE_NAMES[phaseNumber] || `Phase ${phaseNumber}`)
          : 'No Phase';
        phaseMap.set(phaseNumber, {
          phaseNumber,
          phaseName,
          tasks: [],
        });
      }
      
      phaseMap.get(phaseNumber)!.tasks.push(task);
    });

    // Convert to array and sort by phase number (null last)
    const phases = Array.from(phaseMap.values()).sort((a, b) => {
      if (a.phaseNumber === null) return 1;
      if (b.phaseNumber === null) return -1;
      return a.phaseNumber - b.phaseNumber;
    });

    // Filter phases that have tasks with dates
    return phases.map(phase => ({
      ...phase,
      tasks: phase.tasks
        .filter((task) => task.start_date || task.due_date)
        .sort((a, b) => {
          const aDate = a.start_date ? parseISO(a.start_date) : a.due_date ? parseISO(a.due_date) : new Date(0);
          const bDate = b.start_date ? parseISO(b.start_date) : b.due_date ? parseISO(b.due_date) : new Date(0);
          return aDate.getTime() - bDate.getTime();
        }),
    })).filter(phase => phase.tasks.length > 0);
  }, [tasks]);

  // Initialize expanded phase to the first phase (or null if no phases)
  const [expandedPhase, setExpandedPhase] = useState<number | null>(null);

  // Set the first phase as expanded when phases are loaded
  useEffect(() => {
    if (phasesGrouped.length > 0 && expandedPhase === null) {
      setExpandedPhase(phasesGrouped[0].phaseNumber);
    }
  }, [phasesGrouped, expandedPhase]);

  const togglePhase = (phaseNumber: number | null) => {
    setExpandedPhase(prev => {
      // If clicking the same phase, close it; otherwise, open the new one
      return prev === phaseNumber ? null : phaseNumber;
    });
  };

  // Calculate date range
  const dateRange = useMemo(() => {
    let start: Date;
    let end: Date;

    if ('lastWeek' in data) {
      start = data.lastWeek.start;
      end = data.thisWeek.end;
    } else if ('month' in data) {
      start = data.month.start;
      end = data.month.end;
    } else {
      start = data.period.start;
      end = data.period.end;
    }

    return { start, end };
  }, [data]);


  // Calculate timeline days
  const timelineDays = useMemo(() => {
    const days = differenceInDays(dateRange.end, dateRange.start) + 1;
    return eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
  }, [dateRange]);

  // Calculate task bar position and width
  const getTaskBar = (task: ProjectTask | ProjectTaskExtended) => {
    const startDate = task.start_date ? parseISO(task.start_date) : task.due_date ? parseISO(task.due_date) : null;
    const endDate = task.due_date ? parseISO(task.due_date) : task.start_date ? addDays(parseISO(task.start_date), 3) : null;

    if (!startDate || !endDate) return null;

    const taskStart = startOfDay(startDate);
    const taskEnd = startOfDay(endDate);

    // Ensure task dates are within range
    const displayStart = isBefore(taskStart, dateRange.start) ? dateRange.start : taskStart;
    const displayEnd = isAfter(taskEnd, dateRange.end) ? dateRange.end : taskEnd;

    const leftOffset = differenceInDays(displayStart, dateRange.start);
    const width = differenceInDays(displayEnd, displayStart) + 1;

    return {
      left: leftOffset,
      width: Math.max(1, width),
      isOverdue: isBefore(taskEnd, new Date()) && task.status !== 'done',
    };
  };

  const totalDays = timelineDays.length;
  
  // Calculate smart date intervals based on total days
  const getDateInterval = () => {
    if (totalDays <= 7) return 1; // Show every day for a week
    if (totalDays <= 14) return 2; // Show every 2 days for 2 weeks
    if (totalDays <= 30) return 3; // Show every 3 days for a month
    if (totalDays <= 60) return 5; // Show every 5 days for 2 months
    return 7; // Show weekly for longer periods
  };

  const dateInterval = getDateInterval();
  const dayWidth = Math.max(8, Math.min(12, 1200 / totalDays)); // Responsive day width

  // Filter days to show based on interval
  const visibleDays = useMemo(() => {
    return timelineDays.filter((_, index) => index % dateInterval === 0 || index === timelineDays.length - 1);
  }, [timelineDays, dateInterval]);

  return (
    <Box sx={{ width: '100%', overflowX: 'auto' }}>
      {/* Timeline header */}
      <Box
        sx={{
          position: 'relative',
          height: 60,
          mb: 2,
          ml: '200px', // Offset to align with task bars (after task name column)
          minWidth: `${totalDays * dayWidth}px`,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        {/* Month labels row */}
        <Box
          sx={{
            display: 'flex',
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: 24,
          }}
        >
          {visibleDays.map((day, index) => {
            const isFirstOfMonth = day.getDate() === 1;
            const prevDay = index > 0 ? visibleDays[index - 1] : null;
            const showMonth = isFirstOfMonth || (prevDay && prevDay.getMonth() !== day.getMonth());
            
            if (!showMonth && index > 0) return null;

            const dayIndex = timelineDays.findIndex(d => 
              format(d, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
            );
            const leftPosition = (dayIndex / totalDays) * 100;

            return (
              <Box
                key={`month-${index}`}
                sx={{
                  position: 'absolute',
                  left: `${leftPosition}%`,
                  transform: 'translateX(-50%)',
                  px: 1,
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: '0.75rem',
                    color: theme.palette.text.primary,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {format(day, 'MMM yyyy')}
                </Typography>
              </Box>
            );
          })}
        </Box>

        {/* Day labels row */}
        <Box
          sx={{
            display: 'flex',
            position: 'absolute',
            top: 28,
            left: 0,
            width: '100%',
            height: 32,
          }}
        >
          {timelineDays.map((day, index) => {
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
            const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
            const shouldShow = index % dateInterval === 0 || index === timelineDays.length - 1;
            
            if (!shouldShow) {
              // Still show the border line
              return (
                <Box
                  key={index}
                  sx={{
                    width: `${dayWidth}px`,
                    minWidth: `${dayWidth}px`,
                    borderRight: `1px solid ${theme.palette.divider}`,
                    backgroundColor: isWeekend
                      ? theme.palette.background.paper
                      : 'transparent',
                  }}
                />
              );
            }
            
            return (
              <Box
                key={index}
                sx={{
                  width: `${dayWidth}px`,
                  minWidth: `${dayWidth}px`,
                  borderRight: `1px solid ${theme.palette.divider}`,
                  textAlign: 'center',
                  py: 0.5,
                  backgroundColor: isToday
                    ? theme.palette.action.hover
                    : isWeekend
                    ? theme.palette.background.paper
                    : 'transparent',
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: '0.7rem',
                    color: isToday ? theme.palette.text.primary : theme.palette.text.secondary,
                    display: 'block',
                    fontWeight: isToday ? 600 : 400,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {format(day, 'MMM d')}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* Phase groups */}
      <Box sx={{ minWidth: `${totalDays * dayWidth}px` }}>
        {phasesGrouped.map((phase) => {
          const isExpanded = expandedPhase === phase.phaseNumber;
          const phaseKey = phase.phaseNumber ?? 'no-phase';

          return (
            <Box key={phaseKey} sx={{ mb: 2 }}>
              {/* Phase header */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  mb: 1,
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover,
                  },
                  borderRadius: 1,
                  p: 0.5,
                }}
                onClick={() => togglePhase(phase.phaseNumber)}
              >
                <IconButton
                  size="small"
                  sx={{
                    color: theme.palette.text.primary,
                    p: 0.5,
                  }}
                >
                  {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
                <Typography
                  variant="body1"
                  sx={{
                    color: theme.palette.text.primary,
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    fontFamily: 'var(--font-rubik), Rubik, sans-serif',
                    flex: 1,
                  }}
                >
                  {phase.phaseName}
                </Typography>
              </Box>

              {/* Phase tasks */}
              <Collapse in={isExpanded}>
                <Box sx={{ pl: 4 }}>
                  {phase.tasks.map((task) => {
                    const taskBar = getTaskBar(task);
                    if (!taskBar) return null;

                    const priorityColor = PRIORITY_COLORS[task.priority] || theme.palette.text.primary;

                    return (
                      <Box
                        key={task.id}
                        sx={{
                          display: 'flex',
                          mb: 1.5,
                          minHeight: 32,
                          alignItems: 'center',
                        }}
                      >
                        {/* Task name */}
                        <Box
                          sx={{
                            width: 200,
                            minWidth: 200,
                            pr: 2,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <Typography
                            variant="body2"
                            sx={{
                              color: theme.palette.text.primary,
                              fontSize: '0.9rem',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {task.title}
                          </Typography>
                        </Box>

                        {/* Timeline bar */}
                        <Box
                          sx={{
                            position: 'relative',
                            width: `${totalDays * dayWidth}px`,
                            height: 24,
                            backgroundColor: theme.palette.action.hover,
                            borderRadius: 1,
                          }}
                        >
                          {/* Task bar */}
                          <Box
                            sx={{
                              position: 'absolute',
                              left: `${taskBar.left * dayWidth}px`,
                              width: `${taskBar.width * dayWidth}px`,
                              height: '100%',
                              backgroundColor: taskBar.isOverdue
                                ? theme.palette.error.main
                                : task.status === 'done'
                                ? '#4CAF50'
                                : priorityColor,
                              borderRadius: 1,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: `1px solid ${task.status === 'done' ? '#4CAF50' : priorityColor}`,
                              transition: 'all 0.2s',
                              opacity: task.status === 'done' ? 0.8 : 1,
                            }}
                          >
                            {taskBar.width > 3 && (
                              <Typography
                                variant="caption"
                                sx={{
                                  color: '#FFFFFF',
                                  fontSize: '0.7rem',
                                  fontWeight: 500,
                                  textAlign: 'center',
                                  px: 0.5,
                                }}
                              >
                                {task.status === 'done' ? '✓' : task.priority}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              </Collapse>
            </Box>
          );
        })}
      </Box>

      {/* Legend */}
      <Box
        sx={{
          display: 'flex',
          gap: 3,
          mt: 3,
          justifyContent: 'center',
          flexWrap: 'wrap',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 16,
              height: 16,
              backgroundColor: '#E91E63',
              borderRadius: 1,
            }}
          />
          <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
            High Priority
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 16,
              height: 16,
              backgroundColor: theme.palette.text.primary,
              borderRadius: 1,
            }}
          />
          <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
            Medium Priority
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 16,
              height: 16,
              backgroundColor: '#4CAF50',
              borderRadius: 1,
            }}
          />
          <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
            Completed
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 16,
              height: 16,
              backgroundColor: theme.palette.error.main,
              borderRadius: 1,
            }}
          />
          <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
            Overdue
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

