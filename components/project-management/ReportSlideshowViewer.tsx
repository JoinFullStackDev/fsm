'use client';

import { useState, useEffect } from 'react';
import { Box, IconButton, Button } from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import type { ReportContent } from '@/lib/reports/aiReportGenerator';
import type { WeeklyReportData, MonthlyReportData, ForecastReportData } from '@/lib/reports/dataAggregator';
import ReportGanttChart from './ReportGanttChart';
import { format, parseISO } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
} from '@mui/material';

interface ReportSlideshowViewerProps {
  projectName: string;
  reportType: 'weekly' | 'monthly' | 'forecast';
  dateRange: string;
  content: ReportContent;
  data: WeeklyReportData | MonthlyReportData | ForecastReportData;
  projectMembers?: Array<{ id: string; name: string | null }>;
  onDownload?: () => void;
}

export default function ReportSlideshowViewer({
  projectName,
  reportType,
  dateRange,
  content,
  data,
  projectMembers = [],
  onDownload,
}: ReportSlideshowViewerProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const reportTypeLabel = reportType.charAt(0).toUpperCase() + reportType.slice(1);
  
  // Calculate total slides
  const slides = [
    { type: 'title' },
    { type: 'summary' },
    { type: 'metrics' },
    { type: 'gantt' },
    ...(content.risks.length > 0 ? [{ type: 'risks' }] : []),
    { type: 'recommendations' },
    ...(content.teamWorkload ? [{ type: 'workload' }] : []),
  ];

  const totalSlides = slides.length;

  const showSlide = (index: number) => {
    if (index < 0 || index >= totalSlides) return;
    setCurrentSlide(index);
  };

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        showSlide(currentSlide + 1);
      } else if (e.key === 'ArrowLeft') {
        showSlide(currentSlide - 1);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentSlide]);

  const renderSlide = () => {
    const slide = slides[currentSlide];
    
    switch (slide.type) {
      case 'title':
        return (
          <Box sx={{ textAlign: 'center' }}>
            <Box
              component="h1"
              sx={{
                fontSize: '4rem',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #00E5FF 0%, #E91E63 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mb: 2,
              }}
            >
              {projectName}
            </Box>
            <Box
              component="h2"
              sx={{
                fontSize: '2.5rem',
                color: '#00E5FF',
                mb: 2,
                fontWeight: 600,
              }}
            >
              {reportTypeLabel} Report
            </Box>
            <Box sx={{ fontSize: '1.5rem', color: '#B0B0B0', mb: 1 }}>
              {dateRange}
            </Box>
            <Box sx={{ fontSize: '1rem', color: '#808080' }}>
              Generated: {format(new Date(), 'MMM d, yyyy')}
            </Box>
          </Box>
        );

      case 'summary':
        return (
          <Box>
            <Box
              component="h2"
              sx={{
                fontSize: '3rem',
                color: '#00E5FF',
                mb: 4,
                fontWeight: 600,
              }}
            >
              Executive Summary
            </Box>
            <Box
              sx={{
                fontSize: '1.5rem',
                lineHeight: 1.8,
                color: '#E0E0E0',
              }}
            >
              {content.executiveSummary}
            </Box>
          </Box>
        );

      case 'gantt':
        return (
          <Box sx={{ width: '100%', maxWidth: '1400px' }}>
            <Box
              component="h2"
              sx={{
                fontSize: '3rem',
                color: '#00E5FF',
                mb: 4,
                fontWeight: 600,
              }}
            >
              Timeline Overview
            </Box>
            <ReportGanttChart data={data} reportType={reportType} />
          </Box>
        );

      case 'metrics':
        const metrics = 'metrics' in data ? data.metrics : null;
        return (
          <Box sx={{ width: '100%', maxWidth: '1200px' }}>
            <Box
              component="h2"
              sx={{
                fontSize: '3rem',
                color: '#00E5FF',
                mb: 4,
                fontWeight: 600,
              }}
            >
              Metrics Overview
            </Box>
            {metrics && (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
                  gap: 3,
                  mt: 4,
                }}
              >
                <Box
                  sx={{
                    background: 'rgba(0, 229, 255, 0.1)',
                    border: '1px solid rgba(0, 229, 255, 0.3)',
                    borderRadius: 2,
                    p: 3,
                    textAlign: 'center',
                  }}
                >
                  <Box sx={{ fontSize: '3rem', fontWeight: 700, color: '#00E5FF', mb: 1 }}>
                    {metrics.total}
                  </Box>
                  <Box sx={{ fontSize: '1rem', color: '#B0B0B0', textTransform: 'uppercase' }}>
                    Total Tasks
                  </Box>
                </Box>
                <Box
                  sx={{
                    background: 'rgba(0, 229, 255, 0.1)',
                    border: '1px solid rgba(0, 229, 255, 0.3)',
                    borderRadius: 2,
                    p: 3,
                    textAlign: 'center',
                  }}
                >
                  <Box sx={{ fontSize: '3rem', fontWeight: 700, color: '#00E5FF', mb: 1 }}>
                    {metrics.completed}
                  </Box>
                  <Box sx={{ fontSize: '1rem', color: '#B0B0B0', textTransform: 'uppercase' }}>
                    Completed
                  </Box>
                </Box>
                <Box
                  sx={{
                    background: 'rgba(0, 229, 255, 0.1)',
                    border: '1px solid rgba(0, 229, 255, 0.3)',
                    borderRadius: 2,
                    p: 3,
                    textAlign: 'center',
                  }}
                >
                  <Box sx={{ fontSize: '3rem', fontWeight: 700, color: '#00E5FF', mb: 1 }}>
                    {metrics.inProgress}
                  </Box>
                  <Box sx={{ fontSize: '1rem', color: '#B0B0B0', textTransform: 'uppercase' }}>
                    In Progress
                  </Box>
                </Box>
                <Box
                  sx={{
                    background: 'rgba(0, 229, 255, 0.1)',
                    border: '1px solid rgba(0, 229, 255, 0.3)',
                    borderRadius: 2,
                    p: 3,
                    textAlign: 'center',
                  }}
                >
                  <Box sx={{ fontSize: '3rem', fontWeight: 700, color: '#00E5FF', mb: 1 }}>
                    {metrics.todo}
                  </Box>
                  <Box sx={{ fontSize: '1rem', color: '#B0B0B0', textTransform: 'uppercase' }}>
                    Todo
                  </Box>
                </Box>
                <Box
                  sx={{
                    background: metrics.overdue > 0 ? 'rgba(233, 30, 99, 0.1)' : 'rgba(0, 229, 255, 0.1)',
                    border: metrics.overdue > 0 ? '1px solid rgba(233, 30, 99, 0.3)' : '1px solid rgba(0, 229, 255, 0.3)',
                    borderRadius: 2,
                    p: 3,
                    textAlign: 'center',
                  }}
                >
                  <Box sx={{ fontSize: '3rem', fontWeight: 700, color: metrics.overdue > 0 ? '#E91E63' : '#00E5FF', mb: 1 }}>
                    {metrics.overdue}
                  </Box>
                  <Box sx={{ fontSize: '1rem', color: '#B0B0B0', textTransform: 'uppercase' }}>
                    Overdue
                  </Box>
                </Box>
                <Box
                  sx={{
                    background: 'rgba(0, 229, 255, 0.1)',
                    border: '1px solid rgba(0, 229, 255, 0.3)',
                    borderRadius: 2,
                    p: 3,
                    textAlign: 'center',
                  }}
                >
                  <Box sx={{ fontSize: '3rem', fontWeight: 700, color: '#00E5FF', mb: 1 }}>
                    {metrics.upcomingDeadlines}
                  </Box>
                  <Box sx={{ fontSize: '1rem', color: '#B0B0B0', textTransform: 'uppercase' }}>
                    Upcoming (7d)
                  </Box>
                </Box>
              </Box>
            )}
          </Box>
        );

      case 'risks':
        return (
          <Box>
            <Box
              component="h2"
              sx={{
                fontSize: '3rem',
                color: '#E91E63',
                mb: 4,
                fontWeight: 600,
              }}
            >
              Risks & Concerns
            </Box>
            <Box component="ul" sx={{ listStyle: 'none', fontSize: '1.5rem', lineHeight: 2.5 }}>
              {content.risks.map((risk, index) => (
                <Box
                  component="li"
                  key={index}
                  sx={{
                    pl: 4,
                    mb: 2,
                    position: 'relative',
                    '&:before': {
                      content: '"⚠"',
                      position: 'absolute',
                      left: 0,
                      fontSize: '1.5rem',
                    },
                  }}
                >
                  {risk}
                </Box>
              ))}
            </Box>
          </Box>
        );

      case 'recommendations':
        return (
          <Box>
            <Box
              component="h2"
              sx={{
                fontSize: '3rem',
                color: '#00E5FF',
                mb: 4,
                fontWeight: 600,
              }}
            >
              Recommendations
            </Box>
            <Box component="ul" sx={{ listStyle: 'none', fontSize: '1.5rem', lineHeight: 2.5 }}>
              {content.recommendations.map((rec, index) => (
                <Box
                  component="li"
                  key={index}
                  sx={{
                    pl: 4,
                    mb: 2,
                    position: 'relative',
                    '&:before': {
                      content: '"→"',
                      position: 'absolute',
                      left: 0,
                      color: '#00E5FF',
                      fontSize: '1.5rem',
                    },
                  }}
                >
                  {rec}
                </Box>
              ))}
            </Box>
          </Box>
        );

      case 'workload':
        // Get all tasks with assignee info
        let allTasks: (ProjectTask | ProjectTaskExtended)[] = [];
        
        if ('lastWeek' in data) {
          allTasks = [...data.lastWeek.tasks, ...data.thisWeek.tasks];
        } else if ('month' in data) {
          allTasks = data.month.tasks;
        } else {
          allTasks = data.tasks;
        }

        // Remove duplicates by task ID
        const uniqueTasks = Array.from(
          new Map(allTasks.map((task) => [task.id, task])).values()
        );

        // Sort by task title
        const sortedTasks = uniqueTasks.sort((a, b) => {
          return a.title.localeCompare(b.title);
        });

        return (
          <Box sx={{ width: '100%', maxWidth: '1400px' }}>
            <Box
              component="h2"
              sx={{
                fontSize: '3rem',
                color: '#00E5FF',
                mb: 4,
                fontWeight: 600,
              }}
            >
              Team Workload Analysis
            </Box>
            <TableContainer
              component={Paper}
              sx={{
                backgroundColor: 'rgba(0, 229, 255, 0.05)',
                border: '1px solid rgba(0, 229, 255, 0.2)',
                borderRadius: 2,
                maxHeight: 600,
                overflow: 'auto',
              }}
            >
              <Table stickyHeader>
                <TableHead sx={{ backgroundColor: '#121633' }}>
                  <TableRow>
                    <TableCell
                      sx={{
                        backgroundColor: '#121633',
                        color: '#00E5FF',
                        fontWeight: 600,
                        fontSize: '1.1rem',
                        borderBottom: '2px solid rgba(0, 229, 255, 0.3)',
                      }}
                    >
                      Task
                    </TableCell>
                    <TableCell
                      sx={{
                        backgroundColor: '#121633',
                        color: '#00E5FF',
                        fontWeight: 600,
                        fontSize: '1.1rem',
                        borderBottom: '2px solid rgba(0, 229, 255, 0.3)',
                      }}
                    >
                      Priority
                    </TableCell>
                    <TableCell
                      sx={{
                        backgroundColor: '#121633',
                        color: '#00E5FF',
                        fontWeight: 600,
                        fontSize: '1.1rem',
                        borderBottom: '2px solid rgba(0, 229, 255, 0.3)',
                      }}
                    >
                      Status
                    </TableCell>
                    <TableCell
                      sx={{
                        backgroundColor: '#121633',
                        color: '#00E5FF',
                        fontWeight: 600,
                        fontSize: '1.1rem',
                        borderBottom: '2px solid rgba(0, 229, 255, 0.3)',
                      }}
                    >
                      Due Date
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedTasks.map((task) => {
                    const statusColor = 
                      task.status === 'done' ? '#4CAF50' :
                      task.status === 'in_progress' ? '#00E5FF' :
                      task.status === 'todo' ? '#9E9E9E' : '#B0B0B0';

                    const priorityColor = 
                      task.priority === 'high' ? '#E91E63' :
                      task.priority === 'low' ? '#9C27B0' : '#00E5FF';

                    return (
                      <TableRow
                        key={task.id}
                        sx={{
                          '&:hover': {
                            backgroundColor: 'rgba(0, 229, 255, 0.05)',
                          },
                        }}
                      >
                        <TableCell
                          sx={{
                            color: '#E0E0E0',
                            fontSize: '0.95rem',
                            borderBottom: '1px solid rgba(0, 229, 255, 0.1)',
                          }}
                        >
                          {task.title}
                        </TableCell>
                        <TableCell
                          sx={{
                            borderBottom: '1px solid rgba(0, 229, 255, 0.1)',
                          }}
                        >
                          <Chip
                            label={task.priority || 'medium'}
                            size="small"
                            sx={{
                              backgroundColor: 
                                task.priority === 'high'
                                  ? 'rgba(233, 30, 99, 0.2)'
                                  : task.priority === 'low'
                                  ? 'rgba(156, 39, 176, 0.2)'
                                  : 'rgba(0, 229, 255, 0.2)',
                              color: priorityColor,
                              fontSize: '0.75rem',
                              fontWeight: 500,
                            }}
                          />
                        </TableCell>
                        <TableCell
                          sx={{
                            borderBottom: '1px solid rgba(0, 229, 255, 0.1)',
                          }}
                        >
                          <Chip
                            label={task.status === 'done' ? 'Done' : task.status === 'in_progress' ? 'In Progress' : task.status === 'todo' ? 'Todo' : task.status || 'Unknown'}
                            size="small"
                            sx={{
                              backgroundColor: 
                                task.status === 'done'
                                  ? 'rgba(76, 175, 80, 0.2)'
                                  : task.status === 'in_progress'
                                  ? 'rgba(0, 229, 255, 0.2)'
                                  : 'rgba(158, 158, 158, 0.2)',
                              color: statusColor,
                              fontSize: '0.75rem',
                              fontWeight: 500,
                            }}
                          />
                        </TableCell>
                        <TableCell
                          sx={{
                            color: '#E0E0E0',
                            fontSize: '0.95rem',
                            borderBottom: '1px solid rgba(0, 229, 255, 0.1)',
                          }}
                        >
                          {task.due_date ? format(parseISO(task.due_date), 'MMM d, yyyy') : 'No date'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: '#121633',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {/* Top controls */}
      <Box
        sx={{
          position: 'fixed',
          top: 16,
          right: 16,
          zIndex: 1001,
          display: 'flex',
          gap: 1,
        }}
      >
        {onDownload && (
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={onDownload}
            sx={{
              borderColor: '#00E5FF',
              color: '#00E5FF',
              '&:hover': {
                borderColor: '#00E5FF',
                backgroundColor: 'rgba(0, 229, 255, 0.1)',
              },
            }}
          >
            Download
          </Button>
        )}
      </Box>

      {/* Slide content */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 8,
          animation: 'fadeIn 0.5s ease-in',
          '@keyframes fadeIn': {
            from: { opacity: 0 },
            to: { opacity: 1 },
          },
        }}
      >
        {renderSlide()}
      </Box>

      {/* Navigation */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 30,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 0,
          zIndex: 1000,
        }}
      >
        <IconButton
          onClick={() => showSlide(currentSlide - 1)}
          disabled={currentSlide === 0}
          sx={{
            color: '#00E5FF',
            backgroundColor: 'rgba(0, 229, 255, 0.2)',
            border: '1px solid rgba(0, 229, 255, 0.5)',
            borderRight: 'none',
            borderRadius: '4px 0 0 4px',
            '&:hover': {
              backgroundColor: 'rgba(0, 229, 255, 0.3)',
            },
            '&.Mui-disabled': {
              opacity: 0.3,
            },
          }}
        >
          <ArrowBackIcon />
        </IconButton>
        <IconButton
          onClick={() => showSlide(currentSlide + 1)}
          disabled={currentSlide === totalSlides - 1}
          sx={{
            color: '#00E5FF',
            backgroundColor: 'rgba(0, 229, 255, 0.2)',
            border: '1px solid rgba(0, 229, 255, 0.5)',
            borderLeft: 'none',
            borderRadius: '0 4px 4px 0',
            '&:hover': {
              backgroundColor: 'rgba(0, 229, 255, 0.3)',
            },
            '&.Mui-disabled': {
              opacity: 0.3,
            },
          }}
        >
          <ArrowForwardIcon />
        </IconButton>
      </Box>

      {/* Slide indicators */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 100,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 1,
          zIndex: 1000,
        }}
      >
        {slides.map((_, index) => (
          <Box
            key={index}
            onClick={() => showSlide(index)}
            sx={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: index === currentSlide ? '#00E5FF' : 'rgba(0, 229, 255, 0.3)',
              cursor: 'pointer',
              transition: 'all 0.3s',
              transform: index === currentSlide ? 'scale(1.2)' : 'scale(1)',
              '&:hover': {
                backgroundColor: 'rgba(0, 229, 255, 0.5)',
              },
            }}
          />
        ))}
      </Box>
    </Box>
  );
}

