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

const mockProjects = [
  { id: 1, name: 'E-commerce Platform', phase: 'Phase 3', progress: 65 },
  { id: 2, name: 'Mobile App Redesign', phase: 'Phase 2', progress: 40 },
  { id: 3, name: 'API Integration', phase: 'Phase 4', progress: 80 },
];

const mockStats = [
  { label: 'Time Saved', value: '120h', color: 'primary' },
  { label: 'Specs Generated', value: '45', color: 'secondary' },
  { label: 'Bugs Caught', value: '23', color: 'success' },
];

export default function MockDashboard() {
  const theme = useTheme();
  const [highlightedRow, setHighlightedRow] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setHighlightedRow((prev) => (prev + 1) % mockProjects.length);
    }, 3000);
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
            {/* Stats Row */}
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              {mockStats.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1, duration: 0.4 }}
                >
                  <Box
                    sx={{
                      flex: 1,
                      p: 1.5,
                      borderRadius: 2,
                      background: alpha(theme.palette[stat.color as 'primary' | 'secondary' | 'success'].main, 0.1),
                      border: `1px solid ${alpha(theme.palette[stat.color as 'primary' | 'secondary' | 'success'].main, 0.2)}`,
                    }}
                  >
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                      {stat.label}
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: theme.palette[stat.color as 'primary' | 'secondary' | 'success'].main }}>
                      {stat.value}
                    </Typography>
                  </Box>
                </motion.div>
              ))}
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
                      component={motion.tr}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{
                        opacity: 1,
                        x: 0,
                        backgroundColor:
                          highlightedRow === index
                            ? alpha(theme.palette.primary.main, 0.1)
                            : alpha(theme.palette.background.paper, 0),
                      }}
                      transition={{
                        delay: 0.3 + index * 0.1,
                        duration: 0.4,
                        backgroundColor: { duration: 0.5 },
                      }}
                      sx={{
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

            {/* Phase Timeline */}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: 'text.secondary' }}>
                Phases
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {[1, 2, 3, 4, 5, 6].map((phase, index) => (
                  <motion.div
                    key={phase}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.6 + index * 0.05, duration: 0.3 }}
                    whileHover={{ scale: 1.1 }}
                  >
                    <Box
                      sx={{
                        flex: 1,
                        height: 40,
                        borderRadius: 1,
                        background:
                          index < 3
                            ? `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`
                            : alpha(theme.palette.divider, 0.3),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 600,
                          color: index < 3 ? 'white' : 'text.secondary',
                          fontSize: '0.7rem',
                        }}
                      >
                        {phase}
                      </Typography>
                    </Box>
                  </motion.div>
                ))}
              </Box>
            </Box>
          </CardContent>
        </Card>
      </motion.div>
    </Box>
  );
}

