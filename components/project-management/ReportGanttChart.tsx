'use client';

import { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
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

export default function ReportGanttChart({ data, reportType }: ReportGanttChartProps) {
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

  // Filter tasks with dates
  const tasksWithDates = useMemo(() => {
    return tasks
      .filter((task) => task.start_date || task.due_date)
      .slice(0, 20) // Limit to 20 tasks for readability
      .sort((a, b) => {
        const aDate = a.start_date ? parseISO(a.start_date) : a.due_date ? parseISO(a.due_date) : new Date(0);
        const bDate = b.start_date ? parseISO(b.start_date) : b.due_date ? parseISO(b.due_date) : new Date(0);
        return aDate.getTime() - bDate.getTime();
      });
  }, [tasks]);

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
                    color: '#00E5FF',
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
                    borderRight: '1px solid rgba(0, 229, 255, 0.1)',
                    backgroundColor: isWeekend
                      ? 'rgba(255, 255, 255, 0.02)'
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
                  borderRight: '2px solid rgba(0, 229, 255, 0.2)',
                  textAlign: 'center',
                  py: 0.5,
                  backgroundColor: isToday
                    ? 'rgba(0, 229, 255, 0.2)'
                    : isWeekend
                    ? 'rgba(255, 255, 255, 0.02)'
                    : 'transparent',
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: '0.7rem',
                    color: isToday ? '#00E5FF' : '#B0B0B0',
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

      {/* Task bars */}
      <Box sx={{ minWidth: `${totalDays * dayWidth}px` }}>
        {tasksWithDates.map((task, index) => {
          const taskBar = getTaskBar(task);
          if (!taskBar) return null;

          const priorityColor = PRIORITY_COLORS[task.priority] || '#00E5FF';

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
                    color: '#E0E0E0',
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
                  backgroundColor: 'rgba(0, 229, 255, 0.1)',
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
                      ? 'rgba(233, 30, 99, 0.6)'
                      : task.status === 'done'
                      ? 'rgba(76, 175, 80, 0.6)'
                      : priorityColor,
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: `1px solid ${priorityColor}`,
                    transition: 'all 0.2s',
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
          <Typography variant="caption" sx={{ color: '#B0B0B0' }}>
            High Priority
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 16,
              height: 16,
              backgroundColor: '#00E5FF',
              borderRadius: 1,
            }}
          />
          <Typography variant="caption" sx={{ color: '#B0B0B0' }}>
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
          <Typography variant="caption" sx={{ color: '#B0B0B0' }}>
            Completed
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 16,
              height: 16,
              backgroundColor: 'rgba(233, 30, 99, 0.6)',
              borderRadius: 1,
            }}
          />
          <Typography variant="caption" sx={{ color: '#B0B0B0' }}>
            Overdue
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

