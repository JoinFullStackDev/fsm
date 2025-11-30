'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import {
  Box,
  Paper,
  Typography,
  LinearProgress,
  CircularProgress,
  useTheme,
  alpha,
  AppBar,
  Toolbar,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Tooltip,
} from '@mui/material';
import {
  Code as CodeIcon,
  Description as DescriptionIcon,
  Assignment as TaskIcon,
  CheckCircle as CheckCircleIcon,
  Dashboard as DashboardIcon,
  Folder as FolderIcon,
  Settings as SettingsIcon,
  Notifications as NotificationsIcon,
  AccountCircle as AccountCircleIcon,
  Menu as MenuIcon,
  Replay as ReplayIcon,
} from '@mui/icons-material';

export default function InteractiveMockUI() {
  const theme = useTheme();
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const [hasStarted, setHasStarted] = useState(false);
  const [codeProgress, setCodeProgress] = useState(0);
  const [currentCode, setCurrentCode] = useState('');
  const [taskProgress, setTaskProgress] = useState(0);
  const [prdProgress, setPrdProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState<'code' | 'task' | 'prd'>('code');

  const codeSnippet = `async function generateTasksFromPRD(prd) {
  const analysis = await ai.analyze(prd);
  const tasks = analysis.phases.map(phase => ({
    title: phase.task,
    description: phase.details,
    phase: phase.number,
    priority: phase.priority,
    estimatedHours: phase.estimate
  }));
  return tasks;
}`;

  const tasks = [
    'Implement user authentication',
    'Create profile management UI',
    'Add preference settings',
    'Set up data persistence',
  ];

  const prdSections = [
    { title: 'Overview', content: 'User profile management system...' },
    { title: 'Requirements', content: 'Users must be able to update their profile...' },
    { title: 'Technical Specs', content: 'RESTful API endpoints for CRUD operations...' },
  ];

  // Start animation when scrolled into view
  useEffect(() => {
    if (isInView && !hasStarted) {
      setHasStarted(true);
    }
  }, [isInView, hasStarted]);

  // Function to reset and restart animation
  const handleReanimate = () => {
    setCodeProgress(0);
    setCurrentCode('');
    setTaskProgress(0);
    setPrdProgress(0);
    setCurrentStep('code');
    setHasStarted(true); // Ensure animation starts immediately
  };

  useEffect(() => {
    // Only run animations if we've started (scrolled into view)
    if (!hasStarted) return;

    // Step 1: Code typing animation
    if (currentStep === 'code') {
      const codeInterval = setInterval(() => {
        setCurrentCode((prev) => {
          const nextChar = codeSnippet[prev.length];
          if (nextChar) {
            setCodeProgress((prev.length / codeSnippet.length) * 100);
            return prev + nextChar;
          } else {
            clearInterval(codeInterval);
            setCodeProgress(100);
            setTimeout(() => {
              setCurrentStep('task');
            }, 1500);
            return prev;
          }
        });
      }, 20);

      return () => clearInterval(codeInterval);
    }

    // Step 2: Task generation animation
    if (currentStep === 'task') {
      const taskInterval = setInterval(() => {
        setTaskProgress((prev) => {
          if (prev >= 100) {
            clearInterval(taskInterval);
            setTimeout(() => {
              setCurrentStep('prd');
            }, 1000);
            return 100;
          }
          return prev + 2;
        });
      }, 60);

      return () => clearInterval(taskInterval);
    }

    // Step 3: PRD filling animation
    if (currentStep === 'prd') {
      const prdInterval = setInterval(() => {
        setPrdProgress((prev) => {
          if (prev >= 100) {
            clearInterval(prdInterval);
            return 100;
          }
          return prev + 1.5;
        });
      }, 50);

      return () => clearInterval(prdInterval);
    }
  }, [currentStep, codeSnippet, hasStarted]);

  return (
    <Box
      ref={ref}
      sx={{
        width: '100%',
        py: { xs: 4, md: 6 },
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.8 }}
      >
        <Box sx={{ position: 'relative', zIndex: 1, mb: 4 }}>
          <Typography
            variant="h3"
            align="center"
            sx={{
              fontSize: { xs: '1.75rem', md: '2.5rem' },
              fontWeight: 700,
              mb: 1,
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Watch It Work
          </Typography>
          <Typography
            variant="h6"
            align="center"
            color="text.secondary"
            sx={{ mb: 4, maxWidth: '700px', mx: 'auto' }}
          >
            See how AI transforms your code into actionable tasks and comprehensive documentation
          </Typography>
        </Box>

        {/* Mock Dashboard */}
        <Paper
          elevation={8}
          sx={{
            width: '100%',
            maxWidth: '1400px',
            mx: 'auto',
            borderRadius: 3,
            overflow: 'hidden',
            background: theme.palette.background.paper,
            border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
            display: 'flex',
            flexDirection: 'column',
            minHeight: { xs: 'auto', md: '550px' },
            height: 'auto',
          }}
        >
          {/* Header */}
          <AppBar
            position="static"
            elevation={0}
            sx={{
              backgroundColor: theme.palette.background.paper,
              borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
              color: theme.palette.text.primary,
            }}
          >
            <Toolbar sx={{ px: 2, minHeight: '64px !important' }}>
              <IconButton edge="start" sx={{ mr: 2, display: { md: 'none' } }}>
                <MenuIcon />
              </IconButton>
              <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 600 }}>
                FullStack Method
              </Typography>
              <Tooltip title="Replay Animation" arrow>
                <IconButton 
                  onClick={handleReanimate}
                  sx={{ 
                    mr: 1,
                    '&:hover': {
                      backgroundColor: alpha(theme.palette.primary.main, 0.1),
                    },
                  }}
                >
                  <ReplayIcon />
                </IconButton>
              </Tooltip>
              <IconButton sx={{ mr: 1 }}>
                <NotificationsIcon />
              </IconButton>
              <IconButton>
                <AccountCircleIcon />
              </IconButton>
            </Toolbar>
          </AppBar>

          <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            {/* Sidebar - Collapsed with tooltips */}
            <Box
              sx={{
                width: { xs: 0, md: 64 },
                borderRight: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                backgroundColor: alpha(theme.palette.background.default, 0.5),
                display: { xs: 'none', md: 'block' },
              }}
            >
              <List sx={{ pt: 2, px: 0.5 }}>
                <Tooltip title="Dashboard" placement="right" arrow>
                  <ListItem
                    button
                    sx={{
                      justifyContent: 'center',
                      backgroundColor: alpha(theme.palette.primary.main, 0.1),
                      borderLeft: `3px solid ${theme.palette.primary.main}`,
                      borderRadius: 1,
                      mb: 0.5,
                      minHeight: 48,
                      '&:hover': {
                        backgroundColor: alpha(theme.palette.primary.main, 0.15),
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 'auto', justifyContent: 'center' }}>
                      <DashboardIcon sx={{ color: theme.palette.primary.main }} />
                    </ListItemIcon>
                  </ListItem>
                </Tooltip>
                <Tooltip title="Projects" placement="right" arrow>
                  <ListItem
                    button
                    sx={{
                      justifyContent: 'center',
                      borderRadius: 1,
                      mb: 0.5,
                      minHeight: 48,
                      '&:hover': {
                        backgroundColor: alpha(theme.palette.action.hover, 0.5),
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 'auto', justifyContent: 'center' }}>
                      <FolderIcon />
                    </ListItemIcon>
                  </ListItem>
                </Tooltip>
                <Tooltip title="Tasks" placement="right" arrow>
                  <ListItem
                    button
                    sx={{
                      justifyContent: 'center',
                      borderRadius: 1,
                      mb: 0.5,
                      minHeight: 48,
                      '&:hover': {
                        backgroundColor: alpha(theme.palette.action.hover, 0.5),
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 'auto', justifyContent: 'center' }}>
                      <TaskIcon />
                    </ListItemIcon>
                  </ListItem>
                </Tooltip>
                <Tooltip title="Settings" placement="right" arrow>
                  <ListItem
                    button
                    sx={{
                      justifyContent: 'center',
                      borderRadius: 1,
                      mb: 0.5,
                      minHeight: 48,
                      '&:hover': {
                        backgroundColor: alpha(theme.palette.action.hover, 0.5),
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 'auto', justifyContent: 'center' }}>
                      <SettingsIcon />
                    </ListItemIcon>
                  </ListItem>
                </Tooltip>
              </List>
            </Box>

            {/* Main Content Area */}
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'auto',
                backgroundColor: theme.palette.background.default,
              }}
            >
              <Box sx={{ p: { xs: 2, md: 4 }, flex: 1 }}>
                <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
                  AI Generation Workspace
                </Typography>

                {/* Content - Full Width Stacked */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* Code Section */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{
                      opacity: currentStep === 'code' ? 1 : 0.7,
                      y: 0,
                    }}
                    transition={{ duration: 0.3 }}
                  >
                    <Paper
                      elevation={2}
                      sx={{
                        p: 3,
                        backgroundColor: theme.palette.background.paper,
                        border: `2px solid ${currentStep === 'code' ? theme.palette.primary.main : alpha(theme.palette.divider, 0.5)}`,
                        borderRadius: 2,
                        transition: 'border-color 0.3s',
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <CodeIcon sx={{ color: theme.palette.primary.main }} />
                        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem', flex: 1 }}>
                          Code Input
                        </Typography>
                        {codeProgress === 100 && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 200 }}
                          >
                            <CheckCircleIcon sx={{ color: theme.palette.success.main, fontSize: 20 }} />
                          </motion.div>
                        )}
                      </Box>
                      <Box
                        sx={{
                          backgroundColor: alpha(theme.palette.primary.main, 0.05),
                          borderRadius: 1,
                          p: 2,
                          fontFamily: 'monospace',
                          fontSize: '0.75rem',
                          minHeight: 180,
                          position: 'relative',
                          overflow: 'auto',
                        }}
                      >
                        <Typography
                          component="pre"
                          sx={{
                            color: theme.palette.text.primary,
                            margin: 0,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            fontFamily: 'inherit',
                          }}
                        >
                          {currentCode}
                          {currentStep === 'code' && (
                            <motion.span
                              animate={{ opacity: [1, 0, 1] }}
                              transition={{ duration: 1, repeat: Infinity }}
                              style={{ display: 'inline-block' }}
                            >
                              |
                            </motion.span>
                          )}
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={codeProgress}
                        sx={{
                          mt: 2,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: alpha(theme.palette.primary.main, 0.1),
                          '& .MuiLinearProgress-bar': {
                            backgroundColor: theme.palette.primary.main,
                          },
                        }}
                      />
                    </Paper>
                  </motion.div>

                  {/* Task Generation Section */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{
                      opacity: currentStep === 'task' ? 1 : currentStep === 'prd' ? 1 : 0.7,
                      y: 0,
                    }}
                    transition={{ duration: 0.3 }}
                  >
                    <Paper
                      elevation={2}
                      sx={{
                        p: 3,
                        backgroundColor: theme.palette.background.paper,
                        border: `2px solid ${currentStep === 'task' ? theme.palette.primary.main : alpha(theme.palette.divider, 0.5)}`,
                        borderRadius: 2,
                        transition: 'border-color 0.3s',
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <TaskIcon sx={{ color: theme.palette.primary.main }} />
                        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem', flex: 1 }}>
                          Tasks Generated
                        </Typography>
                        {taskProgress === 100 && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 200 }}
                          >
                            <CheckCircleIcon sx={{ color: theme.palette.success.main, fontSize: 20 }} />
                          </motion.div>
                        )}
                      </Box>
                      <Box sx={{ minHeight: 180, display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <AnimatePresence>
                          {tasks.slice(0, Math.floor((taskProgress / 100) * tasks.length)).map((task, index) => (
                            <motion.div
                              key={task}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0 }}
                              transition={{ delay: index * 0.2 }}
                            >
                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 1,
                                  p: 1.5,
                                  backgroundColor: alpha(theme.palette.primary.main, 0.05),
                                  borderRadius: 1,
                                }}
                              >
                                <CheckCircleIcon sx={{ fontSize: 16, color: theme.palette.success.main }} />
                                <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                                  {task}
                                </Typography>
                              </Box>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                        {taskProgress < 100 && (
                          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
                            <CircularProgress size={24} sx={{ color: theme.palette.primary.main }} />
                          </Box>
                        )}
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={taskProgress}
                        sx={{
                          mt: 2,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: alpha(theme.palette.primary.main, 0.1),
                          '& .MuiLinearProgress-bar': {
                            backgroundColor: theme.palette.primary.main,
                          },
                        }}
                      />
                    </Paper>
                  </motion.div>
                </Box>

                {/* PRD Section - Full Width */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{
                    opacity: currentStep === 'prd' ? 1 : 0.7,
                    y: 0,
                  }}
                  transition={{ duration: 0.3 }}
                  style={{ marginTop: '24px' }}
                >
                  <Paper
                    elevation={2}
                    sx={{
                      p: 3,
                      backgroundColor: theme.palette.background.paper,
                      border: `2px solid ${currentStep === 'prd' ? theme.palette.primary.main : alpha(theme.palette.divider, 0.5)}`,
                      borderRadius: 2,
                      transition: 'border-color 0.3s',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <DescriptionIcon sx={{ color: theme.palette.primary.main }} />
                      <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem', flex: 1 }}>
                        PRD Generated
                      </Typography>
                      {prdProgress === 100 && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 200 }}
                        >
                          <CheckCircleIcon sx={{ color: theme.palette.success.main, fontSize: 20 }} />
                        </motion.div>
                      )}
                    </Box>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
                      <AnimatePresence>
                        {prdSections.slice(0, Math.floor((prdProgress / 100) * prdSections.length)).map((section, index) => (
                          <motion.div
                            key={section.title}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ delay: index * 0.3 }}
                          >
                            <Box
                              sx={{
                                p: 2,
                                backgroundColor: alpha(theme.palette.primary.main, 0.05),
                                borderRadius: 1,
                                minHeight: 100,
                              }}
                            >
                              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, fontSize: '0.875rem' }}>
                                {section.title}
                              </Typography>
                              <Typography variant="body2" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                                {section.content}
                              </Typography>
                            </Box>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                      {prdProgress < 100 && (
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            minHeight: 100,
                            gridColumn: { xs: '1', md: 'span 3' },
                          }}
                        >
                          <CircularProgress size={24} sx={{ color: theme.palette.primary.main }} />
                        </Box>
                      )}
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={prdProgress}
                      sx={{
                        mt: 2,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: alpha(theme.palette.primary.main, 0.1),
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: theme.palette.primary.main,
                        },
                      }}
                    />
                  </Paper>
                </motion.div>
              </Box>
            </Box>
          </Box>
        </Paper>
      </motion.div>
    </Box>
  );
}
