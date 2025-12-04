'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Card,
  CardContent,
  Box,
  Typography,
  Chip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  useTheme,
  alpha,
} from '@mui/material';
import { useState, useEffect } from 'react';
import { CheckCircle as CheckCircleIcon, Autorenew as InProgressIcon } from '@mui/icons-material';

const mockProjects = [
  { id: 1, name: 'E-commerce Platform', phase: 'Phase 3', progress: 65 },
  { id: 2, name: 'Mobile App Redesign', phase: 'Phase 2', progress: 40 },
  { id: 3, name: 'API Integration', phase: 'Phase 4', progress: 80 },
];

const phases = ['Planning', 'Design', 'Development', 'Testing', 'Deployment', 'Launch'];

export default function MockDashboard() {
  const theme = useTheme();
  const [highlightedRow, setHighlightedRow] = useState(0);
  const [currentPhase, setCurrentPhase] = useState(0);

  // Cycle through highlighted rows
  useEffect(() => {
    const interval = setInterval(() => {
      setHighlightedRow((prev) => (prev + 1) % mockProjects.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Rolling phase animation
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPhase((prev) => (prev + 1) % 6);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Box
      sx={{
        position: 'relative',
        height: '100%',
        minHeight: 400,
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <Card
          sx={{
            background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.95)} 0%, ${alpha(theme.palette.background.paper, 0.85)} 100%)`,
            border: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
            borderRadius: 3,
            overflow: 'hidden',
            boxShadow: `0 8px 32px ${alpha(theme.palette.common.black, 0.3)}`,
          }}
        >
          <CardContent sx={{ p: 2 }}>
            {/* Phase Timeline - Now at the top */}
            <Box sx={{ width: '100%', mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5, color: 'text.secondary' }}>
                Project Phases
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, position: 'relative', width: '100%' }}>
                {phases.map((phaseName, index) => {
                  const isActive = index === currentPhase;
                  const isCompleted = index < currentPhase;
                  
                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ 
                        opacity: 1, 
                        scale: isActive && !isCompleted ? 1.05 : 1,
                        y: isActive && !isCompleted ? -4 : 0,
                      }}
                      transition={{ 
                        delay: 0.1 + index * 0.05, 
                        duration: 0.3,
                        scale: { duration: 0.3 },
                        y: { duration: 0.3 },
                      }}
                      whileHover={{ scale: isCompleted ? 1.02 : 1.08, y: isCompleted ? -2 : -6 }}
                      style={{ flex: 1 }}
                    >
                      <Box
                        sx={{
                          width: '100%',
                          minHeight: 70,
                          borderRadius: 2,
                          backgroundColor: isCompleted
                            ? '#4caf50'
                            : isActive
                            ? '#ffc107'
                            : alpha(theme.palette.divider, 0.3),
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: `2px solid ${isCompleted ? '#4caf50' : isActive ? '#ffc107' : alpha(theme.palette.divider, 0.5)}`,
                          position: 'relative',
                          overflow: 'hidden',
                          p: 1,
                          boxShadow: isCompleted
                            ? `0 4px 20px ${alpha('#4caf50', 0.3)}`
                            : isActive
                            ? `0 4px 20px ${alpha('#ffc107', 0.4)}`
                            : 'none',
                        }}
                      >
                        {isCompleted ? (
                          <Box sx={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <CheckCircleIcon
                              sx={{
                                fontSize: '1.5rem',
                                color: 'white',
                                mb: 0.25,
                              }}
                            />
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 600,
                                color: 'white',
                                fontSize: '0.65rem',
                                textAlign: 'center',
                                lineHeight: 1.2,
                              }}
                            >
                              {phaseName}
                            </Typography>
                          </Box>
                        ) : isActive ? (
                          <Box sx={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <motion.div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '1.75rem',
                                height: '1.75rem',
                                marginBottom: '0.15rem',
                              }}
                              animate={{ rotate: 360 }}
                              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                            >
                              <InProgressIcon
                                sx={{
                                  fontSize: '1.5rem',
                                  color: theme.palette.common.black,
                                }}
                              />
                            </motion.div>
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 600,
                                color: '#000000 !important',
                                fontSize: '0.65rem',
                                textAlign: 'center',
                                lineHeight: 1.2,
                              }}
                            >
                              {phaseName}
                            </Typography>
                          </Box>
                        ) : (
                          <>
                            <Typography
                              variant="h6"
                              sx={{
                                fontWeight: 700,
                                color: 'text.secondary',
                                fontSize: '1rem',
                                position: 'relative',
                                zIndex: 1,
                                mb: 0.25,
                              }}
                            >
                              {index + 1}
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 600,
                                color: 'text.secondary',
                                fontSize: '0.65rem',
                                position: 'relative',
                                zIndex: 1,
                                textAlign: 'center',
                                lineHeight: 1.2,
                              }}
                            >
                              {phaseName}
                            </Typography>
                          </>
                        )}
                      </Box>
                    </motion.div>
                  );
                })}
                
                {/* Rolling indicator - full width progress bar */}
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: -8,
                    left: 0,
                    right: 0,
                    height: 3,
                    background: alpha(theme.palette.divider, 0.2),
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}
                >
                  {/* Completed phases - green */}
                  {currentPhase > 0 && (
                    <motion.div
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: `${(currentPhase * 100) / 6}%`,
                        background: theme.palette.success.main,
                        borderRadius: 2,
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: `${(currentPhase * 100) / 6}%` }}
                      transition={{ duration: 0.8, ease: 'easeInOut' }}
                    />
                  )}
                  {/* Current phase - primary color */}
                  <motion.div
                    style={{
                      position: 'absolute',
                      left: `${(currentPhase * 100) / 6}%`,
                      top: 0,
                      bottom: 0,
                      width: `${100 / 6}%`,
                      background: theme.palette.primary.main,
                      borderRadius: 2,
                    }}
                    animate={{
                      left: `${(currentPhase * 100) / 6}%`,
                    }}
                    transition={{
                      duration: 0.8,
                      ease: 'easeInOut',
                    }}
                  />
                </Box>
              </Box>
            </Box>

            {/* Projects Table */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: 'text.secondary' }}>
                Active Projects
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ py: 0.5, border: 'none' }}>Project</TableCell>
                    <TableCell sx={{ py: 0.5, border: 'none' }}>Progress</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {mockProjects.map((project, index) => (
                    <TableRow
                      key={project.id}
                      sx={{
                        position: 'relative',
                        backgroundColor:
                          highlightedRow === index
                            ? alpha(theme.palette.primary.main, 0.15)
                            : 'transparent',
                        borderLeft: highlightedRow === index
                          ? `4px solid ${theme.palette.primary.main}`
                          : '4px solid transparent',
                        transition: 'background-color 0.6s ease, border-left 0.3s ease, opacity 0.4s ease, transform 0.4s ease',
                        opacity: 1,
                        transform: 'translateX(0)',
                        animation: `fadeInSlide 0.4s ease ${0.3 + index * 0.1}s both`,
                        '@keyframes fadeInSlide': {
                          '0%': {
                            opacity: 0,
                            transform: 'translateX(-20px)',
                          },
                          '100%': {
                            opacity: 1,
                            transform: 'translateX(0)',
                          },
                        },
                        '&:hover': {
                          backgroundColor: alpha(theme.palette.action.hover, 0.5),
                        },
                      }}
                    >
                      <TableCell sx={{ py: 1, border: 'none' }}>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {project.name}
                        </Typography>
                        <Chip
                          label={project.phase}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: '0.65rem',
                            mt: 0.5,
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ py: 1, border: 'none', width: 100 }}>
                        <LinearProgress
                          variant="determinate"
                          value={project.progress}
                          sx={{
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: alpha(theme.palette.primary.main, 0.1),
                            '& .MuiLinearProgress-bar': {
                              borderRadius: 3,
                            },
                          }}
                        />
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                          {project.progress}%
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </CardContent>
        </Card>
      </motion.div>
    </Box>
  );
}

