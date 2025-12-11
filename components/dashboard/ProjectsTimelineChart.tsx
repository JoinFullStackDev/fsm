'use client';

import { useMemo } from 'react';
import { Box, Typography, Paper, Tooltip } from '@mui/material';
import { format, parseISO, startOfDay, differenceInDays, eachDayOfInterval, isAfter, isBefore } from 'date-fns';
import type { Project } from '@/types/project';
import type { ProjectTask } from '@/types/project';

interface ProjectsTimelineChartProps {
  projects: Project[];
  tasks: ProjectTask[];
}

export default function ProjectsTimelineChart({ projects, tasks }: ProjectsTimelineChartProps) {
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
      if (task.start_date) dates.push(parseISO(task.start_date));
      if (task.due_date) dates.push(parseISO(task.due_date));
    });
    
    if (dates.length === 0) {
      const today = new Date();
      return { start: today, end: new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000) };
    }
    
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    
    // Add padding
    const start = startOfDay(new Date(minDate.getTime() - 7 * 24 * 60 * 60 * 1000));
    const end = startOfDay(new Date(maxDate.getTime() + 30 * 24 * 60 * 60 * 1000));
    
    return { start, end };
  }, [projects, tasks]);

  const timelineDays = useMemo(() => {
    return eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
  }, [dateRange]);

  const totalDays = timelineDays.length;
  const dayWidth = Math.max(2, Math.min(4, 1200 / totalDays));

  // Group tasks by project
  const tasksByProject = useMemo(() => {
    const grouped: Record<string, ProjectTask[]> = {};
    tasks.forEach((task) => {
      if (!grouped[task.project_id]) {
        grouped[task.project_id] = [];
      }
      grouped[task.project_id].push(task);
    });
    return grouped;
  }, [tasks]);

  // Get project color
  const getProjectColor = (projectId: string, index: number) => {
    const colors = ['#C9354A', '#E91E63', '#00FF88', '#9C27B0', '#FF6B35', '#2196F3'];
    return colors[index % colors.length];
  };

  return (
    <Paper
      sx={{
        backgroundColor: '#000',
        border: '2px solid rgba(0, 229, 255, 0.2)',
        borderRadius: 2,
        p: 3,
      }}
    >
      <Typography
        variant="h6"
        sx={{
          color: '#C9354A',
          fontWeight: 600,
          mb: 3,
        }}
      >
        Projects & Tasks Timeline
      </Typography>

      <Box sx={{ overflowX: 'auto', pb: 2 }}>
        {/* Timeline Header */}
        <Box
          sx={{
            position: 'relative',
            height: 60,
            mb: 2,
            minWidth: `${totalDays * dayWidth}px`,
          }}
        >
          {/* Month labels */}
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
            {timelineDays
              .filter((day, index) => index % 30 === 0 || index === timelineDays.length - 1)
              .map((day, index) => {
                const dayIndex = timelineDays.findIndex(
                  (d) => format(d, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
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
                        color: '#C9354A',
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

          {/* Day labels */}
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
            {timelineDays
              .filter((day, index) => index % 7 === 0 || index === timelineDays.length - 1)
              .map((day, index) => {
                const dayIndex = timelineDays.findIndex(
                  (d) => format(d, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
                );
                const leftPosition = (dayIndex / totalDays) * 100;

                return (
                  <Box
                    key={`day-${index}`}
                    sx={{
                      position: 'absolute',
                      left: `${leftPosition}%`,
                      transform: 'translateX(-50%)',
                      width: `${dayWidth * 7}px`,
                      borderRight: '2px solid rgba(0, 229, 255, 0.2)',
                      textAlign: 'center',
                      py: 0.5,
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: '0.7rem',
                        color: '#B0B0B0',
                      }}
                    >
                      {format(day, 'MMM d')}
                    </Typography>
                  </Box>
                );
              })}
          </Box>
        </Box>

        {/* Project Rows */}
        <Box sx={{ minWidth: `${totalDays * dayWidth}px` }}>
          {projects.map((project, projectIndex) => {
            const projectTasks = tasksByProject[project.id] || [];
            const projectColor = getProjectColor(project.id, projectIndex);

            return (
              <Box key={project.id} sx={{ mb: 3 }}>
                {/* Project Name */}
                <Box sx={{ mb: 1 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      color: '#E0E0E0',
                      fontWeight: 600,
                      mb: 0.5,
                    }}
                  >
                    {project.name}
                  </Typography>
                </Box>

                {/* Project Bar */}
                <Box
                  sx={{
                    position: 'relative',
                    height: 32,
                    backgroundColor: 'rgba(0, 229, 255, 0.05)',
                    borderRadius: 1,
                    mb: 1,
                  }}
                >
                  {project.created_at && (
                    <Tooltip title={`Project created: ${format(parseISO(project.created_at), 'MMM d, yyyy')}`}>
                      <Box
                        sx={{
                          position: 'absolute',
                          left: `${(differenceInDays(startOfDay(parseISO(project.created_at)), dateRange.start) / totalDays) * 100}%`,
                          width: `${(differenceInDays(dateRange.end, startOfDay(parseISO(project.created_at))) / totalDays) * 100}%`,
                          height: '100%',
                          backgroundColor: `${projectColor}40`,
                          border: `1px solid ${projectColor}`,
                          borderRadius: 1,
                        }}
                      />
                    </Tooltip>
                  )}
                </Box>

                {/* Task Bars */}
                {projectTasks.length > 0 && (
                  <Box sx={{ ml: 2 }}>
                    {projectTasks.slice(0, 10).map((task) => {
                      const taskStart = task.start_date
                        ? startOfDay(parseISO(task.start_date))
                        : task.due_date
                        ? startOfDay(parseISO(task.due_date))
                        : null;
                      const taskEnd = task.due_date
                        ? startOfDay(parseISO(task.due_date))
                        : task.start_date
                        ? startOfDay(parseISO(task.start_date))
                        : null;

                      if (!taskStart || !taskEnd) return null;

                      const displayStart = isBefore(taskStart, dateRange.start)
                        ? dateRange.start
                        : taskStart;
                      const displayEnd = isAfter(taskEnd, dateRange.end) ? dateRange.end : taskEnd;

                      const leftOffset = differenceInDays(displayStart, dateRange.start);
                      const width = differenceInDays(displayEnd, displayStart) + 1;

                      const priorityColors: Record<string, string> = {
                        critical: '#FF1744',
                        high: '#E91E63',
                        medium: '#C9354A',
                        low: '#9C27B0',
                      };

                      const taskColor = priorityColors[task.priority] || projectColor;

                      return (
                        <Tooltip
                          key={task.id}
                          title={`${task.title} - ${task.priority} priority`}
                        >
                          <Box
                            sx={{
                              position: 'relative',
                              height: 20,
                              mb: 0.5,
                              backgroundColor: 'rgba(0, 229, 255, 0.05)',
                              borderRadius: 1,
                            }}
                          >
                            <Box
                              sx={{
                                position: 'absolute',
                                left: `${leftOffset * dayWidth}px`,
                                width: `${width * dayWidth}px`,
                                height: '100%',
                                backgroundColor: `${taskColor}60`,
                                border: `1px solid ${taskColor}`,
                                borderRadius: 1,
                                display: 'flex',
                                alignItems: 'center',
                                px: 0.5,
                                overflow: 'hidden',
                              }}
                            >
                              <Typography
                                variant="caption"
                                sx={{
                                  color: '#FFFFFF',
                                  fontSize: '0.65rem',
                                  fontWeight: 500,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {task.title}
                              </Typography>
                            </Box>
                          </Box>
                        </Tooltip>
                      );
                    })}
                    {projectTasks.length > 10 && (
                      <Typography
                        variant="caption"
                        sx={{
                          color: '#B0B0B0',
                          fontStyle: 'italic',
                          ml: 1,
                        }}
                      >
                        +{projectTasks.length - 10} more tasks
                      </Typography>
                    )}
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      </Box>
    </Paper>
  );
}

